const nodemailer = require("nodemailer");

function emailConfigurationAvailable() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_APP_PASSWORD);
}

function passwordResetDevMode() {
  return process.env.NODE_ENV !== "production" || process.env.PASSWORD_RESET_DEV_MODE === "true";
}

async function sendPasswordResetOtp({ to, code }) {
  if (!emailConfigurationAvailable()) {
    if (!passwordResetDevMode()) {
      throw new Error("Gmail SMTP is not configured for password reset emails");
    }
    return { delivered: false };
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM || `NhàHợp <${process.env.SMTP_USER}>`,
    to,
    subject: "Mã đặt lại mật khẩu NhàHợp",
    text: `Mã xác nhận đặt lại mật khẩu NhàHợp của bạn là ${code}. Mã có hiệu lực trong 10 phút.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <h1 style="font-size:24px">Đặt lại mật khẩu NhàHợp</h1>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu. Mã xác nhận của bạn là:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#c2410c">${code}</p>
        <p>Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.</p>
        <p style="color:#64748b">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
      </div>
    `,
  });

  return { delivered: true };
}

module.exports = { emailConfigurationAvailable, passwordResetDevMode, sendPasswordResetOtp };
