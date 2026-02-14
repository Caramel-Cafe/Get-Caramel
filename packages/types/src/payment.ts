export type PaymentMethod = "CARD" | "WALLET" | "CASH";
export type PaymentStatus = "REQUIRES_CONFIRMATION" | "SUCCEEDED" | "FAILED" | "REFUNDED";
export type PaymentProvider = "local" | "pesapal";

export interface PaymentIntentRecord {
  paymentId: string;
  orderId: string;
  customerId: string;
  vendorId: string;
  amountCents: number;
  method: PaymentMethod;
  provider: PaymentProvider;
  providerRef?: string;
  status: PaymentStatus;
  riskScore: number;
  riskFlagged: boolean;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface CreatePaymentIntentRequest {
  orderId: string;
  customerId: string;
  vendorId: string;
  amountCents: number;
  method: PaymentMethod;
}

export interface ConfirmPaymentRequest {
  paymentId: string;
}

export interface PaymentWebhookRequest {
  paymentId: string;
  status: PaymentStatus;
  providerRef: string;
}

export interface InvoiceRecord {
  invoiceId: string;
  orderId: string;
  vendorId: string;
  customerId: string;
  grossAmountCents: number;
  platformFeeCents: number;
  netVendorAmountCents: number;
  issuedAtIso: string;
}

export interface PayoutRecord {
  payoutId: string;
  vendorId: string;
  amountCents: number;
  ordersCount: number;
  createdAtIso: string;
}

export interface VendorPayoutSummary {
  vendorId: string;
  pendingBalanceCents: number;
  paidOutTotalCents: number;
  lastPayoutAtIso: string | null;
  payouts: PayoutRecord[];
}

export interface PayoutOverview {
  totalPendingCents: number;
  totalPaidCents: number;
  vendorsWithPending: number;
}

export interface WalletBalanceRecord {
  customerId: string;
  balanceCents: number;
  updatedAtIso: string;
}

export interface WalletTopupRequest {
  customerId: string;
  amountCents: number;
}
