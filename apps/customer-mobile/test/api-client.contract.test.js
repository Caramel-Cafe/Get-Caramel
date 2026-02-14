const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const clientPath = path.join(__dirname, "..", "src", "api", "client.ts");
const clientSource = fs.readFileSync(clientPath, "utf8");

test("auth endpoints are wired to gateway routes", () => {
  assert.match(clientSource, /\/api\/auth\/login/);
  assert.match(clientSource, /\/api\/auth\/register/);
  assert.match(clientSource, /\/api\/auth\/request-password-reset/);
  assert.match(clientSource, /\/api\/auth\/reset-password/);
  assert.match(clientSource, /\/api\/auth\/bootstrap-home/);
});

test("order endpoints include checkout, cart, and customer orders", () => {
  assert.match(clientSource, /\/api\/orders\/cart\/\$\{customerId\}/);
  assert.match(clientSource, /\/api\/orders\/cart\/items/);
  assert.match(clientSource, /\/api\/orders\/checkout/);
  assert.match(clientSource, /\/api\/orders\/customer\/\$\{customerId\}/);
});

test("payment endpoints include intent, confirm, and order lookup", () => {
  assert.match(clientSource, /\/api\/payments\/intents/);
  assert.match(clientSource, /\/api\/payments\/confirm/);
  assert.match(clientSource, /\/api\/payments\/order\/\$\{orderId\}/);
});

test("client throws API message from parseJson error path", () => {
  assert.match(clientSource, /Array\.isArray\(body\.message\)/);
  assert.match(clientSource, /throw new Error\(message \|\| "Request failed"\)/);
});
