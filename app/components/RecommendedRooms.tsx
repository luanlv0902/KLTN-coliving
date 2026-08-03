"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { RecommendationScores } from "@/lib/services/recommendationExplainer";

interface Recommendation extends Partial<RecommendationScores> {
  roomId: string;
  recommendation_score: number;
  price: number;
  districtId?: string;
  status?: string;
  explanation?: string;
  positive_reasons?: string[];
  concerns?: string[];
  score_breakdown?: {
    final_score: number;
    location: number;
    budget: number;
    lifestyle_compatibility: number;
    community_rating: number;
  };
  roomDetails?: {
    id: string;
    title: string;
    address: string;
    images: Array<{ url: string }>;
    amenities: Array<{ amenity: { name: string } }>;
  };
}

export default function RecommendedRooms() {
  const [rooms, setRooms] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/recommendations/rooms?top_k=12", {
        cache: "no-store",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Lỗi khi tải recommendations");
      }
      const data = await response.json();
      setRooms(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-24">
        <div className="relative w-16 h-16 mb-6">
          <div className="absolute inset-0 border-4 border-orange-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-orange-600 rounded-full animate-spin"></div>
        </div>
        <p className="text-lg text-slate-600 font-medium">
           Đang tìm phòng hoàn hảo cho bạn...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 p-8 rounded-xl editorial-shadow">
        <div className="flex items-start gap-4">
          <span className="text-3xl"></span>
          <div className="flex-1">
            <p className="text-red-700 font-semibold text-lg mb-2">
              Có lỗi xảy ra
            </p>
            <p className="text-red-600 mb-6">{error}</p>
            <button
              onClick={fetchRecommendations}
              className="bg-red-600 hover:bg-red-700 text-white font-medium px-6 py-2 rounded-lg transition"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 mb-3">
          Phòng Gợi Ý Cho Bạn
          </h2>
          <p className="text-lg text-slate-600">
            Tìm thấy{" "}
            <span className="font-semibold text-orange-600">{rooms.length}</span>{" "}
            phòng phù hợp dựa trên AI thông minh
          </p>
        </div>
        <button
          onClick={fetchRecommendations}
          className="group inline-flex items-center gap-2 bg-white border-2 border-slate-200 hover:border-orange-300 hover:shadow-md text-slate-700 font-medium px-6 py-3 rounded-lg transition duration-300"
        >
          <span className="text-lg group-hover:rotate-180 transition-transform duration-300">
            
          </span>
          <span>Tải lại</span>
        </button>
      </div>

      {/* Rooms Grid */}
      {rooms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room, index) => (
              <div
                key={room.roomId}
                className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-orange-200 shadow-lg hover:shadow-2xl transition-all duration-300"
              >
                {/* Image Section */}
                <div className="relative h-56 bg-slate-300 overflow-hidden">
                  {room.roomDetails?.images?.[0] ? (
                    <Image
                      src={room.roomDetails.images[0].url}
                      alt={room.roomDetails.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center">
                      <span className="text-5xl"></span>
                    </div>
                  )}

                  {/* Badge Container */}
                  <div className="absolute inset-0 flex items-start justify-between p-4">
                    {/* Rank Badge */}
                    <div className="bg-slate-900/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold">
                      #{index + 1}
                    </div>

                    {/* Match Score Badge */}
                    <div
                      className={`px-4 py-2 rounded-full font-bold text-sm backdrop-blur-sm ${
                        room.recommendation_score >= 0.8
                          ? "bg-green-500/80 text-white"
                          : room.recommendation_score >= 0.6
                          ? "bg-orange-500/80 text-white"
                          : "bg-blue-500/80 text-white"
                      }`}
                    >
                       {(room.recommendation_score * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-6">
                  {/* Title */}
                  <h3 className="font-bold text-lg text-slate-900 mb-2 line-clamp-2">
                    {room.roomDetails?.title || `Phòng #${room.roomId}`}
                  </h3>

                  {/* Address */}
                  <p className="text-slate-600 text-sm mb-4 flex items-start gap-2">
                    <span className="text-base mt-0.5 shrink-0"></span>
                    <span>{room.roomDetails?.address || "Địa chỉ không xác định"}</span>
                  </p>

                  {/* Price Highlight */}
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-lg p-3 mb-4">
                    <p className="text-xs text-orange-600 font-semibold mb-1">
                      Giá thuê
                    </p>
                    <p className="text-2xl font-bold text-orange-600">
                      {room.price?.toLocaleString("vi-VN")} VND
                      <span className="text-sm text-orange-500 font-normal">/tháng</span>
                    </p>
                  </div>

                  {/* Status Badge */}
                  {room.status && (
                    <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                      <p className="text-xs font-semibold text-amber-900">
                        📌 Trạng thái: {room.status}
                      </p>
                    </div>
                  )}

                  {/* Full Explanation */}
                  {room.explanation && (
                    <div className="bg-indigo-50 rounded-lg p-4 mb-4 border border-indigo-100">
                      <p className="text-sm text-indigo-900 leading-relaxed">
                        {room.explanation}
                      </p>
                    </div>
                  )}

                  {/* Score Breakdown */}
                  {room.score_breakdown && (
                    <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg p-4 mb-4 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-700 mb-3">
                        📊 Chi tiết điểm số:
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Vị trí:</span>
                          <div className="flex items-center gap-1">
                            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-orange-500"
                                style={{ width: `${Math.min(room.score_breakdown.location, 100)}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-700 w-8 text-right">
                              {room.score_breakdown.location.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Ngân sách:</span>
                          <div className="flex items-center gap-1">
                            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500"
                                style={{ width: `${Math.min(room.score_breakdown.budget, 100)}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-700 w-8 text-right">
                              {room.score_breakdown.budget.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Lối sống:</span>
                          <div className="flex items-center gap-1">
                            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-purple-500"
                                style={{ width: `${Math.min(room.score_breakdown.lifestyle_compatibility, 100)}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-700 w-8 text-right">
                              {room.score_breakdown.lifestyle_compatibility.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Cộng đồng:</span>
                          <div className="flex items-center gap-1">
                            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500"
                                style={{ width: `${Math.min(room.score_breakdown.community_rating, 100)}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-700 w-8 text-right">
                              {room.score_breakdown.community_rating.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Positive Reasons */}
                  {room.positive_reasons && room.positive_reasons.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-4 mb-4 border border-green-100">
                      <p className="text-xs font-semibold text-green-900 mb-2">
                        ✅ Điểm mạnh:
                      </p>
                      <ul className="space-y-1.5">
                        {room.positive_reasons.map((reason, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-green-800 flex items-start gap-2"
                          >
                            <span className="text-green-600 shrink-0">→</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Concerns */}
                  {room.concerns && room.concerns.length > 0 && (
                    <div className="bg-orange-50 rounded-lg p-4 mb-4 border border-orange-100">
                      <p className="text-xs font-semibold text-orange-900 mb-2">
                        ⚠️ Điểm cần lưu ý:
                      </p>
                      <ul className="space-y-1.5">
                        {room.concerns.map((concern, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-orange-800 flex items-start gap-2"
                          >
                            <span className="text-orange-600 shrink-0">→</span>
                            <span>{concern}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Amenities */}
                  {(room.roomDetails?.amenities?.length ?? 0) > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-slate-600 mb-2">
                         Tiện ích:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {room.roomDetails?.amenities.slice(0, 3).map((a, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-3 py-1 rounded-full font-medium"
                          >
                            {a.amenity.name}
                          </span>
                        ))}
                        {(room.roomDetails?.amenities?.length ?? 0) > 3 && (
                          <span className="inline-flex items-center bg-slate-100 text-slate-700 text-xs px-3 py-1 rounded-full font-medium">
                            +{(room.roomDetails?.amenities?.length ?? 0) - 3} khác
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      href={`/rooms/${room.roomDetails?.id || room.roomId}`}
                      className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-medium py-2.5 rounded-lg text-center transition-all shadow-md hover:shadow-lg"
                    >
                      Xem chi tiết
                    </Link>
                    <button className="border-2 border-orange-300 hover:bg-orange-50 text-orange-600 font-medium py-2.5 rounded-lg transition-all">
                       Yêu thích
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
          <p className="text-6xl mb-4"></p>
          <p className="text-2xl text-slate-900 font-bold mb-2">
            Không tìm thấy phòng phù hợp
          </p>
          <p className="text-slate-600 mb-8 max-w-md mx-auto">
            Hãy thử điều chỉnh tiêu chí tìm kiếm của bạn hoặc cập nhật sở thích để
            nhận được gợi ý tốt hơn
          </p>
          <Link
            href="/preferences"
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-medium px-8 py-3 rounded-lg transition"
          >
            <span>←</span>
            <span>Quay lại chỉnh sửa sở thích</span>
          </Link>
        </div>
      )}

      {/* Information Section */}
      <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border border-orange-200 rounded-2xl p-8 editorial-shadow">
        <div className="max-w-4xl">
          <h3 className="flex items-center gap-2 font-bold text-lg text-orange-900 mb-3">
            <span className="text-2xl"></span> Cách AI tính toán điểm phù hợp
          </h3>
          <p className="text-orange-800 mb-4 leading-relaxed">
            Điểm phù hợp (0-100%) được tính dựa trên phân tích AI đa chiều, bao gồm:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-3">
              <span className="text-2xl shrink-0"></span>
              <div>
                <p className="font-semibold text-orange-900">Vị trí chiến lược</p>
                <p className="text-sm text-orange-800">Gần khu vực ưu tiên của bạn</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl shrink-0"></span>
              <div>
                <p className="font-semibold text-orange-900">Ngân sách hợp lý</p>
                <p className="text-sm text-orange-800">Nằm trong tầm chi tiêu của bạn</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl shrink-0"></span>
              <div>
                <p className="font-semibold text-orange-900">Lối sống phù hợp</p>
                <p className="text-sm text-orange-800">Giờ sinh hoạt & thói quen sạch sẽ</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl shrink-0"></span>
              <div>
                <p className="font-semibold text-orange-900">Cộng đồng tốt</p>
                <p className="text-sm text-orange-800">Roommate tương thích, môi trường xã hội</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
