'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ChevronDown,
  Cigarette,
  LocateFixed,
  MapPin,
  PawPrint,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useInteraction } from '@/lib/hooks/useInteraction';

interface Room {
  id: string;
  title: string;
  description: string;
  address: string;
  district?: string | null;
  city?: string | null;
  price: number;
  priceText?: string | null;
  area: string;
  areaText?: string | null;
  image?: string | string[];
  images?: { url: string }[];
  status: string;
  currentOccupants?: number | null;
  maxOccupants?: number | null;
  distanceKm?: number | null;
  owner?: {
    name: string;
    fullName: string;
  } | null;
}

function firstImage(room: Room) {
  return room.images?.[0]?.url || (Array.isArray(room.image) ? room.image[0] : room.image) || '';
}

function AreaText({ value }: { value: string }) {
  const normalizedValue = value || 'Đang cập nhật';
  const match = normalizedValue.match(/^(.*?)(m)\s*2\b(.*)$/i);

  if (!match) {
    return <>{normalizedValue}</>;
  }

  return (
    <>
      {match[1]}
      {match[2]}
      <sup className="text-[0.65em] leading-none">2</sup>
      {match[3]}
    </>
  );
}

function RoomCard({ room, userId }: { room: Room; userId?: string }) {
  const imageUrl = firstImage(room);
  const price = room.priceText || (room.price ? `${room.price.toLocaleString('vi-VN')} đ/tháng` : 'Liên hệ');
  const area = room.areaText || room.area;
  const ownerName = room.owner?.fullName || room.owner?.name || 'Phongtro123';
  const currentOccupants = Math.max(0, room.currentOccupants ?? 0);
  const maxOccupants = room.maxOccupants ?? 0;
  const isFull = maxOccupants > 0 && currentOccupants >= maxOccupants;
  const availabilityLabel = isFull || room.status === 'OCCUPIED'
    ? 'Đã đủ người'
    : room.status === 'AVAILABLE'
      ? 'Còn trống'
      : 'Tạm ẩn';
  const availabilityClass = isFull || room.status === 'OCCUPIED'
    ? 'bg-slate-900/90 text-white'
    : 'bg-white/90 text-orange-600';

  const { logImpression, logClick } = useInteraction({ userId, roomId: room.id });

  useEffect(() => {
    // Log impression when card is visible
    logImpression();
  }, [logImpression]);

  const handleClick = () => {
    logClick();
  };

  return (
    <article className="group flex h-full flex-col" onClick={handleClick}>
      <div className="relative mb-4 aspect-[4/5] overflow-hidden rounded-xl bg-gray-200">
        <img
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          src={imageUrl || 'https://via.placeholder.com/400x500?text=Room'}
          alt={room.title}
        />
        <div className={`absolute left-4 top-4 rounded-full px-3 py-1.5 text-xs font-bold backdrop-blur ${availabilityClass}`}>
          {availabilityLabel}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="mb-3 flex-1">
          <h3 className="line-clamp-2 text-lg font-bold tracking-tight text-gray-900 transition-colors group-hover:text-orange-600">
            {room.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-600">
            {room.address}
          </p>
          {room.distanceKm != null && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-sky-700">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Cách vị trí của bạn khoảng {room.distanceKm.toFixed(1)} km
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-gray-200 pt-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-black text-orange-600">{price}</p>
              <p className="text-[10px] font-bold uppercase text-gray-500">Giá thuê</p>
            </div>
            <div className="text-right text-sm font-semibold text-gray-700">
              <AreaText value={area} />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
              {ownerName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-gray-600">{ownerName}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPaginationItems(page: number, totalPages: number) {
  if (totalPages <= 8) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const visiblePages = new Set([1, 2, totalPages, page - 1, page, page + 1]);
  const pages = Array.from(visiblePages)
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((first, second) => first - second);

  return pages.flatMap((item, index) => {
    const previous = pages[index - 1];

    if (previous && item - previous > 1) {
      return [`ellipsis-${previous}-${item}`, item];
    }

    return [item];
  });
}

function PaginationControls({ page, totalPages, onPageChange }: PaginationControlsProps) {
  const paginationItems = getPaginationItems(page, totalPages);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="min-h-9 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 transition-colors hover:border-orange-500 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Chuyển đến trang trước"
      >
        Trang trước
      </button>
      {paginationItems.map((item) =>
        typeof item === 'number' ? (
          <button
            key={item}
            className={`flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-bold transition-colors ${
              item === page
                ? 'border-orange-600 bg-orange-600 text-white'
                : 'border-gray-300 text-gray-700 hover:border-orange-500 hover:text-orange-600'
            }`}
            onClick={() => onPageChange(item)}
            aria-current={item === page ? 'page' : undefined}
            aria-label={`Chuyển đến trang ${item}`}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="flex h-9 min-w-9 items-center justify-center text-sm font-bold text-gray-400">
            ...
          </span>
        ),
      )}
      <button
        className="min-h-9 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 transition-colors hover:border-orange-500 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Chuyển đến trang sau"
      >
        Trang sau
      </button>
    </div>
  );
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [location, setLocation] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [requiredSlots, setRequiredSlots] = useState('');
  const [maxDistanceKm, setMaxDistanceKm] = useState('');
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [showLifestyleFilters, setShowLifestyleFilters] = useState(false);
  const [allowPets, setAllowPets] = useState(false);
  const [smokingPolicy, setSmokingPolicy] = useState('');
  const [cleanlinessRequired, setCleanlinessRequired] = useState('');
  const [noiseTolerance, setNoiseTolerance] = useState('');
  const [guestPolicy, setGuestPolicy] = useState('');
  const [preferredSleepHabit, setPreferredSleepHabit] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queryReady, setQueryReady] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const limit = 12;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Get userId from localStorage or session
  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setLocation(params.get('location') || '');
    setMaxPrice(params.get('maxPrice') || '');
    setRequiredSlots(params.get('minAvailableSlots') || '');
    setQueryReady(true);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    location,
    sortBy,
    minPrice,
    maxPrice,
    requiredSlots,
    maxDistanceKm,
    origin,
    allowPets,
    smokingPolicy,
    cleanlinessRequired,
    noiseTolerance,
    guestPolicy,
    preferredSleepHabit,
  ]);

  useEffect(() => {
    if (!queryReady) return;

    const fetchRooms = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          sortBy,
        });

        if (searchTerm.trim()) params.set('search', searchTerm.trim());
        if (location.trim()) params.set('location', location.trim());
        if (minPrice) params.set('minPrice', minPrice);
        if (maxPrice) params.set('maxPrice', maxPrice);
        if (requiredSlots) params.set('minAvailableSlots', requiredSlots);
        if (origin && maxDistanceKm) {
          params.set('originLat', origin.lat.toString());
          params.set('originLng', origin.lng.toString());
          params.set('maxDistanceKm', maxDistanceKm);
        }
        if (allowPets) params.set('allowPets', 'true');
        if (smokingPolicy) params.set('allowSmoking', smokingPolicy);
        if (cleanlinessRequired) params.set('cleanlinessRequired', cleanlinessRequired);
        if (noiseTolerance) params.set('noiseTolerance', noiseTolerance);
        if (guestPolicy) params.set('guestPolicy', guestPolicy);
        if (preferredSleepHabit) params.set('preferredSleepHabit', preferredSleepHabit);

        const response = await fetch(`/api/rooms?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch rooms');

        const payload = await response.json();
        setRooms(payload.data?.rooms || []);
        setTotal(payload.data?.total || 0);
      } catch (err) {
        console.error('Error fetching rooms:', err);
        setError('Không thể tải danh sách phòng');
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, [
    page,
    searchTerm,
    location,
    sortBy,
    minPrice,
    maxPrice,
    requiredSlots,
    maxDistanceKm,
    origin,
    allowPets,
    smokingPolicy,
    cleanlinessRequired,
    noiseTolerance,
    guestPolicy,
    preferredSleepHabit,
    queryReady,
  ]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Trình duyệt không hỗ trợ xác định vị trí.');
      return;
    }

    setIsLocating(true);
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setOrigin({ lat: coords.latitude, lng: coords.longitude });
        setMaxDistanceKm((current) => current || '5');
        setLocationMessage('Đã sử dụng vị trí hiện tại để tính khoảng cách.');
        setIsLocating(false);
      },
      () => {
        setLocationMessage('Không thể lấy vị trí. Hãy cấp quyền vị trí cho trình duyệt.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const resetFilters = () => {
    setSearchTerm('');
    setLocation('');
    setSortBy('newest');
    setMinPrice('');
    setMaxPrice('');
    setRequiredSlots('');
    setMaxDistanceKm('');
    setOrigin(null);
    setLocationMessage(null);
    setAllowPets(false);
    setSmokingPolicy('');
    setCleanlinessRequired('');
    setNoiseTolerance('');
    setGuestPolicy('');
    setPreferredSleepHabit('');
  };

  return (
    <>
      <Navigation />
      <main className="mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden px-4 pb-20 pt-24 sm:px-8">
        <section aria-label="Bộ lọc tìm phòng" className="mb-8 w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_220px]">
            <label className="relative block min-w-0">
              <span className="sr-only">Tìm theo tên phòng</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                placeholder="Tên phòng, mô tả hoặc địa chỉ"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </label>

            <label className="relative block min-w-0">
              <span className="sr-only">Vị trí địa lý</span>
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                placeholder="Tỉnh/thành, phường/xã, khu vực"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </label>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              aria-label="Sắp xếp danh sách phòng"
            >
              <option value="newest">Mới nhất</option>
              {origin && <option value="distance">Gần vị trí của tôi</option>}
              <option value="price-low">Giá thấp đến cao</option>
              <option value="price-high">Giá cao đến thấp</option>
              <option value="area-large">Diện tích lớn nhất</option>
            </select>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Giá từ</span>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="500000"
                  placeholder="0"
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 pr-8 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">đ</span>
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Giá đến</span>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="500000"
                  placeholder="Không giới hạn"
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 pr-8 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">đ</span>
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <Users className="h-3.5 w-3.5" aria-hidden="true" /> Số chỗ cần
              </span>
              <select
                value={requiredSlots}
                onChange={(event) => setRequiredSlots(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              >
                <option value="">Không giới hạn</option>
                <option value="1">Còn ít nhất 1 chỗ</option>
                <option value="2">Còn ít nhất 2 chỗ</option>
                <option value="3">Còn ít nhất 3 chỗ</option>
                <option value="4">Còn ít nhất 4 chỗ</option>
              </select>
            </label>

            <div>
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Vị trí của bạn</span>
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={isLocating}
                className={`flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
                  origin
                    ? 'border-sky-300 bg-sky-50 text-sky-700'
                    : 'border-slate-300 text-slate-700 hover:border-orange-400 hover:text-orange-600'
                }`}
              >
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
                {isLocating ? 'Đang xác định...' : origin ? 'Đã xác định vị trí' : 'Dùng vị trí hiện tại'}
              </button>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Bán kính di chuyển</span>
              <select
                value={maxDistanceKm}
                onChange={(event) => setMaxDistanceKm(event.target.value)}
                disabled={!origin}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">Không giới hạn</option>
                <option value="2">Trong 2 km</option>
                <option value="5">Trong 5 km</option>
                <option value="10">Trong 10 km</option>
                <option value="20">Trong 20 km</option>
                <option value="50">Trong 50 km</option>
              </select>
            </label>
          </div>

          {locationMessage && (
            <p className={`mt-2 text-xs font-medium ${origin ? 'text-sky-700' : 'text-rose-600'}`} role="status">
              {locationMessage}
            </p>
          )}

          <div className="mt-4 flex flex-col items-stretch justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setShowLifestyleFilters((current) => !current)}
              className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-bold text-slate-700 transition hover:text-orange-600"
              aria-expanded={showLifestyleFilters}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Điều kiện sinh hoạt
              <ChevronDown className={`h-4 w-4 transition-transform ${showLifestyleFilters ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-orange-600 sm:justify-end"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Xóa bộ lọc
            </button>
          </div>

          {showLifestyleFilters && (
            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:border-orange-300">
                <input
                  type="checkbox"
                  checked={allowPets}
                  onChange={(event) => setAllowPets(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <PawPrint className="h-4 w-4 text-orange-500" aria-hidden="true" /> Cho phép thú cưng
              </label>

              <label className="relative block">
                <Cigarette className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <select
                  value={smokingPolicy}
                  onChange={(event) => setSmokingPolicy(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  aria-label="Quy định hút thuốc"
                >
                  <option value="">Mọi quy định hút thuốc</option>
                  <option value="false">Không cho phép hút thuốc</option>
                  <option value="true">Cho phép hút thuốc</option>
                </select>
              </label>

              <select value={cleanlinessRequired} onChange={(event) => setCleanlinessRequired(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" aria-label="Yêu cầu vệ sinh">
                <option value="">Mọi mức độ vệ sinh</option>
                <option value="low">Thoải mái</option>
                <option value="medium">Gọn gàng vừa phải</option>
                <option value="high">Ưu tiên sạch sẽ cao</option>
              </select>

              <select value={noiseTolerance} onChange={(event) => setNoiseTolerance(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" aria-label="Mức độ tiếng ồn">
                <option value="">Mọi mức độ tiếng ồn</option>
                <option value="quiet">Không gian yên tĩnh</option>
                <option value="moderate">Sinh hoạt vừa phải</option>
                <option value="active">Không khí sôi động</option>
              </select>

              <select value={guestPolicy} onChange={(event) => setGuestPolicy(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" aria-label="Quy định tiếp khách">
                <option value="">Mọi quy định tiếp khách</option>
                <option value="no_guests">Không tiếp khách</option>
                <option value="occasionally">Thỉnh thoảng tiếp khách</option>
                <option value="frequently">Thường xuyên tiếp khách</option>
              </select>

              <select value={preferredSleepHabit} onChange={(event) => setPreferredSleepHabit(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" aria-label="Lịch sinh hoạt">
                <option value="">Mọi lịch sinh hoạt</option>
                <option value="early">Dậy sớm</option>
                <option value="normal">Giờ giấc tiêu chuẩn</option>
                <option value="late">Thức khuya</option>
              </select>
            </div>
          )}
        </section>

        {loading ? (
          <div className="py-20 text-center">
            <h3 className="text-xl font-semibold text-gray-900">Đang tải danh sách phòng...</h3>
          </div>
        ) : error ? (
          <div className="py-20 text-center">
            <h3 className="text-xl font-semibold text-gray-900">{error}</h3>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-900">{total} phòng tìm thấy</h2>
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>

            {rooms.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {rooms.map((room) => (
                    <Link key={room.id} href={`/rooms/${room.id}`} className="block">
                      <RoomCard room={room} userId={userId} />
                    </Link>
                  ))}
                </div>
                <div className="mt-10 flex justify-center">
                  <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </div>
              </>
            ) : (
              <div className="py-20 text-center">
                <h3 className="mb-2 text-xl font-semibold text-gray-900">Không tìm thấy phòng</h3>
                <p className="text-gray-600">Thử điều chỉnh vị trí, khoảng giá hoặc điều kiện sinh hoạt.</p>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
