import { CoreDatabase } from "@get-caramel/database";
import { InvoiceRecord, PaymentIntentRecord, PayoutRecord, WalletBalanceRecord } from "@get-caramel/types";
import { Injectable, Logger } from "@nestjs/common";

type PendingSettlement = {
  vendorId: string;
  amountCents: number;
  orderIds: string[];
};

export type PaymentState = {
  payments: Array<[string, PaymentIntentRecord]>;
  paymentsByOrder: Array<[string, string]>;
  invoicesByVendor: Array<[string, InvoiceRecord[]]>;
  invoicesByOrder: Array<[string, InvoiceRecord]>;
  payoutsByVendor: Array<[string, PayoutRecord[]]>;
  pendingByVendor: Array<[string, PendingSettlement]>;
  recentByCustomer: Array<[string, string[]]>;
  walletByCustomer: Array<[string, WalletBalanceRecord]>;
  totalPaidCents: number;
};

@Injectable()
export class PaymentRepository {
  private readonly logger = new Logger(PaymentRepository.name);
  private readonly db = new CoreDatabase({
    connectionString: process.env.PAYMENT_DATABASE_URL || process.env.DATABASE_URL,
    log: (message: string) => this.logger.log(message),
  });
  private initialized = false;

  async loadState(): Promise<PaymentState | null> {
    await this.init();
    if (!this.db.isReady()) return null;

    const paymentRows = await this.db.query("select * from payments");
    const invoiceRows = await this.db.query("select * from invoices");
    const payoutRows = await this.db.query("select * from payouts");
    const balanceRows = await this.db.query("select * from vendor_balances");
    const customerIndexRows = await this.db.query("select * from customer_payment_index");
    const walletRows = await this.db.query("select * from wallet_balances");
    const kvRows = await this.db.query("select * from service_kv where service = 'payment-service'");

    const payments = paymentRows.map((row) => this.mapPayment(row));
    const paymentsByOrder = payments.map((payment) => [payment.orderId, payment.paymentId] as [string, string]);

    const invoices = invoiceRows.map((row) => this.mapInvoice(row));
    const invoicesByOrder = invoices.map((invoice) => [invoice.orderId, invoice] as [string, InvoiceRecord]);
    const invoicesByVendorMap = new Map<string, InvoiceRecord[]>();
    for (const invoice of invoices) {
      const current = invoicesByVendorMap.get(invoice.vendorId) || [];
      current.push(invoice);
      invoicesByVendorMap.set(invoice.vendorId, current);
    }

    const payouts = payoutRows.map((row) => this.mapPayout(row));
    const payoutsByVendorMap = new Map<string, PayoutRecord[]>();
    for (const payout of payouts) {
      const current = payoutsByVendorMap.get(payout.vendorId) || [];
      current.push(payout);
      payoutsByVendorMap.set(payout.vendorId, current);
    }

    const pendingByVendor = balanceRows.map((row) => {
      const orderIds = JSON.parse(String(row.order_ids_json)) as string[];
      return [String(row.vendor_id), {
        vendorId: String(row.vendor_id),
        amountCents: Number(row.amount_cents),
        orderIds,
      }] as [string, PendingSettlement];
    });

    const recentByCustomer = customerIndexRows.map((row) => (
      [String(row.customer_id), JSON.parse(String(row.payment_ids_json)) as string[]] as [string, string[]]
    ));
    const walletByCustomer = walletRows.map((row) => ([
      String(row.customer_id),
      {
        customerId: String(row.customer_id),
        balanceCents: Number(row.balance_cents),
        updatedAtIso: String(row.updated_at_iso),
      },
    ] as [string, WalletBalanceRecord]));

    const totalPaidRow = kvRows.find((row) => String(row.key) === "totalPaidCents");
    const totalPaidCents = totalPaidRow ? Number(totalPaidRow.value) : 0;

    return {
      payments: payments.map((payment) => [payment.paymentId, payment] as [string, PaymentIntentRecord]),
      paymentsByOrder,
      invoicesByVendor: Array.from(invoicesByVendorMap.entries()),
      invoicesByOrder,
      payoutsByVendor: Array.from(payoutsByVendorMap.entries()),
      pendingByVendor,
      recentByCustomer,
      walletByCustomer,
      totalPaidCents,
    };
  }

  async upsertPayment(payment: PaymentIntentRecord): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;

