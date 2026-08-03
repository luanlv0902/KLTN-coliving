'use client'

import { useEffect, useState } from 'react'
import { X, AlertTriangle, CheckCircle, AlertCircle, Loader2, Info, Users, ShieldAlert } from 'lucide-react'

interface EvaluationData {
  booking: {
    id: string
    userId: string
    roomId: string
    startDate: string
    endDate: string
    status: string
  }
  user: {
    id: string
    name: string
    email: string
    fullName: string
  }
  room: {
    id: string
    title: string
  }
  evaluation: {
    status: string // SUCCESS hoặc ERROR
    summary: {
      applicant_id: string
      applicant_name: string
      room_id: string
      room_title: string
      final_compatibility_score: number
      compatibility_level: string
      data_description: string
    }
    critical_rules_check: {
      has_critical_conflict: boolean
      is_room_overloaded: boolean
      smoking_rule_violation: boolean
      pet_rule_violation: boolean
      list_of_violations: string[]
    }
    metric_breakdown_percent: {
      cleanliness_match_rate: number
      sleep_habit_match_rate: number
      social_environment_match_rate: number
      room_policy_compliance_total: number
      roommate_social_cohesion_total: number
    }
    roommate_impact_analysis: {
      total_existing_roommates: number
      highest_similarity_with: string
      lowest_similarity_with: string
      individual_roommate_scores: Array<{
        roommate_id: string
        roommate_name: string
        match_percent: number
        cleanliness_gap: number
        social_gap: number
      }>
    }
    ai_data_report: string
  }
}

interface LandlordEvaluationModalProps {
  isOpen: boolean
  onClose: () => void
  bookingId: string
  onLoading?: (loading: boolean) => void
}

