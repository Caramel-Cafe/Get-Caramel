# Load Testing

Step 9 introduces baseline load tests focused on perceived instant UX.

## Prerequisites
- Start auth, order, and payment services locally.
- Install k6: https://k6.io/docs/get-started/installation/

## Smoke
```bash
k6 run ops/load/smoke.js
```

## Stress
```bash
k6 run ops/load/stress.js
```

## Custom Service URLs
```bash
k6 run -e AUTH_BASE=http://localhost:4001 -e ORDER_BASE=http://localhost:4003 -e PAYMENT_BASE=http://localhost:4004 ops/load/smoke.js
```

## Baseline Targets
- `http_req_duration p95 < 350ms` for smoke.
- `http_req_duration p95 < 500ms` for stress.
- `http_req_failed < 2%`.
