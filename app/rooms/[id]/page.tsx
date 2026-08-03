import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import {
  getPublicRoomById,
  type PublicRoomDetail,
} from '@/lib/services/property-gateway.server';
import { RoommatesSection } from '../components/RoommatesSection';
import { RoomCompatibility } from './components/RoomCompatibility';
import { RoomReviews } from './components/RoomReviews';
import { RoomGallery } from './components/RoomGallery';
import { FavoriteButton } from './FavoriteButton';
import { cookies } from 'next/headers';
import RoomMapView from "@/components/maps/RoomMapView";
import { RoomDetailInteractionLogger } from './RoomDetailInteractionLogger';
type RoomDetail = PublicRoomDetail;
type RoomOwner = NonNullable<RoomDetail['owner']>;
type RoomAmenityItem = {
  amenity?: {
    id: string;
    name: string;
  } | null;
};
type OccupancyInfo = {
  current: number;
  max: number;
  reserved: number;
  available: number;
  percentage: number;
  label: string;
  tone: 'available' | 'limited' | 'full';
};

function getImageUrls(room: RoomDetail) {
  const fromImages = room.images?.map((image: { url: string }) => image.url) || [];
  const fromAlias = Array.isArray(room.image) ? room.image : room.image ? [room.image] : [];
  return Array.from(new Set([...fromImages, ...fromAlias])).filter(Boolean);
}

function getGoogleMapsUrl(room: RoomDetail) {
  if (typeof room.latitude === 'number' && typeof room.longitude === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${room.latitude},${room.longitude}`;
  }

  if (room.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(room.address)}`;
  }

  return null;
}

