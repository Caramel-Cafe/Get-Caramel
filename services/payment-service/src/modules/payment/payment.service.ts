import { DeadLetterJobRecord, DurableJobQueue, DurableJobQueueStatus, IdempotencyStore } from "@get-caramel/persistence";
import {
  AuditActorRole,
  AuditOutcome,
  CreatePaymentIntentRequest,
  InvoiceRecord,
  PaymentIntentRecord,
  PaymentProvider,
  PaymentStatus,
  PayoutOverview,
  PayoutRecord,
  VendorPayoutSummary,
  WalletBalanceRecord,
} from "@get-caramel/types";
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AuditService } from "../audit/audit.service";
import { PaymentRepository } from "./repository/payment.repository";

type PayoutReconcilePayload = {
  payoutId: string;
  vendorId: string;
};

@Injectable()
export class PaymentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentService.name);
  private readonly platformFeeBps = 1500;
  private readonly provider = (process.env.PAYMENT_PROVIDER || "local").toLowerCase() as PaymentProvider;
  private readonly pesapalConsumerKey = process.env.PESAPAL_CONSUMER_KEY;
  private readonly pesapalConsumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
  private readonly payments = new Map<string, PaymentIntentRecord>();
  private readonly paymentsByOrder = new Map<string, string>();
  private readonly invoicesByVendor = new Map<string, InvoiceRecord[]>();
  private readonly invoicesByOrder = new Map<string, InvoiceRecord>();
  private readonly payoutsByVendor = new Map<string, PayoutRecord[]>();
  private readonly pendingByVendor = new Map<string, { vendorId: string; amountCents: number; orderIds: string[] }>();
  private readonly recentByCustomer = new Map<string, string[]>();
  private readonly walletsByCustomer = new Map<string, WalletBalanceRecord>();
  private readonly payoutQueue = new DurableJobQueue<PayoutReconcilePayload>({
    namespace: "payment-service",
    queueName: "payout-reconcile",
    pollIntervalMs: 700,
    maxAttempts: 5,
    baseDelayMs: 500,
    maxDelayMs: 15000,
    postgresUrl: process.env.PAYMENT_DATABASE_URL || process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    log: (message: string) => this.logger.log(message),
  });
  private readonly idempotency = new IdempotencyStore({
    namespace: "payment-service",
    ttlSeconds: 1800,
    postgresUrl: process.env.PAYMENT_DATABASE_URL || process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    log: (message: string) => this.logger.log(message),
  });
  private payoutSweepTimer?: ReturnType<typeof setInterval>;
  private totalPaidCents = 0;

  constructor(
    private readonly auditService: AuditService,
    private readonly paymentRepository: PaymentRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const snapshot = await this.paymentRepository.loadState();
    if (snapshot) {
      this.payments.clear();
      this.paymentsByOrder.clear();
      this.invoicesByVendor.clear();
      this.invoicesByOrder.clear();
      this.payoutsByVendor.clear();
      this.pendingByVendor.clear();
      this.recentByCustomer.clear();

      for (const [key, value] of snapshot.payments) this.payments.set(key, value);
      for (const [key, value] of snapshot.paymentsByOrder) this.paymentsByOrder.set(key, value);
      for (const [key, value] of snapshot.invoicesByVendor) this.invoicesByVendor.set(key, value);
      for (const [key, value] of snapshot.invoicesByOrder) this.invoicesByOrder.set(key, value);
      for (const [key, value] of snapshot.payoutsByVendor) this.payoutsByVendor.set(key, value);
      for (const [key, value] of snapshot.pendingByVendor) this.pendingByVendor.set(key, value);
      for (const [key, value] of snapshot.recentByCustomer) this.recentByCustomer.set(key, value);
      for (const [key, value] of snapshot.walletByCustomer) this.walletsByCustomer.set(key, value);
      this.totalPaidCents = snapshot.totalPaidCents;
      this.logger.log("Hydrated payment-service state from repository");
    }

    await this.payoutQueue.start(async (job: { payload: PayoutReconcilePayload; attempt: number }) => {
      await this.reconcilePayout(job.payload, job.attempt);
    });
    this.payoutSweepTimer = setInterval(() => {
      void this.enqueuePendingPayoutJobs();
    }, 10000);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.payoutSweepTimer) clearInterval(this.payoutSweepTimer);
    await this.payoutQueue.stop();
  }

  createIntent(input: CreatePaymentIntentRequest): PaymentIntentRecord {
    if (this.paymentsByOrder.has(input.orderId)) {
      const existingId = this.paymentsByOrder.get(input.orderId) as string;
      return this.getPaymentById(existingId);
    }

    const riskScore = this.computeRisk(input.customerId, input.amountCents);
    const riskFlagged = riskScore >= 0.75;
    const now = new Date().toISOString();

    const providerRef = input.method === "CARD" ? this.createProviderReference(input.orderId) : undefined;
    const payment: PaymentIntentRecord = {
      paymentId: `pay_${randomUUID().slice(0, 12)}`,
      orderId: input.orderId,
      customerId: input.customerId,
      vendorId: input.vendorId,
      amountCents: input.amountCents,
      method: input.method,
      provider: this.provider,
      providerRef,
      status: input.method === "CASH" || input.method === "WALLET" ? "SUCCEEDED" : "REQUIRES_CONFIRMATION",
      riskScore,
      riskFlagged,
      createdAtIso: now,
      updatedAtIso: now,
    };

    if (input.method === "WALLET") {
      const wallet = this.getOrCreateWallet(input.customerId);
      if (wallet.balanceCents < input.amountCents) {
        throw new BadRequestException("Insufficient wallet balance");
      }
      wallet.balanceCents -= input.amountCents;
      wallet.updatedAtIso = now;
      this.walletsByCustomer.set(wallet.customerId, wallet);
      this.persistWallet(wallet);
    }

    this.payments.set(payment.paymentId, payment);
    this.paymentsByOrder.set(payment.orderId, payment.paymentId);
    this.rememberCustomerPayment(input.customerId, payment.paymentId);

    if (payment.status === "SUCCEEDED") {
      this.onPaymentSucceeded(payment);
    }

    this.audit(`customer:${payment.customerId}`, "payment.intent.create", "SUCCESS", "payment", payment.paymentId, {
      method: payment.method,
      riskFlagged: payment.riskFlagged,
    });
    this.persistPayment(payment);

    return payment;
  }

  async createIntentIdempotent(
    input: CreatePaymentIntentRequest,
    idempotencyKey?: string,
  ): Promise<PaymentIntentRecord> {
    if (!idempotencyKey) return this.createIntent(input);
    const scopedKey = `create-intent:${input.customerId}:${input.orderId}:${idempotencyKey}`;
    return this.idempotency.execute(scopedKey, async () => this.createIntent(input));
  }

  confirmPayment(paymentId: string): PaymentIntentRecord {
    const payment = this.getPaymentById(paymentId);

    if (payment.status === "SUCCEEDED") return payment;
    if (payment.status === "FAILED" || payment.status === "REFUNDED") {
      throw new BadRequestException("Payment cannot be confirmed in current status");
    }

    if (payment.riskScore >= 0.92) {
      payment.status = "FAILED";
      payment.updatedAtIso = new Date().toISOString();
      this.audit(`customer:${payment.customerId}`, "payment.confirm", "FAILURE", "payment", payment.paymentId, {
        reason: "risk_block",
      });
      this.persistPayment(payment);
      return payment;
    }

    payment.status = "SUCCEEDED";
    payment.updatedAtIso = new Date().toISOString();
    this.onPaymentSucceeded(payment);
    this.audit(`customer:${payment.customerId}`, "payment.confirm", "SUCCESS", "payment", payment.paymentId, {
      method: payment.method,
    });
    this.persistPayment(payment);

    return payment;
  }

  async confirmPaymentIdempotent(paymentId: string, idempotencyKey?: string): Promise<PaymentIntentRecord> {
    if (!idempotencyKey) return this.confirmPayment(paymentId);
    const payment = this.getPaymentById(paymentId);
    const scopedKey = `confirm-payment:${payment.customerId}:${paymentId}:${idempotencyKey}`;
    return this.idempotency.execute(scopedKey, async () => this.confirmPayment(paymentId));
  }

  applyWebhook(paymentId: string, status: PaymentStatus, providerRef?: string): PaymentIntentRecord {
    const payment = this.getPaymentById(paymentId);
    payment.status = status;
    if (providerRef) payment.providerRef = providerRef;
    payment.updatedAtIso = new Date().toISOString();

    if (status === "SUCCEEDED") this.onPaymentSucceeded(payment);

    this.audit("system", "payment.webhook.apply", "SUCCESS", "payment", payment.paymentId, { status });
    this.persistPayment(payment);

    return payment;
  }

  getPaymentByOrder(orderId: string): PaymentIntentRecord {
    const paymentId = this.paymentsByOrder.get(orderId);
    if (!paymentId) throw new NotFoundException("Payment for order not found");
    return this.getPaymentById(paymentId);
  }

  getPaymentsByCustomer(customerId: string): PaymentIntentRecord[] {
    const ids = this.recentByCustomer.get(customerId) || [];
    return ids.map((id) => this.getPaymentById(id));
  }

  async getPaymentsByCustomerPaged(customerId: string, limit: number, offset: number): Promise<PaymentIntentRecord[]> {
    const dbRows = await this.paymentRepository.getCustomerPaymentsPaged(customerId, limit, offset);
    if (dbRows) return dbRows;
    const ids = this.recentByCustomer.get(customerId) || [];
    return ids.slice(offset, offset + limit).map((id) => this.getPaymentById(id));
  }

  runPayouts(): PayoutRecord[] {
    const created: PayoutRecord[] = [];

    for (const [vendorId, pending] of this.pendingByVendor.entries()) {
      if (pending.amountCents <= 0) continue;

      const payout: PayoutRecord = {
        payoutId: `pyo_${randomUUID().slice(0, 12)}`,
        vendorId,
        amountCents: pending.amountCents,
        ordersCount: pending.orderIds.length,
        createdAtIso: new Date().toISOString(),
      };

      const current = this.payoutsByVendor.get(vendorId) || [];
      current.unshift(payout);
      this.payoutsByVendor.set(vendorId, current.slice(0, 200));

      created.push(payout);
      this.totalPaidCents += payout.amountCents;
      this.pendingByVendor.set(vendorId, { vendorId, amountCents: 0, orderIds: [] });

      this.audit("admin:ops", "payout.run", "SUCCESS", "payout", payout.payoutId, {
        vendorId,
        amountCents: payout.amountCents,
      });
      this.enqueuePayoutReconcileJob(payout);
    }

    return created;
  }

  async runPayoutsIdempotent(actorKey: string, idempotencyKey?: string): Promise<PayoutRecord[]> {
    if (!idempotencyKey) return this.runPayouts();
    const scopedKey = `run-payouts:${actorKey}:${idempotencyKey}`;
    return this.idempotency.execute(scopedKey, async () => this.runPayouts());
  }

  getVendorPayoutSummary(vendorId: string): VendorPayoutSummary {
    const pending = this.pendingByVendor.get(vendorId);
    const payouts = this.payoutsByVendor.get(vendorId) || [];

    return {
      vendorId,
      pendingBalanceCents: pending?.amountCents || 0,
      paidOutTotalCents: payouts.reduce((sum, p) => sum + p.amountCents, 0),
      lastPayoutAtIso: payouts[0]?.createdAtIso || null,
      payouts,
    };
  }

  getPayoutOverview(): PayoutOverview {
    const totalPendingCents = Array.from(this.pendingByVendor.values()).reduce((sum, p) => sum + p.amountCents, 0);

    return {
      totalPendingCents,
      totalPaidCents: this.totalPaidCents,
      vendorsWithPending: Array.from(this.pendingByVendor.values()).filter((p) => p.amountCents > 0).length,
    };
  }

  getVendorInvoices(vendorId: string): InvoiceRecord[] {
    return this.invoicesByVendor.get(vendorId) || [];
  }

  async getVendorInvoicesPaged(vendorId: string, limit: number, offset: number): Promise<InvoiceRecord[]> {
    const dbRows = await this.paymentRepository.getVendorInvoicesPaged(vendorId, limit, offset);
    if (dbRows) return dbRows;
    return (this.invoicesByVendor.get(vendorId) || []).slice(offset, offset + limit);
  }

  getOrderInvoice(orderId: string): InvoiceRecord {
    const invoice = this.invoicesByOrder.get(orderId);
    if (!invoice) throw new NotFoundException("Invoice not found");
    return invoice;
  }

  getPayoutQueueStatus(): Promise<DurableJobQueueStatus> {
    return this.payoutQueue.getStatus();
  }

  listPayoutDeadLetters(limit = 100): Promise<DeadLetterJobRecord<PayoutReconcilePayload>[]> {
    return this.payoutQueue.listDeadLetters(limit);
  }

  getWalletBalance(customerId: string): WalletBalanceRecord {
    return this.getOrCreateWallet(customerId);
  }

  topupWallet(customerId: string, amountCents: number): WalletBalanceRecord {
    if (amountCents <= 0) {
      throw new BadRequestException("Topup amount must be positive");
    }
    const current = this.getOrCreateWallet(customerId);
    current.balanceCents += amountCents;
    current.updatedAtIso = new Date().toISOString();
    this.walletsByCustomer.set(customerId, current);
    this.persistWallet(current);
    return current;
  }

  private enqueuePayoutReconcileJob(payout: PayoutRecord): void {
    void this.payoutQueue.enqueue("payout.reconcile", {
      payoutId: payout.payoutId,
      vendorId: payout.vendorId,
    }).catch((error: unknown) => this.logger.warn(`Queue payout reconcile failed: ${String(error)}`));
  }

  private async enqueuePendingPayoutJobs(): Promise<void> {
    for (const [vendorId, pending] of this.pendingByVendor.entries()) {
      if (pending.amountCents <= 0) continue;

      const payout: PayoutRecord = {
        payoutId: `pyo_${randomUUID().slice(0, 12)}`,
        vendorId,
        amountCents: pending.amountCents,
        ordersCount: pending.orderIds.length,
        createdAtIso: new Date().toISOString(),
      };
      const current = this.payoutsByVendor.get(vendorId) || [];
      current.unshift(payout);
      this.payoutsByVendor.set(vendorId, current.slice(0, 200));
      this.totalPaidCents += payout.amountCents;
      this.pendingByVendor.set(vendorId, { vendorId, amountCents: 0, orderIds: [] });
      this.enqueuePayoutReconcileJob(payout);
    }
  }

  private async reconcilePayout(payload: PayoutReconcilePayload, attempt: number): Promise<void> {
    const payout = (this.payoutsByVendor.get(payload.vendorId) || [])
      .find((candidate) => candidate.payoutId === payload.payoutId);
    if (!payout) return;

    if (attempt === 0 && payout.payoutId.endsWith("0")) {
      throw new Error("Simulated transient payout provider timeout");
    }

    await this.paymentRepository.upsertPayout(payout);
    await this.persistVendorBalance(payload.vendorId);
    await this.paymentRepository.setTotalPaidCents(this.totalPaidCents);
  }

  private onPaymentSucceeded(payment: PaymentIntentRecord): void {
    if (this.invoicesByOrder.has(payment.orderId)) return;

    const platformFeeCents = Math.round((payment.amountCents * this.platformFeeBps) / 10000);
    const netVendorAmountCents = payment.amountCents - platformFeeCents;

    const invoice: InvoiceRecord = {
      invoiceId: `inv_${randomUUID().slice(0, 12)}`,
      orderId: payment.orderId,
      vendorId: payment.vendorId,
      customerId: payment.customerId,
      grossAmountCents: payment.amountCents,
      platformFeeCents,
      netVendorAmountCents,
      issuedAtIso: new Date().toISOString(),
    };

    this.invoicesByOrder.set(invoice.orderId, invoice);

    const byVendor = this.invoicesByVendor.get(invoice.vendorId) || [];
    byVendor.unshift(invoice);
    this.invoicesByVendor.set(invoice.vendorId, byVendor.slice(0, 500));

    const pending = this.pendingByVendor.get(invoice.vendorId) || {
      vendorId: invoice.vendorId,
      amountCents: 0,
      orderIds: [],
    };

    pending.amountCents += invoice.netVendorAmountCents;
    pending.orderIds.push(invoice.orderId);
    this.pendingByVendor.set(invoice.vendorId, pending);

    this.persistInvoice(invoice);
    void this.persistVendorBalance(pending.vendorId)
      .catch((error: unknown) => this.logger.warn(`Persist vendor balance failed: ${String(error)}`));
  }

  private getOrCreateWallet(customerId: string): WalletBalanceRecord {
    const current = this.walletsByCustomer.get(customerId);
    if (current) return current;
    const created: WalletBalanceRecord = {
      customerId,
      balanceCents: 0,
      updatedAtIso: new Date().toISOString(),
    };
    this.walletsByCustomer.set(customerId, created);
    return created;
  }

  private createProviderReference(orderId: string): string | undefined {
    if (this.provider === "local") {
      return `local_${orderId}_${randomUUID().slice(0, 8)}`;
    }
    if (this.provider === "pesapal") {
      if (!this.pesapalConsumerKey || !this.pesapalConsumerSecret) {
        throw new BadRequestException("PESAPAL credentials are missing");
      }
      return `pesapal_${orderId}_${randomUUID().slice(0, 8)}`;
    }
    return undefined;
  }

  private computeRisk(customerId: string, amountCents: number): number {
    const recentIds = this.recentByCustomer.get(customerId) || [];
    const velocityFactor = Math.min(recentIds.length / 8, 1);
    const amountFactor = Math.min(amountCents / 12000, 1);

    const score = (velocityFactor * 0.45) + (amountFactor * 0.55);
    return Number(score.toFixed(3));
  }

  private getPaymentById(paymentId: string): PaymentIntentRecord {
    const payment = this.payments.get(paymentId);
    if (!payment) throw new NotFoundException("Payment not found");
    return payment;
  }

  private rememberCustomerPayment(customerId: string, paymentId: string): void {
    const current = this.recentByCustomer.get(customerId) || [];
    current.unshift(paymentId);
    this.recentByCustomer.set(customerId, current.slice(0, 40));
    void this.persistCustomerIndex(customerId)
      .catch((error: unknown) => this.logger.warn(`Persist customer index failed: ${String(error)}`));
  }

  private persistPayment(payment: PaymentIntentRecord): void {
    void this.paymentRepository.upsertPayment(payment)
      .catch((error: unknown) => this.logger.warn(`Persist payment failed: ${String(error)}`));
  }

  private persistInvoice(invoice: InvoiceRecord): void {
    void this.paymentRepository.upsertInvoice(invoice)
      .catch((error: unknown) => this.logger.warn(`Persist invoice failed: ${String(error)}`));
  }

  private persistCustomerIndex(customerId: string): Promise<void> {
    const paymentIds = this.recentByCustomer.get(customerId) || [];
    return this.paymentRepository.upsertCustomerPaymentIndex(customerId, paymentIds);
  }

  private persistVendorBalance(vendorId: string): Promise<void> {
    const balance = this.pendingByVendor.get(vendorId) || { vendorId, amountCents: 0, orderIds: [] };
    return this.paymentRepository.upsertVendorBalance(balance);
  }

  private persistWallet(wallet: WalletBalanceRecord): void {
    void this.paymentRepository.upsertWalletBalance(wallet)
      .catch((error: unknown) => this.logger.warn(`Persist wallet failed: ${String(error)}`));
  }

  private audit(
    actorKey: string,
    action: string,
    outcome: AuditOutcome,
    resourceType: string,
    resourceId?: string,
    metadata?: Record<string, string | number | boolean>,
  ): void {
    const actorRole: AuditActorRole =
      actorKey.startsWith("customer:") ? "customer" :
      actorKey.startsWith("vendor:") ? "vendor" :
      actorKey.startsWith("rider:") ? "rider" :
      actorKey.startsWith("admin:") ? "admin" : "system";

    this.auditService.record({
      actorKey,
      actorRole,
      action,
      resourceType,
      resourceId,
      outcome,
      metadata,
    });
  }
}