    await this.db.query(
      "insert into payments (payment_id, order_id, customer_id, vendor_id, amount_cents, method, provider, provider_ref, status, risk_score, risk_flagged, created_at_iso, updated_at_iso) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict (payment_id) do update set status=excluded.status, provider=excluded.provider, provider_ref=excluded.provider_ref, risk_score=excluded.risk_score, risk_flagged=excluded.risk_flagged, updated_at_iso=excluded.updated_at_iso",
      [payment.paymentId, payment.orderId, payment.customerId, payment.vendorId, payment.amountCents, payment.method, payment.provider, payment.providerRef || null, payment.status, payment.riskScore, payment.riskFlagged, payment.createdAtIso, payment.updatedAtIso],
    );
  }

  async upsertInvoice(invoice: InvoiceRecord): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;
    await this.db.query(
      "insert into invoices (invoice_id, order_id, vendor_id, customer_id, gross_amount_cents, platform_fee_cents, net_vendor_amount_cents, issued_at_iso) values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (invoice_id) do update set gross_amount_cents=excluded.gross_amount_cents, platform_fee_cents=excluded.platform_fee_cents, net_vendor_amount_cents=excluded.net_vendor_amount_cents",
      [invoice.invoiceId, invoice.orderId, invoice.vendorId, invoice.customerId, invoice.grossAmountCents, invoice.platformFeeCents, invoice.netVendorAmountCents, invoice.issuedAtIso],
    );
  }

  async upsertPayout(payout: PayoutRecord): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;
    await this.db.query(
      "insert into payouts (payout_id, vendor_id, amount_cents, orders_count, created_at_iso) values ($1,$2,$3,$4,$5) on conflict (payout_id) do update set amount_cents=excluded.amount_cents, orders_count=excluded.orders_count",
      [payout.payoutId, payout.vendorId, payout.amountCents, payout.ordersCount, payout.createdAtIso],
    );
  }

  async upsertVendorBalance(balance: PendingSettlement): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;
    await this.db.query(
      "insert into vendor_balances (vendor_id, amount_cents, order_ids_json) values ($1,$2,$3) on conflict (vendor_id) do update set amount_cents=excluded.amount_cents, order_ids_json=excluded.order_ids_json",
      [balance.vendorId, balance.amountCents, JSON.stringify(balance.orderIds)],
    );
  }

  async upsertCustomerPaymentIndex(customerId: string, paymentIds: string[]): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;
    await this.db.query(
      "insert into customer_payment_index (customer_id, payment_ids_json) values ($1,$2) on conflict (customer_id) do update set payment_ids_json=excluded.payment_ids_json",
      [customerId, JSON.stringify(paymentIds)],
    );
  }

  async setTotalPaidCents(totalPaidCents: number): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;
    await this.db.query(
      "insert into service_kv (service, key, value) values ('payment-service','totalPaidCents',$1) on conflict (service, key) do update set value=excluded.value",
      [String(totalPaidCents)],
    );
  }

  async upsertWalletBalance(wallet: WalletBalanceRecord): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;
    await this.db.query(
      "insert into wallet_balances (customer_id, balance_cents, updated_at_iso) values ($1,$2,$3) on conflict (customer_id) do update set balance_cents=excluded.balance_cents, updated_at_iso=excluded.updated_at_iso",
      [wallet.customerId, wallet.balanceCents, wallet.updatedAtIso],
    );
  }

  async getVendorInvoicesPaged(vendorId: string, limit: number, offset: number): Promise<InvoiceRecord[] | null> {
    await this.init();
    if (!this.db.isReady()) return null;
    return (await this.db.query(
      "select * from invoices where vendor_id = $1 order by issued_at_iso desc limit $2 offset $3",
      [vendorId, limit, offset],
    )).map((row) => this.mapInvoice(row));
  }

  async getCustomerPaymentsPaged(customerId: string, limit: number, offset: number): Promise<PaymentIntentRecord[] | null> {
    await this.init();
    if (!this.db.isReady()) return null;
    return (await this.db.query(
      "select * from payments where customer_id = $1 order by created_at_iso desc limit $2 offset $3",
      [customerId, limit, offset],
    )).map((row) => this.mapPayment(row));
  }

  async getVendorPayoutsPaged(vendorId: string, limit: number, offset: number): Promise<PayoutRecord[] | null> {
    await this.init();
    if (!this.db.isReady()) return null;
    return (await this.db.query(
      "select * from payouts where vendor_id = $1 order by created_at_iso desc limit $2 offset $3",
      [vendorId, limit, offset],
    )).map((row) => this.mapPayout(row));
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.db.init();
  }

  private mapPayment(row: Record<string, unknown>): PaymentIntentRecord {
    return {
      paymentId: String(row.payment_id),
      orderId: String(row.order_id),
      customerId: String(row.customer_id),
      vendorId: String(row.vendor_id),
      amountCents: Number(row.amount_cents),
      method: String(row.method) as PaymentIntentRecord["method"],
      provider: (row.provider ? String(row.provider) : "local") as PaymentIntentRecord["provider"],
      providerRef: row.provider_ref ? String(row.provider_ref) : undefined,
      status: String(row.status) as PaymentIntentRecord["status"],
      riskScore: Number(row.risk_score),
      riskFlagged: Boolean(row.risk_flagged),
      createdAtIso: String(row.created_at_iso),
      updatedAtIso: String(row.updated_at_iso),
    };
  }

  private mapInvoice(row: Record<string, unknown>): InvoiceRecord {
    return {
      invoiceId: String(row.invoice_id),
      orderId: String(row.order_id),
      vendorId: String(row.vendor_id),
      customerId: String(row.customer_id),
      grossAmountCents: Number(row.gross_amount_cents),
      platformFeeCents: Number(row.platform_fee_cents),
      netVendorAmountCents: Number(row.net_vendor_amount_cents),
      issuedAtIso: String(row.issued_at_iso),
    };
  }

  private mapPayout(row: Record<string, unknown>): PayoutRecord {
    return {
      payoutId: String(row.payout_id),
      vendorId: String(row.vendor_id),
      amountCents: Number(row.amount_cents),
      ordersCount: Number(row.orders_count),
      createdAtIso: String(row.created_at_iso),
    };
  }
}
