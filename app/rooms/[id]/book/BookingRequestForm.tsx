'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useInteraction } from '@/lib/hooks/useInteraction';

type BookingRequestFormProps = {
  roomId: string;
  isRoomFull?: boolean;
};

function addMonths(dateValue: string, months: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function getBookingErrorMessage(message: unknown) {
  if (typeof message !== 'string') {
    return 'Không thể gửi yêu cầu đặt phòng.';
  }

  if (message === 'Unauthorized') {
    return 'Vui lòng đăng nhập trước khi gửi yêu cầu đặt phòng.';
  }

  if (message === 'Room is not available') {
    return 'Phòng này hiện không khả dụng để đặt.';
  }

  if (message.includes('đã đủ')) {
    return 'Phòng đã đủ số người tối đa và không thể nhận thêm yêu cầu đặt phòng.';
  }

  if (message.includes('already booked')) {
    return 'Phòng này đã có yêu cầu đặt trong khoảng thời gian bạn chọn.';
  }

  if (message === 'Validation failed') {
    return 'Thông tin đặt phòng chưa hợp lệ. Vui lòng kiểm tra lại ngày chuyển đến.';
  }

  return message;
}

export function BookingRequestForm({ roomId, isRoomFull = false }: BookingRequestFormProps) {
  const { user, token, isLoading } = useAuth();
  const { logApply } = useInteraction({ userId: user?.id, roomId });
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [moveInDate, setMoveInDate] = useState(today);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    setFullName(user.fullName || user.name || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
  }, [user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      if (isRoomFull) {
        throw new Error('Phòng đã đủ số người tối đa và không thể nhận thêm yêu cầu đặt phòng.');
      }

      if (!user) {
        throw new Error('Vui lòng đăng nhập trước khi gửi yêu cầu đặt phòng.');
      }

      const authToken = token || localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          roomId,
          startDate: moveInDate,
          endDate: addMonths(moveInDate, 3),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const firstFieldError = payload?.errors ? Object.values(payload.errors).flat().at(0) : null;
        throw new Error(getBookingErrorMessage(payload?.message || payload?.error || firstFieldError));
      }

      // Log apply interaction when booking is successful
      logApply();

      setMessage('Yêu cầu đặt phòng đã được gửi. Quản trị viên sẽ liên hệ để xác nhận chi tiết.');
      setMoveInDate(today);
    } catch (err) {
      const fallback = 'Không thể gửi yêu cầu đặt phòng. Vui lòng đăng nhập và thử lại.';
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="px-1 text-[0.75rem] font-bold uppercase tracking-wider text-[#887365]" htmlFor="fullName">
            Họ và Tên
          </label>
          <input
            className="w-full rounded-xl border-none bg-[#e8e8ed] px-6 py-4 text-[#1a1c1f] outline-none transition-all duration-300 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#f28c38]"
            id="fullName"
            name="fullName"
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nguyễn Văn A"
            required
            type="text"
            value={fullName}
          />
          {isLoading && <p className="px-1 text-xs font-medium text-[#887365]">Đang tải thông tin tài khoản...</p>}
        </div>
        <div className="space-y-2">
          <label className="px-1 text-[0.75rem] font-bold uppercase tracking-wider text-[#887365]" htmlFor="email">
            Địa Chỉ Email
          </label>
          <input
            className="w-full rounded-xl border-none bg-[#e8e8ed] px-6 py-4 text-[#1a1c1f] outline-none transition-all duration-300 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#f28c38]"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nguyenvana@example.com"
            required
            type="email"
            value={email}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="px-1 text-[0.75rem] font-bold uppercase tracking-wider text-[#887365]" htmlFor="phone">
            Số Điện Thoại
          </label>
          <input
            className="w-full rounded-xl border-none bg-[#e8e8ed] px-6 py-4 text-[#1a1c1f] outline-none transition-all duration-300 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#f28c38]"
            id="phone"
            name="phone"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="090 000 0000"
            required
            type="tel"
            value={phone}
          />
        </div>
        <div className="space-y-2">
          <label className="px-1 text-[0.75rem] font-bold uppercase tracking-wider text-[#887365]" htmlFor="moveInDate">
            Ngày Chuyển Đến
          </label>
          <input
            className="w-full rounded-xl border-none bg-[#e8e8ed] px-6 py-4 text-[#1a1c1f] outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-[#f28c38]"
            id="moveInDate"
            min={today}
            name="moveInDate"
            onChange={(event) => setMoveInDate(event.target.value)}
            required
            type="date"
            value={moveInDate}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="px-1 text-[0.75rem] font-bold uppercase tracking-wider text-[#887365]" htmlFor="intro">
          Chia sẻ về bản thân bạn
        </label>
        <textarea
          className="w-full rounded-xl border-none bg-[#e8e8ed] px-6 py-4 text-[#1a1c1f] outline-none transition-all duration-300 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#f28c38]"
          id="intro"
          name="intro"
          placeholder="Bạn đang tìm kiếm điều gì ở một không gian sống chung?"
          rows={4}
        />
      </div>

      {message && (
        <div className="rounded-xl bg-green-50 px-5 py-4 text-sm font-semibold text-green-800" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-800" role="alert">
          {error}{' '}
          <Link className="underline underline-offset-4" href="/login">
            Đăng nhập
          </Link>
        </div>
      )}

      <button
        className="w-full rounded-full bg-gradient-to-r from-[#944a00] to-[#f28c38] py-5 text-sm font-bold uppercase tracking-[0.1em] text-white shadow-xl shadow-orange-900/20 transition-all hover:shadow-orange-900/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isSubmitting || isLoading || !user || isRoomFull}
        type="submit"
      >
        {isRoomFull ? 'Phòng đã đủ người' : isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi Yêu Cầu Đặt Chỗ'}
      </button>
    </form>
  );
}
