import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 8,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<350"],
  },
};

const AUTH_BASE = __ENV.AUTH_BASE || "http://localhost:4001";
const ORDER_BASE = __ENV.ORDER_BASE || "http://localhost:4003";
const PAYMENT_BASE = __ENV.PAYMENT_BASE || "http://localhost:4004";

export default function () {
  const login = http.post(
    `${AUTH_BASE}/auth/login`,
    JSON.stringify({
      identifier: "customer@getcaramel.app",
      password: "password123",
      role: "customer",
    }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(login, { "login status 201/200": (r) => r.status === 201 || r.status === 200 });

  const discovery = http.get(`${ORDER_BASE}/orders/discovery`);
  check(discovery, { "discovery status 200": (r) => r.status === 200 });

  const checkout = http.post(
    `${ORDER_BASE}/orders/checkout`,
    JSON.stringify({
      customerId: "usr_customer_customergetc",
      addressLine: "221B Baker Street",
    }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(checkout, { "checkout responds": (r) => r.status >= 200 && r.status < 500 });

  const payoutOverview = http.get(`${PAYMENT_BASE}/payouts/overview`);
  check(payoutOverview, { "payout overview status 200": (r) => r.status === 200 });

  sleep(0.3);
}