function getPostedDateText(room: RoomDetail) {
  if (room.posted_date?.trim()) {
    return room.posted_date.trim();
  }

  const createdAt = room.createdAt instanceof Date ? room.createdAt : new Date(room.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(createdAt);
}

function getOccupancyInfo(room: RoomDetail): OccupancyInfo | null {
  const maxOccupants = Number(room.maxOccupants ?? 0);
  const currentOccupants = Number(room.currentOccupants ?? 0);
  const confirmedReservations = Number(room.confirmedReservations ?? 0);

  if (!Number.isFinite(maxOccupants) || maxOccupants <= 0) {
    return null;
  }

  const current = Math.min(maxOccupants, Math.max(0, currentOccupants));
  const reserved = Math.max(0, confirmedReservations);
  const used = Math.min(maxOccupants, current + reserved);
  const available = Math.max(0, maxOccupants - used);
  const percentage = Math.round((used / maxOccupants) * 100);
  const tone = available === 0 ? 'full' : available <= 1 ? 'limited' : 'available';

  return {
    current,
    max: maxOccupants,
    reserved,
    available,
    percentage,
    tone,
    label: available === 0 ? 'Đã đủ người' : `Còn ${available} chỗ trống`,
  };
}

function AmenityIcon({ name }: { name: string }) {
  const lowerName = name.toLowerCase();
  let icon = 'home';

  if (lowerName.includes('wifi')) icon = 'wifi';
  else if (lowerName.includes('máy lạnh')) icon = 'ac_unit';
  else if (lowerName.includes('máy giặt')) icon = 'local_laundry_service';
  else if (lowerName.includes('tủ lạnh')) icon = 'kitchen';
  else if (lowerName.includes('bếp')) icon = 'countertops';
  else if (lowerName.includes('xe')) icon = 'garage_home';
  else if (lowerName.includes('gác')) icon = 'stairs';
  else if (lowerName.includes('thang máy')) icon = 'elevator';
  else if (lowerName.includes('giờ')) icon = 'schedule';

  return <span className="material-symbols-outlined text-3xl text-orange-700">{icon}</span>;


}

function SectionHeading({
  icon,
  label,
  title,
}: {
  icon: string;
  label?: string;
  title: string;
}) {
  return (
    <div className="space-y-2">
      {label && (
        <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">
          {label}
        </p>
      )}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 text-orange-700 shadow-sm ring-1 ring-orange-100">
          <span className="material-symbols-outlined block translate-y-px text-2xl leading-none">
            {icon}
          </span>
        </span>
        <div>
          <h2 className="bg-gradient-to-r from-slate-950 via-orange-900 to-slate-700 bg-clip-text text-2xl font-black tracking-tight text-transparent md:text-3xl">
            {title}
          </h2>
          <div className="mt-2 h-1 w-16 rounded-full bg-gradient-to-r from-orange-600 to-amber-300" />
        </div>
      </div>
    </div>
  );
}

function HostProfileCard({ owner }: { owner?: RoomOwner | null }) {
  if (!owner) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <span className="material-symbols-outlined text-2xl">person</span>
        </div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-700">Chủ nhà</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">Thông tin đang được cập nhật</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Hồ sơ người đăng sẽ được bổ sung sau khi hoàn tất xác minh.
        </p>
      </div>
    );
  }

  const displayName = owner.fullName?.trim() || owner.name?.trim() || 'Chủ nhà';
  const initial = displayName.charAt(0).toLocaleUpperCase('vi-VN');
  const joinedAt = owner.createdAt instanceof Date ? owner.createdAt : new Date(owner.createdAt);
  const joinedYear = Number.isNaN(joinedAt.getTime()) ? null : joinedAt.getFullYear();
  const phone = owner.phone?.trim();
  const email = owner.email?.trim();

  return (
    <div className="overflow-hidden rounded-xl border border-orange-100 bg-white shadow-lg shadow-slate-900/5">
      <div className="border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-700">Thông tin chủ nhà</p>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-4">
          {owner.avatarUrl ? (
            <img
              src={owner.avatarUrl}
              alt={`Ảnh đại diện của ${displayName}`}
              className="h-16 w-16 shrink-0 rounded-full object-cover ring-4 ring-orange-50"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-orange-100 text-2xl font-black text-orange-800 ring-4 ring-orange-50">
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black text-slate-950">{displayName}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Chủ nhà của phòng này</p>
            {owner.phoneVerified && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                <span className="material-symbols-outlined text-sm">verified</span>
                Đã xác minh điện thoại
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/70 px-4">
          <div className="flex items-start gap-3 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <span className="material-symbols-outlined text-xl">phone_iphone</span>
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Số điện thoại</p>
              {phone ? (
                <a href={`tel:${phone}`} className="mt-1 block font-black text-slate-950 hover:text-orange-700">
                  {phone}
                </a>
              ) : (
                <p className="mt-1 text-sm font-semibold text-slate-500">Chưa cập nhật</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
              <span className="material-symbols-outlined text-xl">mail</span>
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Email</p>
              {email ? (
                <a href={`mailto:${email}`} className="mt-1 block break-all text-xs font-bold leading-5 text-slate-950 hover:text-orange-700">
                  {email}
                </a>
              ) : (
                <p className="mt-1 text-sm font-semibold text-slate-500">Chưa cập nhật</p>
              )}
            </div>
          </div>
        </div>

        {joinedYear && (
          <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-5 text-sm font-semibold text-slate-500">
            <span className="material-symbols-outlined text-xl text-orange-700">calendar_month</span>
            Thành viên từ năm {joinedYear}
          </div>
        )}

        {(phone || email) && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-700 px-3 text-sm font-black text-white transition-colors hover:bg-orange-800"
              >
                <span className="material-symbols-outlined text-lg">call</span>
                Gọi điện
              </a>
            ) : <span />}
            {email && (
              <a
                href={`mailto:${email}`}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 transition-colors hover:border-orange-200 hover:bg-orange-50"
              >
                <span className="material-symbols-outlined text-lg">mail</span>
                Gửi email
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getRequirementIcon(key: string, value?: string | boolean): string {
  switch (key) {
    case 'cleanlinessRequired':
      return value === 'high' ? 'sparkles' : value === 'medium' ? 'cleaning_services' : 'cleaning_bucket';
    case 'noiseTolerance':
      return value === 'quiet' ? 'volume_down' : value === 'active' ? 'volume_up' : 'volume_mute';
    case 'guestPolicy':
      return value === 'no_guests' ? 'no_luggage' : value === 'frequently' ? 'party_mode' : 'home_repair_service';
    case 'preferredSleepHabit':
      return value === 'early' ? 'wb_sunny' : value === 'late' ? 'nightlight' : 'bedtime';
    case 'maxOccupants':
      return 'supervisor_account';
    case 'allowSmoking':
      return value ? 'smoking_rooms' : 'smoke_free';
    case 'allowPets':
      return value ? 'pets' : 'pets';
    default:
      return 'info';
  }
}
function RoomRequirements({ room }: { room: RoomDetail }) {
  const requirements: Array<{ label: string; value?: string; iconKey: string }> = [];

  if (room.cleanlinessRequired) {
    const cleanlinessMap: Record<string, string> = {
      low: 'Không quá nghiêm ngặt',
      medium: 'Sạch sẽ thường xuyên',
      high: 'Rất sạch sẽ',
    };
    requirements.push({
      label: 'Yêu cầu sạch sẽ',
      value: cleanlinessMap[room.cleanlinessRequired],
      iconKey: getRequirementIcon('cleanlinessRequired', room.cleanlinessRequired),
    });
  }

  if (room.noiseTolerance) {
    const noiseMap: Record<string, string> = {
      low: 'Yêu cầu yên tĩnh',
      medium: 'Chấp nhận tiếng ồn bình thường',
      high: 'Cộng đồng sôi động',
    };
    requirements.push({
      label: 'Độ ồn',
      value: noiseMap[room.noiseTolerance],
      iconKey: getRequirementIcon('noiseTolerance', room.noiseTolerance),
    });
  }

  if (room.guestPolicy) {
    const guestMap: Record<string, string> = {
      rarely: 'Không cho khách qua đêm',
      occasionally: 'Cho khách thỉnh thoảng',
      frequently: 'Thường xuyên có khách',
    };
    requirements.push({
      label: 'Chính sách khách',
      value: guestMap[room.guestPolicy],
      iconKey: getRequirementIcon('guestPolicy', room.guestPolicy),
    });
  }

  if (room.preferredSleepHabit) {
    const sleepMap: Record<string, string> = {
      early: 'Thức sớm (6-8h)',
      normal: 'Giờ thường (8-10h)',
      late: 'Thức khuya (10h+)',
    };
    requirements.push({
      label: 'Thói quen ngủ',
      value: sleepMap[room.preferredSleepHabit],
      iconKey: getRequirementIcon('preferredSleepHabit', room.preferredSleepHabit),
    });
  }

  if (room.maxOccupants) {
    requirements.push({
      label: 'Số người tối đa',
      value: `${room.maxOccupants} người`,
      iconKey: getRequirementIcon('maxOccupants'),
    });
  }

  if (typeof room.allowSmoking === 'boolean') {
    requirements.push({
      label: 'Hút thuốc',
      value: room.allowSmoking ? 'Cho phép' : 'Không cho phép',
      iconKey: getRequirementIcon('allowSmoking', room.allowSmoking),
    });
  }

  if (typeof room.allowPets === 'boolean') {
    requirements.push({
      label: 'Thú cưng',
      value: room.allowPets ? 'Cho phép' : 'Không cho phép',
      iconKey: getRequirementIcon('allowPets', room.allowPets),
    });
  }

  if (requirements.length === 0) return null;

  return (
    <div className="space-y-6">
      <SectionHeading icon="rule" label="Quy chuẩn lưu trú" title="Yêu cầu phòng & Chính sách" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {requirements.map((req, idx) => (
          <div 
            key={idx} 
            className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 p-4 border border-slate-200"
          >
            <div className="mb-2 flex items-center gap-2">
              {/* Render icon bằng Material Symbols giống AmenityIcon */}
              <span className="material-symbols-outlined text-2xl text-orange-700">
                {req.iconKey}
              </span>
              <p className="font-bold text-slate-700">{req.label}</p>
            </div>
            {req.value && <p className="text-sm text-slate-600">{req.value}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
  // Thêm component mới cho phần sidebar
function RoomSidebar({ room }: { room: RoomDetail }) {
  const price = room.priceText || (room.price ? `${room.price.toLocaleString('vi-VN')} đ/tháng` : 'Liên hệ');
  const area = room.areaText || room.area;
  const occupancyInfo = getOccupancyInfo(room);
  const isFull = occupancyInfo?.available === 0 || room.status === 'OCCUPIED';

  return (
    <aside className="w-full lg:w-[400px]">
      <div className="sticky top-28 space-y-6">
        <div className="rounded-[2rem] border border-orange-100 bg-white p-8 shadow-xl shadow-slate-900/5">
          <div className="mb-8 flex justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-4xl font-extrabold tracking-tighter text-slate-950">{price}</span>
              <span className="font-medium text-slate-400">Giá thuê tham khảo</span>
            </div>
          </div>

          <div className="mb-8 space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Diện tích</span>
                <span className="font-bold">{area || 'Đang cập nhật'}</span>
              </div>
              <span className="material-symbols-outlined text-slate-300">square_foot</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Trạng thái</span>
                <span className={`font-bold ${isFull ? 'text-red-700' : ''}`}>
                  {isFull ? 'Đã đủ người' : room.status === 'AVAILABLE' ? 'Còn trống' : 'Tạm ẩn'}
                </span>
              </div>
              <span className="material-symbols-outlined text-slate-300">verified</span>
            </div>
          </div>

          {isFull ? (
            <div className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-full bg-slate-200 py-5 text-lg font-black tracking-wide text-slate-500" aria-disabled="true">
              Phòng đã đủ người
              <span className="material-symbols-outlined">group_off</span>
            </div>
          ) : (
            <Link
              href={`/rooms/${room.id}/book`}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-orange-900 to-orange-500 py-5 text-lg font-black tracking-wide text-white shadow-lg transition-transform hover:scale-[0.98]"
            >
              Đặt ngay
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          )}

          <p className="mt-6 text-center text-xs font-medium text-slate-400">
            Bạn sẽ không bị tính phí cho đến khi yêu cầu được xác nhận.
          </p>

          <hr className="my-8 border-slate-200" />

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
              <span className="material-symbols-outlined text-xl text-orange-700">verified_user</span>
              Thông tin phòng đã xác thực
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
              <span className="material-symbols-outlined text-xl text-orange-700">support_agent</span>
              Hỗ trợ thành viên 24/7
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-blue-100 bg-blue-50/60 p-8">
          <h4 className="mb-2 font-bold text-blue-950">Được quan tâm</h4>
          <p className="mb-4 text-sm leading-relaxed text-blue-950/80">
            Phòng này có dữ liệu nguồn từ Phongtro123. Hãy liên hệ sớm để xác nhận tình trạng mới nhất.
          </p>
          {room.sourceUrl && (
            <a
              href={room.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-blue-950 transition-all hover:gap-2"
            >
              Xem nguồn tin
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}
export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let room: RoomDetail;
  let isUserLoggedIn = false;

  try {
    const { id } = await params;
    room = await getPublicRoomById(id);
  } catch {
    notFound();
  }

  // Check if user is logged in
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token');
    isUserLoggedIn = !!token?.value;
  } catch {
    isUserLoggedIn = false;
  }

  const images = getImageUrls(room);
  const postedDate = getPostedDateText(room);
  const occupancy = getOccupancyInfo(room);
  const amenities = ((room.amenities ?? []) as RoomAmenityItem[])
    .map((item) => item.amenity)
    .filter((amenity): amenity is { id: string; name: string } => Boolean(amenity));
  const location = [room.district, room.city].filter(Boolean).join(', ') || room.address;
  const googleMapsUrl = getGoogleMapsUrl(room);
  const roomId  = room.id;
  return (
    <>
      <Navigation />
      <RoomDetailInteractionLogger roomId={room.id} />
      <main className="bg-[#f9f9fe] pb-20 pt-24 text-slate-950">
        <header className="mx-auto mb-8 max-w-7xl px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-orange-800">
                <span className="material-symbols-outlined text-sm">location_on</span>
                {location}
              </div>
              <h1 className="text-4xl font-extrabold tracking-tighter text-slate-950 md:text-5xl">{room.title}</h1>
              <p className="max-w-2xl text-lg font-medium text-slate-500">{room.address}</p>
            </div>
            <div className="flex gap-3">
              <button className="rounded-full bg-white p-3 shadow-sm transition-colors hover:bg-orange-50" aria-label="Chia sẻ">
                <span className="material-symbols-outlined">share</span>
              </button>
              <FavoriteButton roomId={room.id} />
            </div>
          </div>
        </header>

        <RoomGallery
          images={images}
          title={room.title}
          postedDate={postedDate}
          occupancy={occupancy}
          hostPanel={<HostProfileCard owner={room.owner} />}
        />

        <section className="mx-auto max-w-7xl px-8">
          <div className="relative flex flex-col gap-16 lg:flex-row">
            <div className="flex-1 space-y-12">
              <div className="space-y-6">
                <SectionHeading icon="subject" label="Tổng quan" title="Thông tin chi tiết" />
                <div className="whitespace-pre-line text-lg leading-relaxed text-slate-700">
                  {room.description}
                </div>
              </div>

              <div className="space-y-8">
                <SectionHeading icon="local_activity" label="Trang bị sẵn có" title="Tiện ích" />
                {amenities.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {amenities.map((amenity: { id: string; name: string }) => (
                      <div
                        key={amenity.id}
                        className="flex items-start gap-4 rounded-2xl bg-white p-4 shadow-sm transition-colors hover:bg-orange-50"
                      >
                        <AmenityIcon name={amenity.name} />
                        <div>
                          <h4 className="font-bold text-slate-950">{amenity.name}</h4>
                          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">Có sẵn</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">Tiện ích đang được cập nhật.</p>
                )}
              </div>

              <RoomRequirements room={room} />

            
              {roomId ? (
                <section className="mt-12">
                  <RoommatesSection roomId={roomId} />
                </section>
              ) : (
                <div className="text-center text-red-500">Lỗi: Không tìm thấy ID phòng!</div>
              )}

              <div className="space-y-6">
                <SectionHeading icon="travel_explore" label="Khu vực" title="Vị trí" />
                  <div className="overflow-hidden rounded-[2rem] border border-slate-200">
                    <div className="p-6 bg-white">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-orange-600">
                          location_on
                        </span>

                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900">
                            Địa chỉ phòng
                          </h4>

                          <p className="text-slate-600">
                            {room.address}
                          </p>
                        </div>

                        {googleMapsUrl && (
                          <a
                            href={googleMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-sm font-bold text-orange-800 transition-colors hover:bg-orange-100"
                          >
                            <span className="material-symbols-outlined text-base">open_in_new</span>
                            Google Maps
                          </a>
                        )}
                      </div>
                    </div>

                    <RoomMapView
                      latitude={room.latitude}
                      longitude={room.longitude}
                      mapUrl={googleMapsUrl}
                    />
                  </div>
              </div>

              {/* Hiển thị phần tương đồng sau vị trí */}
              {roomId && (
                <section className="space-y-6 mt-12">
                  <SectionHeading icon="psychology" label="Phân tích phù hợp" title="So sánh sở thích" />
                  <RoomCompatibility 
                    roomId={roomId} 
                    isUserLoggedIn={isUserLoggedIn}
                  />
                </section>
              )}

              {roomId && (
                <section className="mt-12">
                  <RoomReviews roomId={roomId} />
                </section>
              )}
            </div>

            <RoomSidebar room={room} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