export function LandlordEvaluationModal({
  isOpen,
  onClose,
  bookingId,
  onLoading,
}: LandlordEvaluationModalProps) {
  const [data, setData] = useState<EvaluationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && bookingId) {
      handleOpen()
    }
  }, [isOpen, bookingId])

  useEffect(() => {
    if (!isOpen) {
      setData(null)
      setError(null)
    }
  }, [isOpen])

  const handleOpen = async () => {
    try {
      setLoading(true)
      setError(null)
      onLoading?.(true)

      const url = `/api/bookings/${bookingId}/evaluation`
      const response = await fetch(url)
      const rawText = await response.text()

      let result
      try {
        result = JSON.parse(rawText)
      } catch (e) {
        throw new Error("API hệ thống không trả về JSON hợp lệ")
      }

      if (!response.ok) {
        throw new Error(result?.error || result?.message || "Lỗi tải dữ liệu phân tích")
      }

      setData(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lỗi tải dữ liệu phân tích"
      setError(message)
    } finally {
      setLoading(false)
      onLoading?.(false)
    }
  }

  // Khách quan hóa màu sắc theo mức độ tương thích kỹ thuật
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600'
    if (score >= 60) return 'text-amber-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-50 border-emerald-200'
    if (score >= 60) return 'bg-amber-50 border-amber-200'
    return 'bg-red-50 border-red-200'
  }

  const getStatusIcon = (level: string) => {
    if (level === 'ĐỘ TƯƠNG THÍCH CAO') {
      return <CheckCircle className="h-5 w-5 text-emerald-600" />
    } else if (level === 'ĐỘ TƯƠNG THÍCH TRUNG BÌNH') {
      return <AlertCircle className="h-5 w-5 text-amber-600" />
    } else {
      return <ShieldAlert className="h-5 w-5 text-red-600" />
    }
  }

  const normalizePercent = (value: unknown): number => {
    const numeric = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(numeric)) return 0
    if (numeric < 0) return 0
    if (numeric > 100) return 100
    return numeric
  }

  const formatPercent = (value: unknown) => normalizePercent(value).toFixed(1)

  const toPercentWidth = (value: unknown) => `${normalizePercent(value)}%`

  if (!isOpen) return null
  // Rút gọn biến định danh để code gọn gàng sạch sẽ hơn
  const evalInfo = data?.evaluation
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">Đối chiếu chỉ số ứng viên</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Content */}
        <div className="px-6 py-4">
          {loading && !data ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <p className="font-semibold mb-1">Lỗi hệ thống</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : data && evalInfo ? (
            <div className="space-y-6">
              
              {/* 1. Thông tin ứng viên cơ bản */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">Hồ sơ ứng tuyển</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Họ và tên</p>
                    <p className="font-medium text-gray-900">{data.user.fullName || data.user.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Email hệ thống</p>
                    <p className="font-medium text-gray-900">{data.user.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Căn phòng đăng ký</p>
                    <p className="font-medium text-gray-900">{data.room.title}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Thời hạn đề xuất</p>
                    <p className="font-medium text-gray-900">
                      {new Date(data.booking.startDate).toLocaleDateString('vi-VN')} - {new Date(data.booking.endDate).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Cảnh báo vi phạm chính sách cứng (Nếu có) */}
              {evalInfo?.critical_rules_check?.has_critical_conflict && (
                <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded text-sm text-red-800 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-red-900">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Phát hiện xung đột chính sách cốt lõi:</span>
                  </div>
                  <ul className="list-disc list-inside pl-1 space-y-0.5 text-xs">
                    {evalInfo?.critical_rules_check?.list_of_violations?.map((violation, idx) => (
                      <li key={idx}>{violation}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 3. Điểm số & Phân khúc tương thích tổng thể */}
              <div className={`border rounded-lg p-5 ${getScoreBgColor(evalInfo?.summary?.final_compatibility_score || 0)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Chỉ số tương thích kỹ thuật</p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-4xl font-extrabold ${getScoreColor(evalInfo?.summary?.final_compatibility_score || 0)}`}>
                        {(evalInfo?.summary?.final_compatibility_score || 0).toFixed(1)}%
                      </span>
                      <span className="text-xs text-gray-400">tổng hợp dữ liệu</span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
                      {getStatusIcon(evalInfo?.summary?.compatibility_level || '')}
                      <span className="text-xs font-bold text-gray-800 tracking-tight">
                        {evalInfo?.summary?.compatibility_level || 'Không xác định'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200/60 text-xs text-gray-600 flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p>{evalInfo?.summary?.data_description || 'Đang phân tích dữ liệu...'}</p>
                </div>
              </div>

              {/* 4. Biểu đồ chi tiết các chỉ số thói quen dạng Progress Bar */}
              <div className="border border-gray-200 rounded-lg p-5 space-y-4">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                  <span>Kết quả phân rã chỉ số thành phần</span>
                </h3>
                <div className="space-y-3">
                  {/* Chỉ số Sạch sẽ */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Độ đồng điệu vệ sinh, gọn gàng</span>
                      <span className="font-semibold text-gray-900">{formatPercent(evalInfo?.metric_breakdown_percent?.cleanliness_match_rate)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: toPercentWidth(evalInfo?.metric_breakdown_percent?.cleanliness_match_rate) }}></div>
                    </div>
                  </div>

                  {/* Chỉ số Giờ giấc */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Sự trùng khớp khung giờ sinh hoạt / giấc ngủ</span>
                      <span className="font-semibold text-gray-900">{formatPercent(evalInfo?.metric_breakdown_percent?.sleep_habit_match_rate)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-indigo-600 h-2 rounded-full" style={{ width: toPercentWidth(evalInfo?.metric_breakdown_percent?.sleep_habit_match_rate) }}></div>
                    </div>
                  </div>

                  {/* Chỉ số Xã hội */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Độ tương hợp môi trường giao tiếp, tiếng ồn</span>
                      <span className="font-semibold text-gray-900">{formatPercent(evalInfo?.metric_breakdown_percent?.social_environment_match_rate)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-purple-600 h-2 rounded-full" style={{ width: toPercentWidth(evalInfo?.metric_breakdown_percent?.social_environment_match_rate) }}></div>
                    </div>
                  </div>

                  {/* Sự gắn kết tập thể */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Mức độ hòa hợp xã hội với tập thể hiện tại</span>
                      <span className="font-semibold text-gray-900">{formatPercent(evalInfo?.metric_breakdown_percent?.roommate_social_cohesion_total)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-emerald-600 h-2 rounded-full" style={{ width: toPercentWidth(evalInfo?.metric_breakdown_percent?.roommate_social_cohesion_total) }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Phân tích đối chiếu ma trận nhân sự */}
              {evalInfo?.roommate_impact_analysis?.total_existing_roommates > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2.5 text-xs text-gray-700">
                  <div className="flex items-center gap-1.5 font-semibold text-gray-900 text-sm">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span>Dữ liệu so khớp nhân sự ({evalInfo?.roommate_impact_analysis?.total_existing_roommates || 0} thành viên cũ)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-md border border-gray-100">
                    <div>
                      <p className="text-gray-500">Chỉ số cao nhất với:</p>
                      <p className="font-semibold text-emerald-700">{evalInfo?.roommate_impact_analysis?.highest_similarity_with || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Chỉ số thấp nhất với:</p>
                      <p className="font-semibold text-amber-700">{evalInfo?.roommate_impact_analysis?.lowest_similarity_with || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 6. Báo cáo bằng văn bản dữ liệu đối chiếu khách quan từ AI */}
              <div className="border border-blue-200 bg-blue-50/60 p-4 rounded-lg">
                <p className="font-semibold text-blue-900 mb-2 text-sm">Báo cáo đối chiếu dữ liệu thô</p>
                <p className="text-xs text-blue-900 leading-relaxed whitespace-pre-line">
                  {evalInfo?.ai_data_report || 'Đang xử lý báo cáo...'}
                </p>
              </div>

            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors shadow-sm"
          >
            Đóng bảng
          </button>
        </div>
      </div>
    </div>
  )
}