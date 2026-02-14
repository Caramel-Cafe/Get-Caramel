const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pagePath = path.join(__dirname, "..", "app", "page.tsx");
const source = fs.readFileSync(pagePath, "utf8");

test("admin auth supports login and invite-only register-admin", () => {
  assert.match(source, /\/api\/auth\/login/);
  assert.match(source, /\/api\/auth\/register-admin/);
  assert.match(source, /inviteCode/);
  assert.match(source, /role:\s*"admin"/);
});

test("admin dashboard loads overview, orders, notifications, payouts, reviews, and tickets", () => {
  assert.match(source, /\/api\/orders\/admin\/overview/);
  assert.match(source, /\/api\/orders\/admin\/orders/);
  assert.match(source, /\/api\/notifications\/admin/);
  assert.match(source, /\/api\/payouts\/overview/);
  assert.match(source, /\/api\/orders\/admin\/reviews\/pending/);
  assert.match(source, /\/api\/orders\/admin\/support\/tickets/);
});

test("admin actions include payouts, review moderation, and ticket status updates", () => {
  assert.match(source, /\/api\/payouts\/run/);
  assert.match(source, /\/api\/orders\/admin\/reviews\/\$\{reviewId\}\/\$\{action\}/);
  assert.match(source, /\/api\/orders\/admin\/support\/\$\{ticketId\}\/status/);
});
