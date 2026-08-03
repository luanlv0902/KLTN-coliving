require("dotenv").config();

const express = require("express");
const { PrismaClient } = require("./generated/client");
const { requestIdentity, requireInternalService } = require("../shared/internal-auth.cjs");
const { createPublisher, startConsumer } = require("../shared/rabbitmq.cjs");
const { createObservability } = require("../shared/observability.cjs");
const { startOutboxWorker } = require("./outbox.cjs");
const { handleAdminAuditEvent } = require("./audit-events.cjs");
const {
  createAdmin,
  createUser,
  getAdminLogs,
  getUserById,
  getUserStats,
  listUsers,
  updateUserAction,
} = require("./admin-users.cjs");
const {
  changePassword,
  getCurrentUser,
  getProfile,
  getUserSummaries,
  login,
  register,
  updateProfile,
} = require("./auth.cjs");
const { requestPhoneOtp, verifyPhoneOtp } = require("./phone-otp.cjs");
const {
  confirmPasswordReset,
  requestPasswordReset,
} = require("./password-reset.cjs");
const { getDomainUser, getDomainUsers, searchDomainUsers } = require("./domain-users.cjs");
const {
  deleteLegacyAccount,
  getLegacyProfile,
  updateLegacyProfile,
} = require("./user-profile.cjs");

const app = express();
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.IDENTITY_DATABASE_URL || process.env.DATABASE_URL } },
});
const port = Number(process.env.PORT || 4001);
const observability = createObservability("identity-service");

app.disable("x-powered-by");
app.use(observability.middleware);
app.use(express.json({ limit: "1mb" }));
app.get("/metrics", observability.metrics);

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "identity-service" });
});

app.use("/v1", requireInternalService);

app.post("/v1/internal/domain/users/batch", async (request, response) => {
  try {
    return response.json(await getDomainUsers(prisma, request.body?.ids || []));
  } catch (error) {
    console.error("[identity-service] domain user batch failed", error);
    return response.status(500).json({ message: "Cannot load domain users" });
  }
});

app.post("/v1/internal/domain/users/search", async (request, response) => {
  try {
    return response.json(await searchDomainUsers(prisma, request.body || {}));
  } catch (error) {
    console.error("[identity-service] domain user search failed", error);
    return response.status(500).json({ message: "Cannot search domain users" });
  }
});

app.get("/v1/internal/domain/users/:id", async (request, response) => {
  try {
    const user = await getDomainUser(prisma, request.params.id);
    return user
      ? response.json(user)
      : response.status(404).json({ message: "User not found" });
  } catch (error) {
    console.error("[identity-service] domain user failed", error);
    return response.status(500).json({ message: "Cannot load domain user" });
  }
});

app.get("/v1/admin/users", async (request, response) => {
  try {
    const result = await listUsers(prisma, requestIdentity(request), request.query);
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] GET /v1/admin/users failed", error);
    return response.status(500).json({ error: "Internal server error" });
  }
});

app.post("/v1/admin/users", async (request, response) => {
  try {
    const result = await createUser(
      prisma,
      requestIdentity(request),
      request.body || {},
    );
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] POST /v1/admin/users failed", error);
    return response.status(500).json({ error: "Internal server error" });
  }
});

app.get("/v1/admin/users/:id", async (request, response) => {
  try {
    const result = await getUserById(
      prisma,
      requestIdentity(request),
      request.params.id,
    );
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] GET /v1/admin/users/:id failed", error);
    return response.status(500).json({ error: "Internal server error" });
  }
});

app.patch("/v1/admin/users/:id", async (request, response) => {
  try {
    const result = await updateUserAction(
      prisma,
      requestIdentity(request),
      request.params.id,
      request.body || {},
    );
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] PATCH /v1/admin/users/:id failed", error);
    return response.status(500).json({ error: "Internal server error" });
  }
});

app.get("/v1/admin/stats/users", async (request, response) => {
  try {
    const result = await getUserStats(prisma, requestIdentity(request));
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] GET /v1/admin/stats/users failed", error);
    return response.status(500).json({ error: "Internal server error" });
  }
});

app.get("/v1/admin/logs", async (request, response) => {
  try {
    const result = await getAdminLogs(prisma, requestIdentity(request), request.query);
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] GET /v1/admin/logs failed", error);
    return response.status(500).json({ error: "Internal server error" });
  }
});

app.post("/v1/admin/create-admin", async (request, response) => {
  try {
    const result = await createAdmin(
      prisma,
      request.body || {},
      process.env.ADMIN_SECRET_KEY || "your-secret-key",
    );
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] POST /v1/admin/create-admin failed", error);
    return response.status(500).json({ error: "Internal server error" });
  }
});

