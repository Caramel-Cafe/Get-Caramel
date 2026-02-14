const test = require("node:test");
const assert = require("node:assert/strict");
const { BadRequestException } = require("@nestjs/common");
const { OrderService } = require("../dist/modules/order/order.service");

function createService() {
  const realtimeEvents = [];
  const notifications = [];
  const auditEvents = [];

  const realtime = {
    emit: (event) => realtimeEvents.push(event),
  };
  const notificationsService = {
    create: (actorKey, title, body, orderId) => {
      notifications.push({ actorKey, title, body, orderId });
      return { notificationId: "ntf_test_1", actorKey, title, body, orderId };
    },
  };
  const auditService = {
    record: (event) => auditEvents.push(event),
  };
  const orderRepository = {
    loadState: async () => null,
    upsertCart: async () => undefined,
    upsertOrder: async () => undefined,
    upsertReview: async () => undefined,
    upsertSupportTicket: async () => undefined,
    upsertRiderState: async () => undefined,
    getVendorQueuePaged: async () => null,
    getCustomerOrdersPaged: async () => null,
    getAdminRecentOrdersPaged: async () => null,
    getCustomerReviewsPaged: async () => null,
    getPendingReviewsPaged: async () => null,
    getCustomerSupportTicketsPaged: async () => null,
    getAdminSupportTicketsPaged: async () => null,
  };

  const service = new OrderService(realtime, notificationsService, auditService, orderRepository);
  return { service, realtimeEvents, notifications, auditEvents };
}

function createPlacedOrder(service, customerId = "cus_1") {
  service.addCartItem({
    customerId,
    vendorId: "vnd_001",
    itemId: "itm_001",
    quantity: 2,
  });
  return service.checkout({
    customerId,
    addressLine: "123 Market Street",
  });
}

test("checkout creates placed order and clears cart", () => {
  const { service } = createService();
  service.addCartItem({
    customerId: "cus_1",
    vendorId: "vnd_001",
    itemId: "itm_001",
    quantity: 1,
  });

  const order = service.checkout({
    customerId: "cus_1",
    addressLine: "123 Market Street",
  });
  const cartAfter = service.getCart("cus_1");

  assert.equal(order.status, "PLACED");
  assert.equal(order.totalCents, 1498);
  assert.equal(cartAfter.items.length, 0);
  assert.equal(cartAfter.totalCents, 0);
});

test("blocks adding items from another vendor into existing cart", () => {
  const { service } = createService();
  service.addCartItem({
    customerId: "cus_1",
    vendorId: "vnd_001",
    itemId: "itm_001",
    quantity: 1,
  });

  assert.throws(
    () => service.addCartItem({
      customerId: "cus_1",
      vendorId: "vnd_002",
      itemId: "itm_003",
      quantity: 1,
    }),
    BadRequestException,
  );
});

test("assigns a rider when vendor marks order ready", () => {
  const { service } = createService();
  const order = createPlacedOrder(service);
  service.vendorAccept(order.orderId);

  const ready = service.vendorMarkReady(order.orderId);

  assert.equal(ready.status, "READY_FOR_PICKUP");
  assert.ok(ready.riderId);
});

test("rejects invalid status transitions", () => {
  const { service } = createService();
  const order = createPlacedOrder(service);

  assert.throws(
    () => service.vendorMarkPreparing(order.orderId),
    BadRequestException,
  );
});

test("flags toxic review comments for moderation", () => {
  const { service } = createService();
  const order = createPlacedOrder(service, "cus_2");
  service.vendorAccept(order.orderId);
  const ready = service.vendorMarkReady(order.orderId);
  service.riderPickup(order.orderId, ready.riderId);
  service.riderStartTransit(order.orderId, ready.riderId);
  service.riderDeliver(order.orderId, ready.riderId);

  const review = service.createReview({
    orderId: order.orderId,
    customerId: "cus_2",
    rating: 1,
    comment: "This is a scam and fraud",
  });

  assert.equal(review.moderationStatus, "PENDING");
  assert.equal(review.flaggedReason, "contains_fraud");
});
