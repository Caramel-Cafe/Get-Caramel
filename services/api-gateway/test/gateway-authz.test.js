const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { ForbiddenException, UnauthorizedException } = require("@nestjs/common");
const { GatewayAuthzService } = require("../dist/modules/gateway/gateway-authz.service");

const secret = "step22-test-secret";
process.env.AUTH_JWT_SECRET = secret;

function bearerFor(role, userId = "usr_test_01") {
  const token = jwt.sign({ sub: userId, role, sid: "sid_1", typ: "access" }, secret, { expiresIn: 3600 });
  return `Bearer ${token}`;
}

test("allows public auth login route without token", () => {
  const authz = new GatewayAuthzService();
  const result = authz.authorize("POST", "/api/auth/login", {});
  assert.deepEqual(result, {});
});

test("allows public password reset request route without token", () => {
  const authz = new GatewayAuthzService();
  const result = authz.authorize("POST", "/api/auth/request-password-reset", {});
  assert.deepEqual(result, {});
});

test("allows customer on checkout route", () => {
  const authz = new GatewayAuthzService();
  const result = authz.authorize("POST", "/api/orders/checkout", { authorization: bearerFor("customer") });
  assert.equal(result.role, "customer");
  assert.equal(result.userId, "usr_test_01");
});

test("blocks vendor owner on admin-only route", () => {
  const authz = new GatewayAuthzService();
  assert.throws(
    () => authz.authorize("GET", "/api/orders/admin/overview", { authorization: bearerFor("vendor_owner") }),
    ForbiddenException,
  );
});

test("requires bearer token on protected route", () => {
  const authz = new GatewayAuthzService();
  assert.throws(
    () => authz.authorize("GET", "/api/orders/customer/usr_1", {}),
    UnauthorizedException,
  );
});

test("allows customer on wallet routes", () => {
  const authz = new GatewayAuthzService();
  const result = authz.authorize("GET", "/api/wallets/usr_test_01", { authorization: bearerFor("customer") });
  assert.equal(result.role, "customer");
});

test("allows courier to publish delivery location", () => {
  const authz = new GatewayAuthzService();
  const result = authz.authorize(
    "POST",
    "/api/delivery/couriers/cr_1/location",
    { authorization: bearerFor("courier") },
  );
  assert.equal(result.role, "courier");
});
