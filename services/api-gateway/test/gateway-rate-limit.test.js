const test = require("node:test");
const assert = require("node:assert/strict");
const { HttpException } = require("@nestjs/common");
const { GatewayRateLimitService } = require("../dist/modules/gateway/gateway-rate-limit.service");

test("decrements remaining quota and blocks over limit", async () => {
  const service = new GatewayRateLimitService();
  const client = `test-client-${Date.now()}`;

  const first = await service.enforce(client, "payouts/run");
  assert.equal(first.limit, 10);
  assert.equal(first.remaining, 9);

  for (let i = 0; i < 9; i += 1) {
    await service.enforce(client, "payouts/run");
  }

  await assert.rejects(
    async () => service.enforce(client, "payouts/run"),
    (error) => {
      assert.equal(error instanceof HttpException, true);
      assert.equal(error.getStatus(), 429);
      return true;
    },
  );
});
