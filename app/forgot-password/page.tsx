import type { Metadata } from "next";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Quên mật khẩu",
  description: "Yêu cầu mã xác nhận để đặt lại mật khẩu NhàHợp.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
