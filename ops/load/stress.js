import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 25 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<500"],
  },
};

const ORDER_BASE = __ENV.ORDER_BASE || "http://localhost:4003";
const PAYMENT_BASE = __ENV.PAYMENT_BASE || "http://localhost:4004";

export default function () {
  const discovery = http.get(`${ORDER_BASE}/orders/discovery`);
  check(discovery, { "discovery ok": (r) => r.status === 200 });

  const queue = http.get(`${ORDER_BASE}/orders/vendor/vnd_001/queue`);
  check(queue, { "vendor queue ok": (r) => r.status === 200 });

  const adminOverview = http.get(`${ORDER_BASE}/orders/admin/overview`);
  check(adminOverview, { "admin overview ok": (r) => r.status === 200 });

  const payouts = http.get(`${PAYMENT_BASE}/payouts/overview`);
  check(payouts, { "payment overview ok": (r) => r.status === 200 });

  sleep(0.2);
}
