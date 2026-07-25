"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { AuthHeader } from "@/components/AuthHeader";

type ResetResult = { message?: string; error?: string };

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError("Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), newPassword }),
      });
      const payload = (await response.json().catch(() => ({}))) as ResetResult;
      if (!response.ok) {
        setError(payload.message || payload.error || "Không thể đặt lại mật khẩu.");
        return;
      }
      setSuccess(payload.message || "Đặt lại mật khẩu thành công.");
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <AuthHeader page="reset-password" />
      <main className="min-h-screen bg-slate-50 px-6 pb-16 pt-28">
        <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-10 shadow-xl shadow-slate-900/5">
          <Link href="/forgot-password" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-orange-700">
            <ArrowLeft className="h-4 w-4" />
            Yêu cầu mã khác
          </Link>

          {success ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
              <h1 className="mt-5 text-3xl font-extrabold text-slate-950">Mật khẩu đã được cập nhật</h1>
              <p className="mx-auto mt-3 max-w-lg text-slate-600">{success}</p>
              <Link href="/login" className="mt-8 inline-flex h-12 items-center rounded-full bg-orange-600 px-7 font-bold text-white hover:bg-orange-700">
                Đăng nhập ngay
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-7 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <h1 className="mt-5 text-3xl font-extrabold text-slate-950">Tạo mật khẩu mới</h1>
              <p className="mt-2 text-slate-600">Nhập mã 6 số trong email và chọn mật khẩu mới cho tài khoản.</p>

              <form className="mt-8 grid grid-cols-2 gap-5" onSubmit={handleSubmit}>
                <label className="col-span-2 block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Địa chỉ email</span>
                  <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-13 w-full rounded-lg border border-slate-200 bg-slate-50 px-5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </label>
                <label className="col-span-2 block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Mã xác nhận</span>
                  <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" className="h-13 w-full rounded-lg border border-slate-200 bg-slate-50 px-5 text-center text-xl font-bold tracking-[0.35em] outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Mật khẩu mới</span>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} required autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-13 w-full rounded-lg border border-slate-200 bg-slate-50 px-5 pr-12 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                    <button type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Xác nhận mật khẩu</span>
                  <input type={showPassword ? "text" : "password"} required autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-13 w-full rounded-lg border border-slate-200 bg-slate-50 px-5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </label>

                <p className="col-span-2 text-sm text-slate-500">Tối thiểu 8 ký tự, bao gồm ít nhất một chữ cái và một chữ số.</p>
                {error && <div className="col-span-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
                <button type="submit" disabled={isLoading} className="col-span-2 h-14 rounded-full bg-orange-600 font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {isLoading ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </>
  );
}
