"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

export default function PreferenceQuestionnaire() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  
  // State khởi tạo
  const [form, setForm] = useState({
    budgetMinVnd: "",
    budgetMaxVnd: "",
    preferredDistrict: "",
    lifestyleArchetype: "",
    priorityCleanliness: 3,
    prioritySocialEnvironment: 3,
    acceptSmokingRoommates: false,
    acceptPets: false,
  });
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences khi component mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch("/api/preferences", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          const data = await response.json();
          if (data) {
            // Populate form với dữ liệu đã lưu
            setForm({
              budgetMinVnd: data.budgetMinVnd ? data.budgetMinVnd.toString() : "",
              budgetMaxVnd: data.budgetMaxVnd ? data.budgetMaxVnd.toString() : "",
              preferredDistrict: data.preferredDistrict || "",
              lifestyleArchetype: data.lifestyleArchetype || "",
              priorityCleanliness: data.priorityCleanliness || 3,
              prioritySocialEnvironment: data.prioritySocialEnvironment || 3,
              acceptSmokingRoommates: data.acceptSmokingRoommates || false,
              acceptPets: data.acceptPets || false,
            });
            console.log("Loaded preferences:", data);
          }
        }
      } catch {
        console.log(" No existing preferences found (first time user)");
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); 
      if (currentStep === totalSteps) {
        const submitButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        if (submitButton && !submitButton.disabled) {
            submitButton.click();
        }
      } else {
        // Nếu chưa phải bước cuối, chuyển sang bước tiếp theo
        handleNext();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Luôn ngăn chặn reload trang

    // Double check: Chỉ cho phép xử lý logic nếu đang ở bước cuối
    if (currentStep !== totalSteps) {
      return; 
    }

    if (isLoading) {
      alert("Đang tải dữ liệu, vui lòng chờ...");
      return;
    }

    setLoading(true);

    try {
      // Validate
      if (!form.budgetMinVnd || !form.budgetMaxVnd) {
        alert("Vui lòng nhập ngân sách");
        setLoading(false);
        return;
      }

      if (!form.lifestyleArchetype) {
        alert("Vui lòng chọn kiểu lối sống");
        setLoading(false);
        return;
      }

      if (Number(form.budgetMinVnd) > Number(form.budgetMaxVnd)) {
        alert("Ngân sách tối đa phải lớn hơn hoặc bằng ngân sách tối thiểu");
        setLoading(false);
        return;
      }

      // Convert to proper types
      const data = {
        budgetMinVnd: form.budgetMinVnd ? Number.parseInt(form.budgetMinVnd, 10) : null,
        budgetMaxVnd: form.budgetMaxVnd ? Number.parseInt(form.budgetMaxVnd, 10) : null,
        preferredDistrict: form.preferredDistrict || null,
        lifestyleArchetype: form.lifestyleArchetype || null,
        priorityCleanliness: form.priorityCleanliness,
        prioritySocialEnvironment: form.prioritySocialEnvironment,
        acceptSmokingRoommates: form.acceptSmokingRoommates,
        acceptPets: form.acceptPets,
      };

      const response = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMsg = "Lỗi khi lưu preferences";
        try {
          const error = await response.json();
          const validationMessage = error.errors
            ? Object.values(error.errors as Record<string, string[]>).flat()[0]
            : null;
          errorMsg = validationMessage || error.error || error.message || errorMsg;
        } catch {
          errorMsg = `Lỗi server: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      await response.json();
      alert("Lưu thành công! Đang tìm phòng phù hợp cho bạn...");
      router.push("/rooms/recommendations");
    } catch (error: unknown) {
      if (!(error instanceof Error)) throw error;
      alert(`❌ Lỗi: ${error.message}`);
      console.warn("Không thể lưu sở thích:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      // Cuộn lên đầu form để người dùng dễ nhìn thấy nội dung mới
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getStepProgress = () => {
    return ((currentStep - 1) / (totalSteps - 1)) * 100;
  };

  return (
    <>
      <Navigation />
      {isLoading && (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50 pt-32 pb-20 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-slate-600 font-semibold">Đang tải dữ liệu của bạn...</p>
          </div>
        </div>
      )}
      {!isLoading && (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50 pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-2 mb-4 rounded-full bg-orange-100 text-orange-700 font-bold text-xs tracking-widest uppercase">
              Tìm Không Gian Sống Lý Tưởng
            </span>
            <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
              Hãy Khám Phá <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-orange-500">Phòng Hoàn Hảo</span>
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Trả lời một vài câu hỏi về sở thích của bạn, chúng tôi sẽ giúp bạn tìm được không gian sống phù hợp.
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-12">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-slate-600">Bước {currentStep}/{totalSteps}</span>
              <span className="text-sm font-semibold text-slate-600">{Math.round(getStepProgress())}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-600 to-orange-500 transition-all duration-300"
                style={{ width: `${getStepProgress()}%` }}
              />
            </div>
          </div>

          {/* Form Container */}
          {/* Thêm onKeyDown vào form để bắt sự kiện Enter toàn cục */}
          <div className="bg-white rounded-3xl shadow-2xl shadow-slate-900/10 overflow-hidden">
            <form 
              onSubmit={handleSubmit} 
              onKeyDown={handleKeyDown}
              className="p-12"
            >
              {/* Step 1: Budget */}
              {currentStep === 1 && (
                <div className="transition-opacity duration-300 animate-in fade-in slide-in-from-right-4">
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-3">Ngân sách hàng tháng</h2>
                    <p className="text-slate-600 mb-8">Xác định mức giá phòng hợp với tài chính của bạn.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Tối thiểu (VND)</label>
                      <input
                        type="number"
                        value={form.budgetMinVnd}
                        onChange={(e) => setForm({ ...form, budgetMinVnd: e.target.value })}
                        placeholder="3,000,000"
                        className="w-full px-6 py-4 text-lg border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none transition"
                        required
                      />
                      <p className="text-xs text-slate-500 mt-2">Giá tối thiểu bạn chấp nhận</p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Tối đa (VND)</label>
                      <input
                        type="number"
                        value={form.budgetMaxVnd}
                        onChange={(e) => setForm({ ...form, budgetMaxVnd: e.target.value })}
                        placeholder="10,000,000"
                        className="w-full px-6 py-4 text-lg border-2 border-slate-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none transition"
                        required
                      />
                      <p className="text-xs text-slate-500 mt-2">Giá tối đa bạn chấp nhận</p>
                    </div>
                  </div>

                  {form.budgetMinVnd && form.budgetMaxVnd && (
                    <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 mb-8 animate-in fade-in">
                      <p className="text-sm text-orange-700">
                        <span className="font-bold">Khoảng giá:</span> {parseInt(form.budgetMinVnd).toLocaleString('vi-VN')} - {parseInt(form.budgetMaxVnd).toLocaleString('vi-VN')} VND/tháng
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Location & Lifestyle */}
              {currentStep === 2 && (
                <div className="transition-opacity duration-300 animate-in fade-in slide-in-from-right-4 space-y-8">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-3">Thành phố ưa thích</h2>
                    <p className="text-slate-600 mb-6">Chọn thành phố nơi bạn muốn sống.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                      {[
                        { value: "HO_CHI_MINH", label: "TP. Hồ Chí Minh" },
                        { value: "HA_NOI", label: "Hà Nội" },
                        { value: "DA_NANG", label: "Đà Nẵng"},
                      ].map((city) => (
                        <button
                          key={city.value}
                          type="button"
                          onClick={() => {
                            setSelectedCity(city.value);
                            setForm({ ...form, preferredDistrict: "" });
                          }}
                          className={`p-6 rounded-xl border-2 transition text-center ${
                            selectedCity === city.value
                              ? "border-orange-600 bg-orange-50"
                              : "border-slate-200 bg-slate-50 hover:border-orange-300"
                          }`}
                        >
                          <p className="font-bold text-slate-900">{city.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-3">Khu vực ưa thích</h2>
                    <p className="text-slate-600 mb-6">Chọn quận/huyện nơi bạn muốn sống (tùy chọn).</p>
                    
           <select
  value={form.preferredDistrict}
  onChange={(e) => setForm({ ...form, preferredDistrict: e.target.value })}
  className="w-full px-6 py-4 text-lg border-2 border-slate-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none transition bg-white"
  disabled={!selectedCity}
>
  <option value="">{selectedCity ? "-- Chọn quận/huyện --" : "-- Vui lòng chọn thành phố trước --"}</option>

  {/* TP.HCM */}
  {selectedCity === "HO_CHI_MINH" && (
    <>
      <optgroup label="Quận nội thành">
        <option value="SAI_GON">P. Sài Gòn</option>
        <option value="TAN_DINH">P. Tân Định</option>
        <option value="BEN_THANH">P. Bến Thành</option>
        <option value="CAU_ONG_LANH">P. Cầu Ông Lãnh</option>
        <option value="BAN_CO">P. Bàn Cờ</option>
        <option value="XUAN_HOA">P. Xuân Hòa</option>
        <option value="NHIEU_LOC">P. Nhiêu Lộc</option>
        <option value="XOM_CHIEU">P. Xóm Chiếu</option>
        <option value="KHANH_HOI">P. Khánh Hội</option>
        <option value="VINH_HOI">P. Vĩnh Hội</option>
        <option value="CHO_QUAN">P. Chợ Quán</option>
        <option value="AN_DONG">P. An Đông</option>
        <option value="CHO_LON">P. Chợ Lớn</option>
        <option value="BINH_TAY">P. Bình Tây</option>
        <option value="BINH_TIEN">P. Bình Tiên</option>
        <option value="BINH_PHU">P. Bình Phú</option>
        <option value="PHU_LAM">P. Phú Lâm</option>
        <option value="TAN_THUAN">P. Tân Thuận</option>
        <option value="PHU_THUAN">P. Phú Thuận</option>
        <option value="TAN_MY">P. Tân Mỹ</option>
        <option value="TAN_HUNG">P. Tân Hưng</option>
        <option value="CHANH_HUNG">P. Chánh Hưng</option>
        <option value="PHU_DINH">P. Phú Định</option>
        <option value="BINH_DONG">P. Bình Đông</option>
        <option value="DIEN_HONG">P. Diên Hồng</option>
        <option value="VUON_LAI">P. Vườn Lài</option>
        <option value="HOA_HUNG">P. Hòa Hưng</option>
        <option value="MINH_PHUNG">P. Minh Phụng</option>
        <option value="BINH_THOI">P. Bình Thới</option>
        <option value="HOA_BINH">P. Hòa Bình</option>
        <option value="PHU_THO">P. Phú Thọ</option>
        <option value="DONG_HUNG_THUAN">P. Đông Hưng Thuận</option>
        <option value="TRUNG_MY_TAY">P. Trung Mỹ Tây</option>
        <option value="TAN_THOI_HIEP">P. Tân Thới Hiệp</option>
        <option value="THOI_AN">P. Thới An</option>
        <option value="AN_PHU_DONG">P. An Phú Đông</option>
        <option value="AN_LAC">P. An Lạc</option>
        <option value="TAN_TAO">P. Tân Tạo</option>
        <option value="BINH_TAN">P. Bình Tân</option>
        <option value="BINH_TRI_DONG">P. Bình Trị Đông</option>
        <option value="BINH_HUNG_HOA">P. Bình Hưng Hòa</option>
        <option value="GIA_DINH">P. Gia Định</option>
        <option value="BINH_THANH">P. Bình Thạnh</option>
        <option value="BINH_LOI_TRUNG">P. Bình Lợi Trung</option>
        <option value="THANH_MY_TAY">P. Thạnh Mỹ Tây</option>
        <option value="BINH_QUOI">P. Bình Quới</option>
        <option value="HANH_THONG">P. Hạnh Thông</option>
        <option value="AN_NHON">P. An Nhơn</option>
        <option value="GO_VAP">P. Gò Vấp</option>
        <option value="AN_HOI_DONG">P. An Hội Đông</option>
        <option value="THONG_TAY_HOI">P. Thông Tây Hội</option>
        <option value="AN_HOI_TAY">P. An Hội Tây</option>
        <option value="DUC_NHUAN">P. Đức Nhuận</option>
        <option value="CAU_KIEU">P. Cầu Kiệu</option>
        <option value="PHU_NHUAN">P. Phú Nhuận</option>
        <option value="TAN_SON_HOA">P. Tân Sơn Hòa</option>
        <option value="TAN_SON_NHAT">P. Tân Sơn Nhất</option>
        <option value="TAN_HOA">P. Tân Hòa</option>
        <option value="BAY_HIEN">P. Bảy Hiền</option>
        <option value="TAN_BINH">P. Tân Bình</option>
        <option value="TAN_SON">P. Tân Sơn</option>
        <option value="TAY_THANH">P. Tây Thạnh</option>
        <option value="TAN_SON_NHI">P. Tân Sơn Nhì</option>
        <option value="PHU_THO_HOA">P. Phú Thọ Hòa</option>
        <option value="TAN_PHU">P. Tân Phú</option>
        <option value="PHU_THANH">P. Phú Thạnh</option>
        <option value="HIEP_BINH">P. Hiệp Bình</option>
        <option value="THU_DUC">P. Thủ Đức</option>
        <option value="TAM_BINH">P. Tam Bình</option>
        <option value="LINH_XUAN">P. Linh Xuân</option>
        <option value="TANG_NHON_PHU">P. Tăng Nhơn Phú</option>
        <option value="LONG_BINH">P. Long Bình</option>
        <option value="LONG_PHUOC">P. Long Phước</option>
        <option value="LONG_TRUONG">P. Long Trường</option>
        <option value="CAT_LAI">P. Cát Lái</option>
        <option value="BINH_TRUNG">P. Bình Trưng</option>
        <option value="PHUOC_LONG">P. Phước Long</option>
        <option value="AN_KHANH">P. An Khánh</option>
      </optgroup>
      <optgroup label="Huyện ngoại thành">
        <option value="VINH_LOC">Xã Vĩnh Lộc</option>
        <option value="TAN_VINH_LOC">Xã Tân Vĩnh Lộc</option>
        <option value="BINH_LOI">Xã Bình Lợi</option>
        <option value="TAN_NHUT">Xã Tân Nhựt</option>
        <option value="BINH_CHANH">Xã Bình Chánh</option>
        <option value="HUNG_LONG">Xã Hưng Long</option>
        <option value="BINH_HUNG">Xã Bình Hưng</option>
        <option value="BINH_KHANH">Xã Bình Khánh</option>
        <option value="AN_THOI_DONG">Xã An Thới Đông</option>
        <option value="CAN_GIO">Xã Cần Giờ</option>
        <option value="CU_CHI">Xã Củ Chi</option>
        <option value="TAN_AN_HOI">Xã Tân An Hội</option>
        <option value="THAI_MY">Xã Thái Mỹ</option>
        <option value="AN_NHON_TAY">Xã An Nhơn Tây</option>
        <option value="NHUAN_DUC">Xã Nhuận Đức</option>
        <option value="PHU_HOA_DONG">Xã Phú Hòa Đông</option>
        <option value="BINH_MY">Xã Bình Mỹ</option>
        <option value="DONG_THANH">Xã Đông Thạnh</option>
        <option value="HOC_MON">Xã Hóc Môn</option>
        <option value="XUAN_THOI_SON">Xã Xuân Thới Sơn</option>
        <option value="BA_DIEM">Xã Bà Điểm</option>
        <option value="NHA_BE">Xã Nhà Bè</option>
        <option value="HIEP_PHUOC">Xã Hiệp Phước</option>
        <option value="LONG_SON">Xã Long Sơn</option>
        <option value="HOA_HIEP">Xã Hòa Hiệp</option>
        <option value="BINH_CHAU">Xã Bình Châu</option>
        <option value="THANH_AN">Xã Thạnh An</option>

{/* Bình Dương */}
<option value="DONG_HOA">P. Đông Hòa</option>
<option value="DI_AN">P. Dĩ An</option>
<option value="TAN_DONG_HIEP">P. Tân Đông Hiệp</option>
<option value="THUAN_AN">P. Thuận An</option>
<option value="THUAN_GIAO">P. Thuận Giao</option>
<option value="BINH_HOA">P. Bình Hòa</option>
<option value="LAI_THIEU">P. Lái Thiêu</option>
<option value="AN_PHU">P. An Phú</option>
<option value="BINH_DUONG">P. Bình Dương</option>
<option value="CHANH_HIEP">P. Chánh Hiệp</option>
<option value="THU_DAU_MOT">P. Thủ Dầu Một</option>
<option value="PHU_LOI">P. Phú Lợi</option>
<option value="VINH_TAN">P. Vĩnh Tân</option>
<option value="BINH_CO">P. Bình Cơ</option>
<option value="TAN_UYEN">P. Tân Uyên</option>
<option value="TAN_HIEP">P. Tân Hiệp</option>
<option value="TAN_KHANH">P. Tân Khánh</option>
<option value="HOA_LOI">P. Hòa Lợi</option>
<option value="PHU_AN">P. Phú An</option>
<option value="TAY_NAM">P. Tây Nam</option>
<option value="LONG_NGUYEN">P. Long Nguyên</option>
<option value="BEN_CAT">P. Bến Cát</option>
<option value="CHANH_PHU_HOA">P. Chánh Phú Hòa</option>
<option value="THOI_HOA">P. Thới Hòa</option>

<option value="BAC_TAN_UYEN">Xã Bắc Tân Uyên</option>
<option value="THUONG_TAN">Xã Thường Tân</option>
<option value="AN_LONG">Xã An Long</option>
<option value="PHUOC_THANH">Xã Phước Thành</option>
<option value="PHUOC_HOA">Xã Phước Hòa</option>
<option value="PHU_GIAO">Xã Phú Giáo</option>
<option value="TRU_VAN_THO">Xã Trừ Văn Thố</option>
<option value="BAU_BANG">Xã Bàu Bàng</option>
<option value="MINH_THANH">Xã Minh Thạnh</option>
<option value="LONG_HOA">Xã Long Hòa</option>
<option value="DAU_TIENG">Xã Dầu Tiếng</option>
<option value="THANH_AN_BD">Xã Thanh An</option>

{/* Bà Rịa - Vũng Tàu */}
<option value="VUNG_TAU">P. Vũng Tàu</option>
<option value="TAM_THANG">P. Tam Thắng</option>
<option value="RACH_DUA">P. Rạch Dừa</option>
<option value="PHUOC_THANG">P. Phước Thắng</option>
<option value="BA_RIA">P. Bà Rịa</option>
<option value="LONG_HUONG">P. Long Hương</option>
<option value="PHU_MY">P. Phú Mỹ</option>
<option value="TAM_LONG">P. Tam Long</option>
<option value="TAN_THANH">P. Tân Thành</option>
<option value="TAN_PHUOC">P. Tân Phước</option>
<option value="TAN_HAI">P. Tân Hải</option>

<option value="CHAU_PHA">Xã Châu Pha</option>
<option value="NGAI_GIAO">Xã Ngãi Giao</option>
<option value="BINH_GIA">Xã Bình Giã</option>
<option value="KIM_LONG">Xã Kim Long</option>
<option value="CHAU_DUC">Xã Châu Đức</option>
<option value="XUAN_SON">Xã Xuân Sơn</option>
<option value="NGHIA_THANH">Xã Nghĩa Thành</option>
<option value="HO_TRAM">Xã Hồ Tràm</option>
<option value="XUYEN_MOC">Xã Xuyên Mộc</option>
<option value="HOA_HOI">Xã Hòa Hội</option>
<option value="BAU_LAM">Xã Bàu Lâm</option>
<option value="PHUOC_HAI">Xã Phước Hải</option>
<option value="LONG_HAI">Xã Long Hải</option>
<option value="DAT_DO">Xã Đất Đỏ</option>
<option value="LONG_DIEN">Xã Long Điền</option>

<option value="CON_DAO">Đặc khu Côn Đảo</option>
      </optgroup>
    </>
  )}

  {/* Hà Nội */}
  {selectedCity === "HA_NOI" && (
    <>
      <optgroup label="Quận nội thành">
        <option value="HOAN_KIEM">P. Hoàn Kiếm</option>
        <option value="BA_DINH">P. Ba Đình</option>
        <option value="NGOC_HA">P. Ngọc Hà</option>
        <option value="GIANG_VO">P. Giảng Võ</option>
        <option value="DONG_DA">P. Đống Đa</option>
        <option value="VAN_MIEU">P. Văn Miếu - Quốc Tử Giám</option>
        <option value="LANG">P. Láng</option>
        <option value="HAI_BA_TRUNG">P. Hai Bà Trưng</option>
        <option value="BACH_MAI">P. Bạch Mai</option>
        <option value="VINH_TUY">P. Vĩnh Tuy</option>
        <option value="THANH_XUAN">P. Thanh Xuân</option>
        <option value="KHUONG_DINH">P. Khương Đình</option>
        <option value="CAU_GIAY">P. Cầu Giấy</option>
        <option value="NGHIA_DO">P. Nghĩa Đô</option>
        <option value="YEN_HOA">P. Yên Hòa</option>
        <option value="TAY_HO">P. Tây Hồ</option>
        <option value="PHU_THUONG">P. Phú Thượng</option>
        <option value="LONG_BIEN">P. Long Biên</option>
        <option value="BO_DE">P. Bồ Đề</option>
        <option value="VIET_HUNG">P. Việt Hưng</option>
        <option value="HOANG_MAI">P. Hoàng Mai</option>
        <option value="LINH_DAM">P. Linh Đàm</option>
        <option value="DINH_CONG">P. Định Công</option>
        <option value="HA_DONG">P. Hà Đông</option>
        <option value="DUONG_NOI">P. Dương Nội</option>
        <option value="VAN_PHUC">P. Vạn Phúc</option>
        <option value="NAM_TU_LIEM">P. Nam Từ Liêm</option>
        <option value="MY_DINH">P. Mỹ Đình</option>
        <option value="XUAN_PHUONG">P. Xuân Phương</option>
        <option value="BAC_TU_LIEM">P. Bắc Từ Liêm</option>
        <option value="MINH_KHAI">P. Minh Khai</option>
        <option value="CO_NHUE">P. Cổ Nhuế</option>
        <option value="SON_TAY">P. Sơn Tây</option>
      </optgroup>
      <optgroup label="Huyện ngoại thành">
        <option value="DONG_ANH">Xã Đông Anh</option>
        <option value="ME_LINH">Xã Mê Linh</option>
        <option value="SOC_SON">Xã Sóc Sơn</option>
        <option value="GIA_LAM">Xã Gia Lâm</option>
        <option value="BAT_TRANG">Xã Bát Tràng</option>
        <option value="THANH_TRI">Xã Thanh Trì</option>
        <option value="TU_HIEP">Xã Tứ Hiệp</option>
        <option value="HOAI_DUC">Xã Hoài Đức</option>
        <option value="DAN_PHUONG">Xã Đan Phượng</option>
        <option value="THACH_THAT">Xã Thạch Thất</option>
        <option value="QUOC_OAI">Xã Quốc Oai</option>
        <option value="CHUONG_MY">Xã Chương Mỹ</option>
        <option value="THUONG_TIN">Xã Thường Tín</option>
        <option value="PHU_XUYEN">Xã Phú Xuyên</option>
        <option value="UNG_HOA">Xã Ứng Hòa</option>
        <option value="MY_DUC">Xã Mỹ Đức</option>
        <option value="BA_VI">Xã Ba Vì</option>
        <option value="PHUC_THO">Xã Phúc Thọ</option>
      </optgroup>
    </>
  )}

  {/* Đà Nẵng */}
  {selectedCity === "DA_NANG" && (
    <>
      <optgroup label="Quận nội thành">
        <option value="HAI_CHAU">P. Hải Châu</option>
        <option value="THACH_THANG">P. Thạch Thang</option>
        <option value="THANH_BINH">P. Thanh Bình</option>
        <option value="SON_TRA">P. Sơn Trà</option>
        <option value="AN_HAI">P. An Hải</option>
        <option value="NGU_HANH_SON">P. Ngũ Hành Sơn</option>
        <option value="HOA_XUAN">P. Hòa Xuân</option>
        <option value="CAM_LE">P. Cẩm Lệ</option>
        <option value="HOA_THO">P. Hòa Thọ</option>
        <option value="LIEN_CHIEU">P. Liên Chiểu</option>
        <option value="HOA_KHANH">P. Hòa Khánh</option>
        <option value="THANH_KHE">P. Thanh Khê</option>
        <option value="AN_KHE">P. An Khê</option>
      </optgroup>
      <optgroup label="Huyện ngoại thành">
        <option value="HOA_VANG">Xã Hòa Vang</option>
        <option value="HOA_BAC">Xã Hòa Bắc</option>
        <option value="HOA_LIEN">Xã Hòa Liên</option>
        <option value="HOA_NINH">Xã Hòa Ninh</option>
        <option value="HOANG_SA">Đặc khu Hoàng Sa</option>
      </optgroup>
    </>
  )}
</select>

                  </div>

                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-3">Lối sống của bạn</h2>
                    <p className="text-slate-600 mb-6">Chọn cách sống phù hợp với bạn nhất.</p>

                    <div className="grid grid-cols-1 gap-4">
                      {[
                        { value: "Privacy Seeker", label: "Cần riêng tư", desc: "Không ồn ào, ít giao tiếp" },
                        { value: "Remote Worker", label: "Làm việc ở nhà", desc: "Cần không gian yên tĩnh" },
                        { value: "Social Butterfly", label: "Thích giao tiếp", desc: "Vui vẻ, thường có bạn" },
                        { value: "Student", label: "Sinh viên", desc: "Linh hoạt, ít ở nhà" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button" // Quan trọng: type="button" để không submit form
                          onClick={() => setForm({ ...form, lifestyleArchetype: option.value })}
                          className={`p-4 rounded-xl border-2 transition text-left ${
                            form.lifestyleArchetype === option.value
                              ? "border-purple-600 bg-purple-50"
                              : "border-slate-200 bg-slate-50 hover:border-purple-300"
                          }`}
                        >
                          <p className="font-bold text-slate-900">{option.label}</p>
                          <p className="text-sm text-slate-600">{option.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Room Preferences */}
              {currentStep === 3 && (
                <div className="transition-opacity duration-300 animate-in fade-in slide-in-from-right-4 space-y-8">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-3">Độ sạch sẽ</h2>
                    <p className="text-slate-600 mb-6">Độ sạch sẽ quan trọng đến mức nào với bạn?</p>

                    <div className="bg-slate-50 rounded-xl p-8">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-semibold text-slate-600">Không quan trọng</span>
                        <span className="text-3xl font-extrabold text-orange-600">{form.priorityCleanliness}/5</span>
                        <span className="text-sm font-semibold text-slate-600">Rất quan trọng</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={form.priorityCleanliness}
                        onChange={(e) => setForm({ ...form, priorityCleanliness: parseInt(e.target.value) })}
                        className="w-full h-3 bg-gradient-to-r from-slate-200 to-orange-200 rounded-full appearance-none cursor-pointer accent-orange-600"
                      />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-3">Môi trường sống</h2>
                    <p className="text-slate-600 mb-6">Bạn thích sống trong môi trường yên tĩnh hay vui vẻ?</p>

                    <div className="bg-slate-50 rounded-xl p-8">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-semibold text-slate-600">Yên tĩnh, ít người</span>
                        <span className="text-3xl font-extrabold text-blue-600">{form.prioritySocialEnvironment}/5</span>
                        <span className="text-sm font-semibold text-slate-600">Vui vẻ, nhiều người</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={form.prioritySocialEnvironment}
                        onChange={(e) => setForm({ ...form, prioritySocialEnvironment: parseInt(e.target.value) })}
                        className="w-full h-3 bg-gradient-to-r from-slate-200 to-blue-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Additional Preferences */}
              {currentStep === 4 && (
                <div className="transition-opacity duration-300 animate-in fade-in slide-in-from-right-4">
                  <h2 className="text-3xl font-bold text-slate-900 mb-3">Tùy chọn khác</h2>
                  <p className="text-slate-600 mb-8">Bạn có chấp nhận những điều kiện sau không?</p>

                  <div className="space-y-4">
                    <label className="flex items-start gap-4 p-6 rounded-xl border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50 transition cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.acceptSmokingRoommates}
                        onChange={(e) => setForm({ ...form, acceptSmokingRoommates: e.target.checked })}
                        className="w-6 h-6 mt-1 text-orange-600 rounded accent-orange-600"
                      />
                      <div>
                        <p className="font-bold text-slate-900 text-lg">Chấp nhận roommate hút thuốc</p>
                        <p className="text-slate-600 text-sm">Bạn có thể sống với người hút thuốc không?</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-4 p-6 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.acceptPets}
                        onChange={(e) => setForm({ ...form, acceptPets: e.target.checked })}
                        className="w-6 h-6 mt-1 text-blue-600 rounded accent-blue-600"
                      />
                      <div>
                        <p className="font-bold text-slate-900 text-lg">Chấp nhận roommate có thú cưng</p>
                        <p className="text-slate-600 text-sm">Bạn có thể sống với người nuôi thú cưng không?</p>
                      </div>
                    </label>
                  </div>

                  {/* Summary */}
                  <div className="mt-10 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-8 border-2 border-orange-200">
                    <h3 className="font-bold text-slate-900 mb-4">Tóm tắt sở thích của bạn:</h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-semibold">Ngân sách:</span> {form.budgetMinVnd && form.budgetMaxVnd ? `${parseInt(form.budgetMinVnd).toLocaleString('vi-VN')} - ${parseInt(form.budgetMaxVnd).toLocaleString('vi-VN')} VND` : "Chưa chọn"}</p>
                      <p><span className="font-semibold">Khu vực:</span> {form.preferredDistrict || "Không ưu tiên"}</p>
                      <p><span className="font-semibold">Lối sống:</span> {form.lifestyleArchetype || "Chưa chọn"}</p>
                      <p><span className="font-semibold">Độ sạch sẽ:</span> {form.priorityCleanliness}/5</p>
                      <p><span className="font-semibold">Môi trường:</span> {form.prioritySocialEnvironment}/5</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-4 mt-12 pt-8 border-t border-slate-200">
                <button
                  type="button" // Đảm bảo là button, không submit
                  onClick={handlePrev}
                  disabled={currentStep === 1}
                  className="flex-1 px-6 py-4 rounded-xl font-bold uppercase tracking-wide text-slate-600 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  ← Quay lại
                </button>

                {currentStep < totalSteps ? (
                  <button
                    type="button" // Quan trọng: type="button" để không trigger submit form
                    onClick={handleNext}
                    className="flex-1 px-6 py-4 rounded-xl font-bold uppercase tracking-wide text-white bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 transition shadow-lg shadow-orange-500/30"
                  >
                    Tiếp tục →
                  </button>
                ) : (
                  <button
                    type="submit" // Chỉ nút cuối cùng mới là type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-4 rounded-xl font-bold uppercase tracking-wide text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-emerald-500/30"
                  >
                    {loading ? " Đang lưu..." : " Tìm phòng ngay"}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Tips */}
          <div className="mt-8 p-6 bg-slate-900/5 rounded-xl">
            <p className="text-sm text-slate-600 text-center">
              <span className="font-semibold">Ghi chú:</span> Thông tin này sẽ giúp chúng tôi tìm được phòng phù hợp nhất với bạn. Bạn có thể cập nhật bất cứ lúc nào.
            </p>
          </div>
        </div>
      </div>
      )}
      <Footer />
    </>
  );
}
