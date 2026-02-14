const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appPath = path.join(__dirname, "..", "App.tsx");
const source = fs.readFileSync(appPath, "utf8");

test("courier auth flows target login/register endpoints with courier role", () => {
  assert.match(source, /\/api\/auth\/login/);
  assert.match(source, /\/api\/auth\/register/);
  assert.match(source, /role:\s*"courier"/);
});

test("courier task, state, navigation, and notification endpoints are present", () => {
  assert.match(source, /\/api\/orders\/rider\/\$\{riderId\}\/tasks/);
  assert.match(source, /\/api\/orders\/rider\/\$\{riderId\}\/state/);
  assert.match(source, /\/api\/orders\/rider\/\$\{riderId\}\/navigation/);
  assert.match(source, /\/api\/orders\/rider\/location/);
  assert.match(source, /\/api\/notifications\/rider\/\$\{riderId\}/);
  assert.match(source, /\/api\/notifications\/push\/register/);
});

test("courier action endpoint supports pickup/start/deliver transitions", () => {
  assert.match(source, /\/api\/orders\/rider\/\$\{orderId\}\/\$\{actionName\}/);
  assert.match(source, /"pickup"\s*\|\s*"start"\s*\|\s*"deliver"/);
});
