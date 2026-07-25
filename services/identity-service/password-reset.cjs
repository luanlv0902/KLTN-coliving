const bcrypt = require("bcrypt");
const crypto = require("node:crypto");
const { passwordResetDevMode, sendPasswordResetOtp } = require("./email-sender.cjs");

const GENERIC_REQUEST_MESSAGE =
  "Nếu email tồn tại, mã xác nhận đã được gửi đến hộp thư của bạn.";
const OTP_LIFETIME_MS = 10 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hashPasswordResetOtp(code) {
  const pepper = process.env.PASSWORD_RESET_PEPPER || process.env.JWT_SECRET;
  if (!pepper) throw new Error("PASSWORD_RESET_PEPPER or JWT_SECRET is required");
  return crypto.createHmac("sha256", pepper).update(code).digest("hex");
}

function validPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  );
}

async function requestPasswordReset(prisma, input, options = {}) {
  const email = normalizeEmail(input.email);
  if (!validEmail(email)) {
    return { status: 400, payload: { message: "Địa chỉ email không hợp lệ." } };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true },
  });
  const genericResult = { status: 200, payload: { message: GENERIC_REQUEST_MESSAGE } };

  if (!user || user.status !== "ACTIVE") return genericResult;

  const now = options.now || new Date();
  const recentOtp = await prisma.passwordResetOtp.findFirst({
    where: {
      userId: user.id,
      createdAt: { gt: new Date(now.getTime() - REQUEST_COOLDOWN_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recentOtp) return genericResult;

  const code = options.code || String(crypto.randomInt(100000, 1000000));
  await prisma.passwordResetOtp.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: now },
  });
  const otp = await prisma.passwordResetOtp.create({
    data: {
      userId: user.id,
      codeHash: hashPasswordResetOtp(code),
      expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS),
      createdAt: now,
    },
  });

  try {
    await (options.sendOtp || sendPasswordResetOtp)({ to: user.email, code });
  } catch (error) {
    await prisma.passwordResetOtp.delete({ where: { id: otp.id } }).catch(() => undefined);
    throw error;
  }

  return {
    status: 200,
    payload: {
      message: GENERIC_REQUEST_MESSAGE,
      ...(passwordResetDevMode() ? { devOtp: code } : {}),
    },
  };
}

async function confirmPasswordReset(prisma, input, options = {}) {
  const email = normalizeEmail(input.email);
  const code = typeof input.code === "string" ? input.code.trim() : "";
  const newPassword = input.newPassword;

  if (!validEmail(email) || !/^\d{6}$/.test(code)) {
    return { status: 400, payload: { message: "Email hoặc mã xác nhận không hợp lệ." } };
  }
  if (!validPassword(newPassword)) {
    return {
      status: 400,
      payload: { message: "Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số." },
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, password: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") {
    return { status: 400, payload: { message: "Mã xác nhận không hợp lệ hoặc đã hết hạn." } };
  }

  const now = options.now || new Date();
  const otp = await prisma.passwordResetOtp.findFirst({
    where: { userId: user.id, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    return { status: 400, payload: { message: "Mã xác nhận không hợp lệ hoặc đã hết hạn." } };
  }
  if (otp.attemptCount >= MAX_ATTEMPTS) {
    return { status: 429, payload: { message: "Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới." } };
  }

  const expectedHash = Buffer.from(otp.codeHash, "hex");
  const suppliedHash = Buffer.from(hashPasswordResetOtp(code), "hex");
  if (
    expectedHash.length !== suppliedHash.length ||
    !crypto.timingSafeEqual(expectedHash, suppliedHash)
  ) {
    await prisma.passwordResetOtp.update({
      where: { id: otp.id },
      data: { attemptCount: { increment: 1 } },
    });
    return { status: 400, payload: { message: "Mã xác nhận không chính xác." } };
  }
  if (await bcrypt.compare(newPassword, user.password)) {
    return { status: 400, payload: { message: "Mật khẩu mới phải khác mật khẩu hiện tại." } };
  }

  const password = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password } }),
    prisma.passwordResetOtp.update({ where: { id: otp.id }, data: { consumedAt: now } }),
    prisma.passwordResetOtp.updateMany({
      where: { userId: user.id, id: { not: otp.id }, consumedAt: null },
      data: { consumedAt: now },
    }),
  ]);

  return {
    status: 200,
    payload: { message: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới." },
  };
}

module.exports = {
  GENERIC_REQUEST_MESSAGE,
  confirmPasswordReset,
  hashPasswordResetOtp,
  normalizeEmail,
  requestPasswordReset,
  validPassword,
};
