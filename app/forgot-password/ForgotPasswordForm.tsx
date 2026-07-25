"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { AuthHeader } from "@/components/AuthHeader";

type RequestResult = { message?: string; error?: string; devOtp?: string };

export default function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [devOtp, setDevOtp] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setDevOtp("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as RequestResult;
      if (!response.ok) {
        setError(payload.message || payload.error || "Không thể gửi mã xác nhận.");
        return;
      }

      setMessage(payload.message || "Hãy kiểm tra hộp thư để lấy mã xác nhận.");
      setDevOtp(payload.devOtp || "");
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  }

  function continueToReset() {
    router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
  }

  return (
    <>
      <AuthHeader page="forgot-password" />
      <main className="min-h-screen bg-slate-50 px-6 pb-16 pt-28">
        <div className="mx-auto grid max-w-5xl grid-cols-[0.9fr_1.1fr] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
          <section className="flex flex-col justify-between bg-slate-950 p-12 text-white">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500 text-white">
                <KeyRound className="h-6 w-6" />
              </div>
              <h1 className="mt-8 text-4xl font-extrabold leading-tight">Khôi phục quyền truy cập</h1>
              <p className="mt-4 leading-relaxed text-slate-300">
                NhàHợp sẽ gửi mã xác nhận một lần đến email đã đăng ký của bạn.
              </p>
            </div>
            <div className="mt-16 flex items-start gap-3 border-t border-slate-700 pt-6 text-sm text-slate-300">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <p>Mã chỉ có hiệu lực trong 10 phút và không thể sử dụng lại.</p>
            </div>
          </section>

          <section className="p-12">
            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-orange-700">
              <ArrowLeft className="h-4 w-4" />
              Quay lại đăng nhập
            </Link>
            <h2 className="mt-8 text-3xl font-extrabold text-slate-950">Quên mật khẩu</h2>
            <p className="mt-2 text-slate-600">Nhập email bạn dùng để đăng nhập NhàHợp.</p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Địa chỉ email</span>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isLoading || Boolean(message)}
                    placeholder="ban@example.com"
                    className="h-14 w-full rounded-lg border border-slate-200 bg-slate-50 pl-14 pr-5 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </label>

              {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
              {message && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <p className="font-semibold">{message}</p>
                  {devOtp && <p className="mt-2">Mã OTP môi trường phát triển: <strong className="tracking-widest">{devOtp}</strong></p>}
                </div>
              )}

              {!message ? (
                <button type="submit" disabled={isLoading} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-orange-600 font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {isLoading ? "Đang gửi mã..." : "Gửi mã xác nhận"}
                  {!isLoading && <ArrowRight className="h-5 w-5" />}
                </button>
              ) : (
                <button type="button" onClick={continueToReset} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-slate-950 font-bold text-white transition hover:bg-slate-800">
                  Nhập mã và mật khẩu mới
                  <ArrowRight className="h-5 w-5" />
                </button>
              )}
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
