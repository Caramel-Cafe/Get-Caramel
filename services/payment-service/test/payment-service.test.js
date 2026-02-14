const test = require("node:test");
const assert = require("node:assert/strict");
const { BadRequestException } = require("@nestjs/common");
const { PaymentService } = require("../dist/modules/payment/payment.service");

function createService() {
  const auditEvents = [];
  const auditService = {
    record: (event) => auditEvents.push(event),
  };
  const paymentRepository = {
    loadState: async () => null,
    upsertPayment: async () => undefined,
    upsertInvoice: async () => undefined,
    upsertPayout: async () => undefined,
    upsertVendorBalance: async () => undefined,
    upsertCustomerPaymentIndex: async () => undefined,
    upsertWalletBalance: async () => undefined,
    setTotalPaidCents: async () => undefined,
    getVendorInvoicesPaged: async () => null,
    getCustomerPaymentsPaged: async () => null,
    getVendorPayoutsPaged: async () => null,
  };

  const service = new PaymentService(auditService, paymentRepository);
  return { service, auditEvents };
}

test("createIntent returns REQUIRES_CONFIRMATION for card", () => {
  const { service } = createService();

  const payment = service.createIntent({
    orderId: "ord_100",
    customerId: "cus_1",
    vendorId: "vnd_001",
    amountCents: 2500,
    method: "CARD",
  });

  assert.equal(payment.status, "REQUIRES_CONFIRMATION");
  assert.equal(payment.orderId, "ord_100");
});

test("confirmPayment succeeds and creates invoice + pending vendor balance", () => {
  const { service } = createService();
  const payment = service.createIntent({
    orderId: "ord_101",
    customerId: "cus_1",
    vendorId: "vnd_001",
    amountCents: 5000,
    method: "CARD",
  });

  const confirmed = service.confirmPayment(payment.paymentId);
  const invoice = service.getOrderInvoice("ord_101");
  const vendorSummary = service.getVendorPayoutSummary("vnd_001");

  assert.equal(confirmed.status, "SUCCEEDED");
  assert.equal(invoice.grossAmountCents, 5000);
  assert.equal(invoice.platformFeeCents, 750);
  assert.equal(invoice.netVendorAmountCents, 4250);
  assert.equal(vendorSummary.pendingBalanceCents, 4250);
});

test("confirmPayment blocks very high-risk transactions", () => {
  const { service } = createService();
  for (let i = 0; i < 8; i += 1) {
    service.createIntent({
      orderId: `ord_seed_${i}`,
      customerId: "cus_risky",
      vendorId: "vnd_001",
      amountCents: 12000,
      method: "CARD",
    });
  }

  const risky = service.createIntent({
    orderId: "ord_risky_final",
    customerId: "cus_risky",
    vendorId: "vnd_001",
    amountCents: 12000,
    method: "CARD",
  });

  const result = service.confirmPayment(risky.paymentId);
  assert.equal(result.status, "FAILED");
});

test("runPayouts moves pending balance to paid totals", () => {
  const { service } = createService();
  const payment = service.createIntent({
    orderId: "ord_202",
    customerId: "cus_1",
    vendorId: "vnd_002",
    amountCents: 4000,
    method: "CARD",
  });
  service.confirmPayment(payment.paymentId);

  const payouts = service.runPayouts();
  const vendorSummary = service.getVendorPayoutSummary("vnd_002");
  const overview = service.getPayoutOverview();

  assert.equal(payouts.length, 1);
  assert.equal(vendorSummary.pendingBalanceCents, 0);
  assert.equal(vendorSummary.paidOutTotalCents, 3400);
  assert.equal(overview.totalPaidCents, 3400);
});

test("confirming failed payment throws", () => {
  const { service } = createService();
  const payment = service.createIntent({
    orderId: "ord_333",
    customerId: "cus_2",
    vendorId: "vnd_001",
    amountCents: 2000,
    method: "CARD",
  });
  service.applyWebhook(payment.paymentId, "FAILED");

  assert.throws(
    () => service.confirmPayment(payment.paymentId),
    BadRequestException,
  );
});

test("wallet payments settle instantly when balance is sufficient", () => {
  const { service } = createService();
  service.topupWallet("cus_wallet", 5000);

  const payment = service.createIntent({
    orderId: "ord_wallet_1",
    customerId: "cus_wallet",
    vendorId: "vnd_001",
    amountCents: 1800,
    method: "WALLET",
  });

  const wallet = service.getWalletBalance("cus_wallet");
  assert.equal(payment.status, "SUCCEEDED");
  assert.equal(wallet.balanceCents, 3200);
});
