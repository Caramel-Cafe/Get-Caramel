const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pagePath = path.join(__dirname, "..", "app", "page.tsx");
const source = fs.readFileSync(pagePath, "utf8");

test("vendor auth requests hit login/register with vendor_owner role", () => {
  assert.match(source, /\/api\/auth\/login/);
  assert.match(source, /\/api\/auth\/register/);
  assert.match(source, /role:\s*"vendor_owner"/);
});

test("vendor dashboard loads queue, notifications, payouts, invoices, and reviews", () => {
  assert.match(source, /\/api\/orders\/vendor\/\$\{VENDOR_ID\}\/queue/);
  assert.match(source, /\/api\/notifications\/vendor\/\$\{VENDOR_ID\}/);
  assert.match(source, /\/api\/payouts\/vendor\/\$\{VENDOR_ID\}\/summary/);
  assert.match(source, /\/api\/invoices\/vendor\/\$\{VENDOR_ID\}/);
  assert.match(source, /\/api\/orders\/vendor\/\$\{VENDOR_ID\}\/reviews/);
});

test("vendor order actions include accept/preparing/ready/reject routes", () => {
  assert.match(source, /\/api\/orders\/vendor\/\$\{orderId\}\/\$\{action\}/);
  assert.match(source, /"accept"\s*\|\s*"preparing"\s*\|\s*"ready"\s*\|\s*"reject"/);
});
