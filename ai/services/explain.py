# =====================================================
# FILE: services/explain.py
# =====================================================

def explain_recommendation(row):
    # 1. Xác định trạng thái tổng quan dựa trên điểm số (Hệ 100)
    final_score = row.get("recommendation_score", 0.5) * 100
    
    if final_score >= 80:
        status = "Cực kỳ lý tưởng"
    elif final_score >= 60:
        status = "Khá hòa hợp (Có thể thương lượng điều chỉnh)"
    else:
        status = "Cần cân nhắc kỹ (Có khả năng xung đột thói quen)"

    # Các nhóm luận điểm giải thích (Lưu trữ dưới dạng câu văn độc lập hoàn chỉnh)
    positives = []
    negatives = []

    # =================================================
    # LUẬN ĐIỂM 1: LỐI SỐNG & BẠN CÙNG PHÒNG (TRỌNG TÂM K-MEANS)
    # =================================================
    cluster_sim = row.get("lifestyle_cluster_sim", 0.5)
    clean_sim = row.get("cleanliness_similarity", 0.5)
    sleep_sim = row.get("sleep_similarity", 0.5)
    social_sim = row.get("social_similarity", 0.5)

    if cluster_sim >= 0.75:
        positives.append("Bạn và các thành viên hiện tại có sự đồng điệu rất lớn về tư duy sống cũng như thói quen sinh hoạt cốt lõi.")
    elif cluster_sim <= 0.4:
        negatives.append("Nhịp sống và thói quen hằng ngày của bạn có thể sẽ có một vài điểm lệch pha nhất định với không gian chung hiện tại.")

    if clean_sim >= 0.75 and sleep_sim >= 0.75:
        positives.append("Mọi người trong nhà đều chia sẻ chung một tiêu chuẩn về sự ngăn nắp và rất đồng nhất trong giờ giấc nghỉ ngơi.")
    else:
        if clean_sim <= 0.4:
            negatives.append("Tiêu chuẩn về sự gọn gàng và việc giữ gìn vệ sinh chung giữa bạn và mọi người đang có sự khác biệt khá rõ.")
        if sleep_sim <= 0.4:
            negatives.append("Khung giờ sinh hoạt và giấc ngủ của các bên chưa thật sự khớp nhau, dễ gây ảnh hưởng lúc nửa đêm.")

    if social_sim >= 0.75:
        positives.append("Phong cách giao tiếp, mức độ cởi mở và gu kết nối xã hội của các bạn vô cùng tương đồng.")

    # =================================================
    # LUẬN ĐIỂM 2: VỊ TRÍ & TÀI CHÍNH (NỀN TẢNG TIỆN ÍCH)
    # =================================================
    loc_sim = row.get("location_similarity", 0.5)
    budget_sim = row.get("budget_similarity", 0.5)

    if loc_sim >= 0.75 and budget_sim >= 0.75:
        positives.append("Căn phòng này nằm ngay tại khu vực bạn đang tìm kiếm, đồng thời mức giá thuê cũng vừa vặn hoàn hảo với ngân sách dự kiến.")
    else:
        if loc_sim >= 0.75:
            positives.append("Điểm cộng lớn là căn phòng sở hữu vị trí đắc địa, rất thuận tiện cho lộ trình di chuyển mong muốn của bạn.")
        elif loc_sim <= 0.4:
            negatives.append("Vị trí của tòa nhà nằm hơi lệch hoặc xa so với các tọa độ quận/huyện ưu tiên của bạn.")

        if budget_sim >= 0.75:
            positives.append("Chi phí thuê phòng rất hợp lý và đáp ứng tốt kế hoạch tài chính cá nhân của bạn.")
        elif budget_sim <= 0.4:
            negatives.append("Mức giá thuê hiện tại đang cao hơn đáng kể so với khoảng tài chính thoải mái nhất của bạn.")

    # =================================================
    # LUẬN ĐIỂM 3: CHÍNH SÁCH PHÒNG & MẬT ĐỘ (PET/SMOKING/OCCUPANCY)
    # =================================================
    pet_match = row.get("pet_match", 0.5)
    smoking_match = row.get("smoking_match", 0.5)
    occ_ratio = row.get("occupancy_ratio", 0.5)

    if pet_match >= 0.75 and smoking_match >= 0.75:
        positives.append("Các quy định nội bộ của phòng như chính sách nuôi thú cưng và không gian hút thuốc hoàn toàn ăn khớp với lối sống của bạn.")
    
    if occ_ratio >= 0.7:
        positives.append("Mật độ thành viên trong căn hộ hiện tại khá thoáng, hứa hẹn mang lại một không gian sống rộng rãi, ít phải chen chúc.")
    elif occ_ratio <= 0.35:
        negatives.append("Phòng hiện tại đã gần lấp đầy tối đa, do đó không gian riêng tư và việc sử dụng tiện ích chung có thể bị giới hạn một chút.")

    # =================================================
    # LUẬN ĐIỂM 4: HÀNH VI CỘNG ĐỒNG (COLLABORATIVE FILTERING)
    # =================================================
    cf_sim = row.get("cf_score", 0.5)
    if cf_sim >= 0.75:
        positives.append("Đặc biệt, dựa trên lịch sử hệ thống, căn phòng này đang nhận được sự quan tâm lớn và đánh giá rất cao từ những người dùng có chung gu sống giống bạn.")

    # =================================================
    # BƯỚC KHỚP NỐI VĂN PHONG "NARRATIVE GENERATION"
    # =================================================
    explanation_parts = []
    
    # 1. Đoạn mở bài: Định vị cảm xúc dựa trên Điểm số
    if final_score >= 80:
        explanation_parts.append(f"🌟 Đây là một không gian sống tuyệt vời được đo ni đóng giày cho bạn với độ tương thích lên tới {final_score:.1f}%.")
    elif final_score >= 60:
        explanation_parts.append(f"🌱 Căn phòng này là một lựa chọn tương đối phù hợp và an toàn dành cho bạn, đạt {final_score:.1f}% mức độ hòa hợp chung.")
    else:
        explanation_parts.append(f"⚠️ Hệ thống nhận thấy căn phòng này chỉ đạt {final_score:.1f}% độ tương thích và có thể chưa phải là mảnh ghép tối ưu nhất cho bạn lúc này.")

    # 2. Đoạn thân bài 1: Nêu bật các điểm cộng (Không dùng join dấu phẩy lủng củng)
    if positives:
        explanation_parts.append("Về mặt tích cực, " + positives[0])
        # Nếu có từ câu thứ 2 trở đi, viết tách câu rõ ràng kèm từ nối tự nhiên
        for idx, pos_sentence in enumerate(positives[1:]):
            if idx == 0:
                explanation_parts.append("Hơn nữa, " + pos_sentence[0].lower() + pos_sentence[1:])
            else:
                explanation_parts.append(pos_sentence)

    # 3. Đoạn thân bài 2: Nêu bật các rào cản và gợi ý giải pháp thông minh
    if negatives:
        if final_score >= 60:
            explanation_parts.append("Tuy nhiên, bạn nên lưu ý thêm một vài chi tiết nhỏ: " + " ".join(negatives) + " Những vấn đề này hoàn toàn có thể thảo luận và nhường nhịn nhau khi bạn trao đổi trực tiếp với bạn cùng phòng trước khi dọn vào.")
        else:
            explanation_parts.append("Điểm bất lợi lớn nhất cần cân nhắc kỹ là: " + " ".join(negatives) + " Bạn nên suy nghĩ thật cẩn trọng để tránh những xung đột, bất tiện không đáng có trong quá trình sinh hoạt chung lâu dài.")

    # 4. Đoạn kết luận: Kêu gọi hành động (Call to action) mượt mà
    if final_score >= 80:
        explanation_parts.append("Chúng tôi tin rằng bạn sẽ có những trải nghiệm coliving cực kỳ hạnh phúc tại đây. Bạn không nên bỏ lỡ cơ hội này!")
    elif final_score >= 60:
        explanation_parts.append("Mức độ chênh lệch thói quen là không quá lớn, bạn có thể hẹn lịch xem phòng trực tiếp hoặc nhắn tin cho chủ nhà để tìm hiểu kỹ hơn.")
    else:
        explanation_parts.append("Hãy thử làm mới bộ lọc, nới lỏng tiêu chí tài chính/vị trí hoặc khám phá danh sách các căn phòng khác bên dưới để tìm thấy không gian phù hợp hơn nhé.")

    # Kết hợp lại thành một chuỗi văn bản hoàn chỉnh có ngắt nghỉ tự nhiên
    full_explanation = " ".join(explanation_parts)

    return {
        "status": status,
        "explanation": full_explanation,
        "score_breakdown": {
            "final_score": round(final_score, 2),
            "location": round(loc_sim * 100, 1),
            "budget": round(budget_sim * 100, 1),
            "lifestyle_compatibility": round(cluster_sim * 100, 1),
            "community_rating": round(cf_sim * 100, 1),
        },
        "positive_reasons": positives,
        "concerns": negatives,
    }