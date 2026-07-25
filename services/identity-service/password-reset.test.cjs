const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcrypt");
const {
  GENERIC_REQUEST_MESSAGE,
  confirmPasswordReset,
  hashPasswordResetOtp,
  requestPasswordReset,
} = require("./password-reset.cjs");

function withEnvironment(run) {
  const previousSecret = process.env.JWT_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.JWT_SECRET = "password-reset-test-secret";
  process.env.NODE_ENV = "test";
  return Promise.resolve().then(run).finally(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });
}

test("password reset request does not reveal whether an account exists", () =>
  withEnvironment(async () => {
    const prisma = { user: { findUnique: async () => null } };
    const result = await requestPasswordReset(prisma, { email: "missing@example.com" });
    assert.equal(result.status, 200);
    assert.equal(result.payload.message, GENERIC_REQUEST_MESSAGE);
    assert.equal(result.payload.devOtp, undefined);
  }));

test("password reset request stores only a hashed OTP and sends the raw code", () =>
  withEnvironment(async () => {
    let createdData;
    let sentPayload;
    const prisma = {
      user: {
        findUnique: async () => ({ id: "user-1", email: "user@example.com", status: "ACTIVE" }),
      },
      passwordResetOtp: {
        findFirst: async () => null,
        updateMany: async () => ({}),
        create: async ({ data }) => {
          createdData = data;
          return { id: "otp-1", ...data };
        },
        delete: async () => ({}),
      },
    };
    const result = await requestPasswordReset(
      prisma,
      { email: "USER@example.com" },
      {
        code: "123456",
        sendOtp: async (payload) => {
          sentPayload = payload;
        },
      },
    );

    assert.equal(result.status, 200);
    assert.equal(result.payload.devOtp, "123456");
    assert.equal(createdData.codeHash, hashPasswordResetOtp("123456"));
    assert.notEqual(createdData.codeHash, "123456");
    assert.deepEqual(sentPayload, { to: "user@example.com", code: "123456" });
  }));

test("password reset confirm increments attempts for an incorrect OTP", () =>
  withEnvironment(async () => {
    let updated;
    const prisma = {
      user: {
        findUnique: async () => ({
          id: "user-1",
          password: await bcrypt.hash("OldPassword1", 4),
          status: "ACTIVE",
        }),
      },
      passwordResetOtp: {
        findFirst: async () => ({
          id: "otp-1",
          codeHash: hashPasswordResetOtp("123456"),
          attemptCount: 0,
        }),
        update: async (args) => {
          updated = args;
        },
      },
    };
    const result = await confirmPasswordReset(prisma, {
      email: "user@example.com",
      code: "000000",
      newPassword: "NewPassword1",
    });
    assert.equal(result.status, 400);
    assert.deepEqual(updated.data.attemptCount, { increment: 1 });
  }));

test("password reset confirm changes the password and consumes all active OTPs", () =>
  withEnvironment(async () => {
    const operations = [];
    const oldHash = await bcrypt.hash("OldPassword1", 4);
    const prisma = {
      user: {
        findUnique: async () => ({ id: "user-1", password: oldHash, status: "ACTIVE" }),
        update: (args) => Promise.resolve({ type: "user", args }),
      },
      passwordResetOtp: {
        findFirst: async () => ({
          id: "otp-1",
          codeHash: hashPasswordResetOtp("123456"),
          attemptCount: 0,
        }),
        update: (args) => Promise.resolve({ type: "otp", args }),
        updateMany: (args) => Promise.resolve({ type: "other-otps", args }),
      },
      $transaction: async (items) => {
        operations.push(...(await Promise.all(items)));
      },
    };
    const result = await confirmPasswordReset(prisma, {
      email: "user@example.com",
      code: "123456",
      newPassword: "NewPassword1",
    });
    assert.equal(result.status, 200);
    assert.equal(operations.length, 3);
    assert.equal(await bcrypt.compare("NewPassword1", operations[0].args.data.password), true);
    assert.ok(operations[1].args.data.consumedAt instanceof Date);
  }));
