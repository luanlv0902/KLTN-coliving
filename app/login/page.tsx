'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { AuthHeader } from '@/components/AuthHeader';
import { useAuth } from '@/lib/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : null;

      if (!response.ok) {
        setError(
          payload?.message ||
            `Không thể đăng nhập. Máy chủ trả về mã lỗi ${response.status}.`
        );
        return;
      }

      if (!payload?.token) {
        setError('Máy chủ không trả về phiên đăng nhập hợp lệ.');
        return;
      }

      await login(payload.token);

      if (payload.user?.role === 'ADMIN') {
        router.replace('/admin');
      } else if (payload.user?.role === 'COMMUNITY_MANAGER') {
        router.replace('/community-manager');
      } else if (payload.user?.role === 'HOST') {
        router.replace('/host');
      } else {
        router.replace('/');
      }
    } catch {
      setError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthHeader page="login" />
      <main className="flex min-h-screen flex-col overflow-hidden bg-white pt-16 md:flex-row">
        <section className="relative hidden min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-slate-950 p-12 md:flex md:w-1/2 lg:w-3/5 lg:p-24">
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Không gian sống chung ấm cúng"
              className="h-full w-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBfAu9icIgC2pau7CZT9KXd6v-pI7ev3PB8iSfvcdcZM2_8tnHhk8KP9e0he4yBOChavTyFeyriLkSAPv_VOCDwNfbb-2RiOi7S19hlx5JAbtM270wa1iIJOR0VMdxPgYLhcwpHxuXXiQtZUPmqWJb-40MxH1oyXpuIT88idIvZPFUbOoc2lp5nHsv4i_oAOtMxTCyaQbYQDcoy0KB9MD8AcJRDx8eQ8VvCticGo4qbR43ywRTHypFldeu4WZCc5DS0cydOzJrFOG8S"
            />
            <div className="absolute inset-0 bg-slate-950/55" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/65 to-slate-950/25" />
          </div>

          <div className="relative z-10 w-full max-w-2xl">
            <span className="mb-7 inline-block rounded-full bg-white/95 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700 shadow-sm">
              NhàHợp
            </span>
            <h1 className="max-w-xl font-headline text-5xl font-extrabold leading-[0.95] text-white drop-shadow-lg lg:text-7xl">
              Chào mừng
              <span className="mt-2 block text-orange-200">bạn trở lại</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg font-medium leading-relaxed text-white/90 drop-shadow-md lg:text-xl">
              Tiếp tục hành trình khám phá không gian sống phù hợp và kết nối với
              cộng đồng của bạn.
            </p>

            <div className="mt-12 grid grid-cols-2 gap-6">
              <div className="rounded-lg border border-white/50 bg-white/90 p-6 shadow-xl backdrop-blur-md">
                <ShieldCheck className="h-7 w-7 text-orange-600" />
                <h2 className="mt-4 font-headline font-bold text-slate-900">
                  Truy cập an toàn
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  Phiên đăng nhập và dữ liệu tài khoản luôn được bảo vệ.
                </p>
              </div>
              <div className="rounded-lg border border-white/50 bg-white/90 p-6 shadow-xl backdrop-blur-md">
                <Zap className="h-7 w-7 text-orange-600" />
                <h2 className="mt-4 font-headline font-bold text-slate-900">
                  Tiếp tục nhanh chóng
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  Truy cập ngay phòng yêu thích, booking và hợp đồng của bạn.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-20 md:px-12 lg:px-20">
          <div className="w-full max-w-lg">
            <header className="mb-9">
              <h2 className="font-headline text-4xl font-extrabold tracking-tight text-slate-950">
                Đăng nhập
              </h2>
              <p className="mt-2 leading-relaxed text-slate-600">
                Chào mừng bạn quay lại NhàHợp.
              </p>
            </header>

            <form className="space-y-6" onSubmit={handleLogin}>
              <label className="block space-y-1.5">
                <span className="ml-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Địa chỉ email
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="nguyenvanan@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isLoading}
                  className="h-14 w-full rounded-full border border-transparent bg-slate-100 px-6 text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Mật khẩu
                  </span>
                  <Link
                    href="/forgot-password"
                    className="text-[10px] font-bold uppercase tracking-wider text-orange-700 hover:underline"
                  >
                    Quên mật khẩu?
                  </Link>
                </span>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isLoading}
                  className="h-14 w-full rounded-full border border-transparent bg-slate-100 px-6 text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
                />
              </label>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-gradient-to-r from-orange-700 to-orange-500 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-orange-500/20 transition hover:from-orange-800 hover:to-orange-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                {!isLoading && <ArrowRight className="h-5 w-5" />}
              </button>
            </form>

            <p className="mt-8 border-t border-slate-200 pt-7 text-center text-sm text-slate-600">
              Chưa có tài khoản?{' '}
              <Link href="/register" className="font-bold text-orange-700 hover:underline">
                Đăng ký ngay
              </Link>
            </p>
          </div>

          <footer className="mt-12 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            © 2026 NhàHợp. Bảo lưu mọi quyền.
          </footer>
        </section>
      </main>
    </>
  );
}
