import Link from 'next/link';

type AuthPage = 'login' | 'register' | 'forgot-password' | 'reset-password';

export function AuthHeader({ page }: { page: AuthPage }) {
  const isLoginPage = page === 'login';
  const isRecoveryPage = page === 'forgot-password' || page === 'reset-password';

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-screen-2xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link
          href="/"
          className="shrink-0 font-headline text-xl font-extrabold tracking-tight text-orange-900"
        >
          NhàHợp
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
          <Link href="/" className="transition-colors hover:text-orange-700">
            Trang chủ
          </Link>
          <Link href="/rooms" className="transition-colors hover:text-orange-700">
            Danh sách phòng
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 lg:inline">
            {isRecoveryPage
              ? 'Đã nhớ mật khẩu?'
              : isLoginPage
                ? 'Chưa có tài khoản?'
                : 'Đã có tài khoản?'}
          </span>
          <Link
            href={isLoginPage ? '/register' : '/login'}
            className="rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-orange-800 transition-colors hover:bg-orange-100 sm:px-5"
          >
            {isLoginPage ? 'Đăng ký' : 'Đăng nhập'}
          </Link>
        </div>
      </div>
    </header>
  );
}
