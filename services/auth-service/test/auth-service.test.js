const test = require("node:test");
const assert = require("node:assert/strict");
const { ForbiddenException, UnauthorizedException } = require("@nestjs/common");
const { AuthService } = require("../dist/modules/auth/auth.service");

process.env.AUTH_JWT_SECRET = "auth-service-test-secret";
process.env.AUTH_ACCESS_TTL_SEC = "900";
process.env.AUTH_REFRESH_TTL_SEC = "604800";
process.env.AUTH_ADMIN_INVITE_CODE = "test-invite-code";

function createService(overrides = {}) {
  const sessions = {
    set: async () => undefined,
    get: async () => undefined,
    delete: async () => undefined,
    ...overrides.sessions,
  };

  const auditRecords = [];
  const auditService = {
    record: (event) => auditRecords.push(event),
    ...overrides.auditService,
  };

  const users = {
    register: async (input) => ({
      userId: "usr_created_1",
      identifier: input.identifier,
      role: input.role,
      fullName: input.fullName,
      passwordHash: "hash",
      createdAtIso: new Date().toISOString(),
    }),
    authenticate: async () => null,
    issuePasswordResetToken: async () => null,
    consumePasswordResetToken: async () => false,
    ...overrides.users,
  };

  return { service: new AuthService(sessions, auditService, users), auditRecords };
}

test("blocks direct admin registration on /register flow", async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.register({
      identifier: "admin@example.com",
      password: "Password123!",
      role: "admin",
      fullName: "Admin User",
    }),
    ForbiddenException,
  );
});

test("rejects registerAdmin when invite code is invalid", async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.registerAdmin({
      identifier: "admin@example.com",
      password: "Password123!",
      fullName: "Admin User",
      inviteCode: "wrong-code",
    }),
    UnauthorizedException,
  );
});

test("registerAdmin succeeds with valid invite code and issues access token", async () => {
  const { service } = createService();

  const response = await service.registerAdmin({
    identifier: "admin@example.com",
    password: "Password123!",
    fullName: "Admin User",
    inviteCode: "test-invite-code",
  });

  assert.equal(response.profile.role, "admin");
  assert.equal(response.profile.userId, "usr_created_1");
  assert.ok(typeof response.tokens.accessToken === "string");
  assert.ok(response.tokens.accessToken.length > 10);
});

test("login rejects invalid credentials", async () => {
  const { service } = createService({
    users: {
      authenticate: async () => null,
    },
  });

  await assert.rejects(
    () => service.login({
      identifier: "customer@example.com",
      password: "wrong-password",
      role: "customer",
    }),
    UnauthorizedException,
  );
});

test("login succeeds and records success audit event", async () => {
  const { service, auditRecords } = createService({
    users: {
      authenticate: async () => ({
        userId: "usr_customer_1",
        identifier: "customer@example.com",
        role: "customer",
        fullName: "Customer One",
      }),
    },
  });

  const response = await service.login({
    identifier: "customer@example.com",
    password: "Password123!",
    role: "customer",
  });

  assert.equal(response.profile.userId, "usr_customer_1");
  assert.equal(response.profile.role, "customer");
  assert.ok(auditRecords.some((event) => event.action === "auth.login" && event.outcome === "SUCCESS"));
});

test("requestPasswordReset always returns success and may include token", async () => {
  const { service } = createService({
    users: {
      issuePasswordResetToken: async () => "reset_token_123",
    },
  });

  const response = await service.requestPasswordReset({
    identifier: "customer@example.com",
    role: "customer",
  });

  assert.equal(response.success, true);
  assert.ok(typeof response.resetToken === "string");
});

test("resetPassword rejects invalid token", async () => {
  const { service } = createService({
    users: {
      consumePasswordResetToken: async () => false,
    },
  });

  await assert.rejects(
    () => service.resetPassword("bad-token", "Password123!"),
    UnauthorizedException,
  );
});

test("resetPassword accepts valid token", async () => {
  const { service } = createService({
    users: {
      consumePasswordResetToken: async () => true,
    },
  });

  const response = await service.resetPassword("ok-token", "Password123!");
  assert.equal(response.success, true);
});