app.post("/v1/auth/login", async (request, response) => {
  try {
    const result = await login(
      prisma,
      String(request.body?.email || "").trim(),
      request.body?.password,
    );
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] POST /v1/auth/login failed", error);
    return response.status(error.statusCode || 500).json({
      message: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
    });
  }
});

app.get("/v1/auth/me", async (request, response) => {
  try {
    const result = await getCurrentUser(
      prisma,
      request.get("authorization"),
    );
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] GET /v1/auth/me failed", error);
    return response.status(error.statusCode || 500).json({
      message: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
    });
  }
});

app.post("/v1/auth/register", async (request, response) => {
  try {
    const result = await register(prisma, request.body || {});
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] POST /v1/auth/register failed", error);
    return response.status(error.statusCode || 500).json({
      message: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
    });
  }
});

app.post("/v1/auth/password-reset/request", async (request, response) => {
  try {
    const result = await requestPasswordReset(prisma, request.body || {});
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] POST password reset request failed", error);
    return response.status(503).json({
      message: "Hiện không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.",
    });
  }
});

app.post("/v1/auth/password-reset/confirm", async (request, response) => {
  try {
    const result = await confirmPasswordReset(prisma, request.body || {});
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] POST password reset confirm failed", error);
    return response.status(500).json({
      message: "Không thể đặt lại mật khẩu. Vui lòng thử lại sau.",
    });
  }
});

app.get("/v1/profile", async (request, response) => {
  try {
    const result = await getProfile(prisma, request.get("authorization"));
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] GET /v1/profile failed", error);
    return response.status(500).json({ message: "Cannot load profile" });
  }
});

app.get("/v1/users/profile", async (request, response) => {
  try {
    const result = await getLegacyProfile(prisma, requestIdentity(request));
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] GET /v1/users/profile failed", error);
    return response.status(500).json({ message: "Cannot load user profile" });
  }
});

app.post("/v1/users/summaries", async (request, response) => {
  try {
    const result = await getUserSummaries(prisma, request.body?.ids || []);
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] POST /v1/users/summaries failed", error);
    return response.status(500).json({ message: "Cannot load user summaries" });
  }
});

app.put("/v1/users/profile", async (request, response) => {
  try {
    const result = await updateLegacyProfile(
      prisma,
      requestIdentity(request),
      request.body || {},
    );
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] PUT /v1/users/profile failed", error);
    return response.status(500).json({ message: "Cannot update user profile" });
  }
});

app.delete("/v1/users/profile", async (request, response) => {
  try {
    const result = await deleteLegacyAccount(prisma, requestIdentity(request));
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] DELETE /v1/users/profile failed", error);
    return response.status(500).json({ message: "Cannot delete account" });
  }
});

app.put("/v1/profile", async (request, response) => {
  try {
    const result = await updateProfile(
      prisma,
      request.get("authorization"),
      request.body || {},
    );
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] PUT /v1/profile failed", error);
    return response.status(500).json({ message: "Cannot update profile" });
  }
});

app.put("/v1/auth/change-password", async (request, response) => {
  try {
    const result = await changePassword(
      prisma,
      request.get("authorization"),
      request.body || {},
    );
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] PUT /v1/auth/change-password failed", error);
    return response.status(500).json({ message: "Cannot change password" });
  }
});

app.post("/v1/auth/phone/request-otp", async (request, response) => {
  try {
    const result = await requestPhoneOtp(
      prisma,
      request.get("authorization"),
      request.body || {},
    );
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] POST request OTP failed", error);
    return response.status(500).json({ message: "Cannot create phone OTP" });
  }
});

app.post("/v1/auth/phone/verify-otp", async (request, response) => {
  try {
    const result = await verifyPhoneOtp(
      prisma,
      request.get("authorization"),
      request.body || {},
    );
    return response.status(result.status).json(result.payload);
  } catch (error) {
    console.error("[identity-service] POST verify OTP failed", error);
    return response.status(500).json({ message: "Cannot verify phone OTP" });
  }
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`[identity-service] listening on port ${port}`);
});

const eventPublisher = createPublisher("identity-service");
const stopOutboxWorker = startOutboxWorker(prisma, eventPublisher);

const stopAuditConsumer = startConsumer({
  serviceName: "identity-service",
  queueName: process.env.IDENTITY_AUDIT_QUEUE || "identity-service.audit-events",
  bindings: ["audit.admin.action.requested"],
  handler: (event) => handleAdminAuditEvent(prisma, event),
});

async function shutdown(signal) {
  console.log(`[identity-service] received ${signal}, shutting down`);
  server.close(async () => {
    await stopOutboxWorker();
    await eventPublisher.close();
    await stopAuditConsumer();
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
