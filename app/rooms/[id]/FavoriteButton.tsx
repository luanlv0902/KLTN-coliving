'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useInteraction } from '@/lib/hooks/useInteraction';

type FavoriteButtonProps = {
  roomId: string;
};

export function FavoriteButton({ roomId }: FavoriteButtonProps) {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const [favorited, setFavorited] = useState(false);
  const [pending, setPending] = useState(false);
  const { logSave } = useInteraction({ userId: user?.id, roomId });

  useEffect(() => {
    if (isLoading || !user) {
      setFavorited(false);
      return;
    }

    const controller = new AbortController();
    const authToken = token || localStorage.getItem('token');

    const fetchFavoriteStatus = async () => {
      try {
        const headers: HeadersInit = {};
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        }

        const response = await fetch(`/api/favorites/${roomId}`, {
          headers,
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) return;

        const payload = await response.json();
        setFavorited(Boolean(payload?.data?.favorited));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Không thể tải trạng thái yêu thích:', error);
      }
    };

    fetchFavoriteStatus();

    return () => controller.abort();
  }, [isLoading, roomId, token, user]);

  async function toggleFavorite() {
    if (!user) {
      router.push('/login');
      return;
    }

    const nextFavorited = !favorited;
    const previousFavorited = favorited;
    const authToken = token || localStorage.getItem('token');

    setPending(true);
    setFavorited(nextFavorited);

    try {
      const headers: HeadersInit = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await fetch(`/api/favorites/${roomId}`, {
        method: nextFavorited ? 'POST' : 'DELETE',
        headers,
        credentials: 'include',
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Không thể cập nhật yêu thích.');
      }

      setFavorited(Boolean(payload?.data?.favorited));

      // Log save interaction when user favorites a room
      if (nextFavorited) {
        logSave();
      }
    } catch (error) {
      setFavorited(previousFavorited);
      console.error('Không thể cập nhật yêu thích:', error);
      alert('Không thể cập nhật yêu thích. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      aria-label={favorited ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
      aria-pressed={favorited}
      className={`rounded-full bg-white p-3 shadow-sm transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-70 ${
        favorited ? 'text-red-500' : 'text-slate-900'
      }`}
      disabled={isLoading || pending}
      onClick={toggleFavorite}
      title={favorited ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
      type="button"
    >
      <span
        className="material-symbols-outlined"
        style={{ fontVariationSettings: favorited ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" : undefined }}
      >
        favorite
      </span>
    </button>
  );
}
