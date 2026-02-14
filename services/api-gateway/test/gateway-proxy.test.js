const test = require("node:test");
const assert = require("node:assert/strict");
const { NotFoundException } = require("@nestjs/common");
const { GatewayProxyService } = require("../dist/modules/gateway/gateway-proxy.service");

test("routes order paths to order service", () => {
  const proxy = new GatewayProxyService();
  const target = proxy.resolve("/api/orders/checkout");
  assert.equal(target.upstreamPath, "/orders/checkout");
  assert.equal(target.routeKey, "orders/checkout");
});

test("routes payment paths to payment service", () => {
  const proxy = new GatewayProxyService();
  const target = proxy.resolve("/api/payments/intents");
  assert.equal(target.upstreamPath, "/payments/intents");
  assert.equal(target.routeKey, "payments/intents");
});

test("routes delivery paths to delivery service", () => {
  const proxy = new GatewayProxyService();
  const target = proxy.resolve("/api/delivery/dispatch/preview");
  assert.equal(target.upstreamPath, "/delivery/dispatch/preview");
  assert.equal(target.routeKey, "delivery/dispatch/preview");
});

test("throws for unknown routes", () => {
  const proxy = new GatewayProxyService();
  assert.throws(() => proxy.resolve("/api/unknown/path"), NotFoundException);
});
