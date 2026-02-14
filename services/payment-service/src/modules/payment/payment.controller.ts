import { DeadLetterJobRecord, DurableJobQueueStatus } from "@get-caramel/persistence";
import {
  InvoiceRecord,
  PaymentIntentRecord,
  PayoutOverview,
  PayoutRecord,
  VendorPayoutSummary,
  WalletBalanceRecord,
} from "@get-caramel/types";
import { Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { ConfirmPaymentDto, CreatePaymentIntentDto, PaymentWebhookDto, WalletTopupDto } from "./dto/payment.dto";
import { PaymentService } from "./payment.service";

@Controller()
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post("payments/intents")
  async createIntent(
    @Body() dto: CreatePaymentIntentDto,
    @Headers("x-idempotency-key") idempotencyKey?: string,
  ): Promise<PaymentIntentRecord> {
    return this.payments.createIntentIdempotent(dto, idempotencyKey);
  }

  @Post("payments/confirm")
  async confirm(
    @Body() dto: ConfirmPaymentDto,
    @Headers("x-idempotency-key") idempotencyKey?: string,
  ): Promise<PaymentIntentRecord> {
    return this.payments.confirmPaymentIdempotent(dto.paymentId, idempotencyKey);
  }

  @Post("payments/webhook")
  webhook(@Body() dto: PaymentWebhookDto): PaymentIntentRecord {
    return this.payments.applyWebhook(dto.paymentId, dto.status, dto.providerRef);
  }

  @Get("payments/order/:orderId")
  paymentByOrder(@Param("orderId") orderId: string): PaymentIntentRecord {
    return this.payments.getPaymentByOrder(orderId);
  }

  @Get("payments/customer/:customerId")
  paymentsByCustomer(@Param("customerId") customerId: string): PaymentIntentRecord[] {
    return this.payments.getPaymentsByCustomer(customerId);
  }

  @Get("payments/customer/:customerId/paged")
  async paymentsByCustomerPaged(
    @Param("customerId") customerId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<PaymentIntentRecord[]> {
    return this.payments.getPaymentsByCustomerPaged(customerId, Number(limit || 25), Number(offset || 0));
  }

  @Get("wallets/:customerId")
  walletBalance(@Param("customerId") customerId: string): WalletBalanceRecord {
    return this.payments.getWalletBalance(customerId);
  }

  @Post("wallets/topup")
  walletTopup(@Body() dto: WalletTopupDto): WalletBalanceRecord {
    return this.payments.topupWallet(dto.customerId, dto.amountCents);
  }

  @Post("payouts/run")
  async runPayouts(@Headers("x-idempotency-key") idempotencyKey?: string): Promise<PayoutRecord[]> {
    return this.payments.runPayoutsIdempotent("admin:ops", idempotencyKey);
  }

  @Get("payouts/vendor/:vendorId/summary")
  vendorSummary(@Param("vendorId") vendorId: string): VendorPayoutSummary {
    return this.payments.getVendorPayoutSummary(vendorId);
  }

  @Get("payouts/overview")
  payoutOverview(): PayoutOverview {
    return this.payments.getPayoutOverview();
  }

  @Get("payouts/queue/status")
  payoutQueueStatus(): Promise<DurableJobQueueStatus> {
    return this.payments.getPayoutQueueStatus();
  }

  @Get("payouts/queue/dead-letter")
  payoutDeadLetters(@Query("limit") limit?: string): Promise<DeadLetterJobRecord<unknown>[]> {
    return this.payments.listPayoutDeadLetters(Number(limit || 100));
  }

  @Get("invoices/vendor/:vendorId")
  vendorInvoices(@Param("vendorId") vendorId: string): InvoiceRecord[] {
    return this.payments.getVendorInvoices(vendorId);
  }

  @Get("invoices/vendor/:vendorId/paged")
  async vendorInvoicesPaged(
    @Param("vendorId") vendorId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<InvoiceRecord[]> {
    return this.payments.getVendorInvoicesPaged(vendorId, Number(limit || 25), Number(offset || 0));
  }

  @Get("invoices/order/:orderId")
  orderInvoice(@Param("orderId") orderId: string): InvoiceRecord {
    return this.payments.getOrderInvoice(orderId);
  }
}
