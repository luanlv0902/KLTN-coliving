
import pandas as pd
import numpy as np
from utils.loader_supabase import users_df, rooms_df, occupancy_df
from services.similarity import (
    cleanliness_compatibility,
    sleep_compatibility,
    social_compatibility
)

def evaluate_user_for_landlord(userId: str, roomId: str):
    try:
        if users_df.empty or rooms_df.empty:
            return {"error": "Dữ liệu hệ thống trống, không thể tiến hành phân tích."}

        # 1. Trích xuất thông tin Ứng viên (Applicant)
        if userId not in users_df["userId"].values:
            return {"error": f"Không tìm thấy dữ liệu của ứng viên {userId}"}
        user = users_df[users_df["userId"] == userId].iloc[0]

        # 2. Trích xuất thông tin Căn phòng của chủ nhà (Room)
        room_filter = rooms_df[rooms_df["roomId"] == roomId]
        if room_filter.empty:
            return {"error": f"Không tìm thấy dữ liệu căn phòng {roomId}"}
        room = room_filter.iloc[0]

        # 3. Xác định danh sách thành viên đang ở thực tế (Current Roommates)
        roommates_ids = occupancy_df[
            (occupancy_df["roomId"] == roomId) & (occupancy_df["status"] == "ACTIVE")
        ]["userId"].tolist()
        
        if userId in roommates_ids:
            roommates_ids.remove(userId)

    
        smoking_conflict = (room.get("allowSmoking") is False) and (user.get("accept_smoking_roommates") is True)
        pet_conflict = (room.get("allowPets") is False) and (user.get("accept_pets") is True)
        
        current_occ = int(room.get("current_occupants", 0))
        max_occ = int(room.get("maxOccupants", 5))
        is_full = current_occ >= max_occ

    
        clean_room_sim = cleanliness_compatibility(user.get("priority_cleanliness", 3), room.get("cleanlinessRequired", 3))
        sleep_room_sim = sleep_compatibility(user.get("lifestyle_archetype", "Chưa cập nhật"), room.get("preferredSleepHabit", "Không bắt buộc"))
        social_room_sim = social_compatibility(
            user.get("priority_social_environment", 3), 
            room.get("noiseTolerance", 3), 
            room.get("guestPolicy", 3)
        )
        
        room_compliance_score = (clean_room_sim * 0.4 + sleep_room_sim * 0.4 + social_room_sim * 0.2) * 100
        roommate_breakdown = []
        avg_people_sim = 1.0
        best_match_member = "Không có"
        worst_match_member = "Không có"
        
        if roommates_ids:
            existing_members = users_df[users_df["userId"].isin(roommates_ids)]
            people_scores = []
            
            for _, member in existing_members.iterrows():
                c_diff = abs(user.get("priority_cleanliness", 3) - member.get("priority_cleanliness", 3))
                s_diff = abs(user.get("priority_social_environment", 3) - member.get("priority_social_environment", 3))
                
                c_match = max(0, 1 - (c_diff / 4.0))
                s_match = max(0, 1 - (s_diff / 4.0))
                
                member_sim = (c_match * 0.6 + s_match * 0.4) * 100
                people_scores.append(member_sim)
                
                roommate_breakdown.append({
                    "roommate_id": member["userId"],
                    "roommate_name": member.get("fullName", "Thành viên cũ"),
                    "match_percent": round(member_sim, 1),
                    "cleanliness_gap": int(c_diff),
                    "social_gap": int(s_diff)
                })
            
            avg_people_sim = sum(people_scores) / len(people_scores)
            roommate_breakdown_sorted = sorted(roommate_breakdown, key=lambda x: x["match_percent"])
            worst_match_member = roommate_breakdown_sorted[0]["roommate_name"]
            best_match_member = roommate_breakdown_sorted[-1]["roommate_name"]

        if not roommates_ids:
            final_score = room_compliance_score
            roommate_note = "Phòng hiện tại trống. Chỉ số phản ánh mức độ đáp ứng quy định phòng của ứng viên."
        else:
            final_score = (room_compliance_score * 0.4) + (avg_people_sim * 0.6)
            roommate_note = f"Chỉ số được tổng hợp từ mức độ tương thích quy định phòng (40%) và độ đồng điệu với {len(roommates_ids)} thành viên hiện tại (60%)."

        if smoking_conflict or pet_conflict or is_full:
            final_score = min(final_score, 30.0)

        final_score = round(max(0, min(final_score, 100)), 1)

        # =================================================
        # KHỐI 5: NARRATIVE ENGINE - BÁO CÁO ĐỐI CHIẾU KHÁCH QUAN
        # =================================================
        explanation_paragraphs = []
        
        # Phân loại phân khúc điểm số theo tính chất thống kê
        if final_score >= 80:
            status = "ĐỘ TƯƠNG THÍCH CAO"
            advice = "Dữ liệu cho thấy ứng viên có mức độ trùng khớp thông tin cao với các tiêu chí của phòng và thói quen của thành viên hiện tại."
        elif final_score >= 60:
            status = "ĐỘ TƯƠNG THÍCH TRUNG BÌNH"
            advice = "Dữ liệu ở mức độ an toàn. Có sự chênh lệch nhỏ ở một số chỉ số thói quen thành phần."
        else:
            status = "ĐỘ TƯƠNG THÍCH THẤP"
            advice = "Hệ thống ghi nhận điểm số tổng hợp nằm dưới mức phân khúc mong đợi hoặc phát hiện vi phạm quy định nền tảng của phòng."

        intro = f"Hệ thống đã hoàn tất xử lý hồ sơ của ứng viên **{user.get('fullName')}** đối với phòng **{room.get('title', roomId)}**. Điểm số tương thích kỹ thuật đạt **{final_score}%**."
        explanation_paragraphs.append(intro)

        # Trích xuất dữ liệu so sánh thói quen một cách định lượng khách quan
        compliance_notes = []
        
        # Lấy giá trị thô để đối chiếu số liệu
        text_to_score = {
            "low": 2,
            "medium": 3,
            "high": 4,

        }
        # 2. Xử lý an toàn cho chỉ số vệ sinh của Ứng viên (Applicant)
        u_clean_raw = user.get("priority_cleanliness", 3)
        if isinstance(u_clean_raw, str):
            # Nếu là chữ, tìm trong bộ từ điển, không có thì mặc định là 3
            u_clean = text_to_score.get(u_clean_raw.lower(), 3)
        else:
            u_clean = int(u_clean_raw) if u_clean_raw is not None else 3

        # 3. Xử lý an toàn cho chỉ số vệ sinh của Phòng (Room)
        r_clean_raw = room.get("cleanlinessRequired", 3)
        if isinstance(r_clean_raw, str):
            # Ép chuỗi 'medium', 'high' thành số 3, 4 theo đúng từ điển
            r_clean = text_to_score.get(r_clean_raw.lower(), 3)
        else:
            r_clean = int(r_clean_raw) if r_clean_raw is not None else 3
        
        if clean_room_sim >= 0.75: 
            compliance_notes.append(f"mức độ ưu tiên ngăn nắp tương đồng cao với yêu cầu của phòng (Ứng viên: {u_clean}/5 vs Phòng yêu cầu: {r_clean}/5)")
        elif clean_room_sim <= 0.4: 
            compliance_notes.append(f"mức độ ưu tiên dọn dẹp có sự chênh lệch số liệu so với tiêu chuẩn phòng (Ứng viên: {u_clean}/5 vs Phòng yêu cầu: {r_clean}/5)")
        else:
            compliance_notes.append(f"mức độ ưu tiên dọn dẹp ở ngưỡng chấp nhận được (Ứng viên: {u_clean}/5 vs Phòng yêu cầu: {r_clean}/5)")
            
        u_sleep = user.get('lifestyle_archetype', 'Chưa cập nhật')
        r_sleep = room.get('preferredSleepHabit', 'Không bắt buộc')
        
        if sleep_room_sim >= 0.75: 
            compliance_notes.append(f"khung giờ sinh hoạt/ngủ nghỉ đồng bộ với nề nếp chung (Ứng viên thuộc nhóm: {u_sleep} - Tiêu chuẩn phòng: {r_sleep})")
        elif sleep_room_sim <= 0.4: 
            compliance_notes.append(f"múi giờ sinh hoạt lệch nhau dựa trên phân loại hệ thống (Ứng viên thuộc nhóm: {u_sleep} vs Quy định phòng: {r_sleep})")
        else:
            compliance_notes.append(f"chênh lệch múi giờ sinh hoạt ở mức nhỏ (Ứng viên thuộc nhóm: {u_sleep} vs Quy định phòng: {r_sleep})")

        if compliance_notes:
            explanation_paragraphs.append("• **Đối chiếu quy định phòng:** " + "; ".join(compliance_notes) + ".")

        # Đối chiếu nhân sự thực tế kèm số liệu ma trận khoảng cách
        if roommates_ids:
            # Tìm bản ghi chi tiết của thành viên hợp nhất và lệch nhất trong danh sách đã tính ở Khối 3
            best_member_data = next((item for item in roommate_breakdown if item["roommate_name"] == best_match_member), None)
            worst_member_data = next((item for item in roommate_breakdown if item["roommate_name"] == worst_match_member), None)
            
            note_person = f"• **Đối chiếu nhân sự thực tế:** Chỉ số tương thích đạt kết quả cao nhất với thành viên **{best_match_member}** ({best_member_data['match_percent'] if best_member_data else 0}%)"
            
            if worst_member_data:
                note_person += (f", và đạt kết quả thấp nhất với thành viên **{worst_match_member}** ({worst_member_data['match_percent']}%) "
                                f"với độ lệch chỉ số cụ thể: Vệ sinh lệch {worst_member_data['cleanliness_gap']}/5 bậc, Giao tiếp xã hội lệch {worst_member_data['social_gap']}/5 bậc.")
            else:
                note_person += "."
                
            explanation_paragraphs.append(note_person)
        else:
            explanation_paragraphs.append("• **Đối chiếu nhân sự thực tế:** Phòng hiện tại chưa có thành viên ở sẵn (0 người), không phát sinh dữ liệu so khớp nhân sự.")

        # Cảnh báo vi phạm chính sách cố định (Giữ nguyên tính khách quan)
        warnings = []
        if smoking_conflict: 
            warnings.append(f"Chính sách Hút thuốc: Hồ sơ ứng viên ghi nhận có thói quen hút thuốc (accept_smoking = True) - Quy định hiện tại của phòng là KHÔNG cho phép.")
        if pet_conflict: 
            warnings.append(f"Chính sách Thú cưng: Hồ sơ ứng viên ghi nhận có nuôi/mang theo thú cưng (accept_pets = True) - Quy định hiện tại của phòng là CẤM nuôi.")
        if is_full: 
            warnings.append(f"Giới hạn Mật độ: Số lượng thành viên hiện tại đã đạt ngưỡng tối đa ({current_occ}/{max_occ} người).")
        return {
            "status": "SUCCESS",
            "summary": {
                "applicant_id": userId,
                "applicant_name": user.get("fullName", "Ẩn danh"),
                "roomId": roomId,
                "room_title": room.get("title", "Chưa cập nhật"),
                "final_compatibility_score": final_score,
                "compatibility_level": status,
                "data_description": advice
            },
            "critical_rules_check": {
                "has_critical_conflict": smoking_conflict or pet_conflict or is_full,
                "is_room_overloaded": is_full,
                "smoking_rule_violation": smoking_conflict,
                "pet_rule_violation": pet_conflict,
                "list_of_violations": warnings
            },
            "metric_breakdown_percent": {
                "cleanliness_match_rate": round(clean_room_sim * 100, 1),
                "sleep_habit_match_rate": round(sleep_room_sim * 100, 1),
                "social_environment_match_rate": round(social_room_sim * 100, 1),
                "room_policy_compliance_total": round(room_compliance_score, 1),
                "roommate_social_cohesion_total": round(avg_people_sim * 100, 1) if roommates_ids else 100.0
            },
            "roommate_impact_analysis": {
                "total_existing_roommates": len(roommates_ids),
                "highest_similarity_with": best_match_member,
                "lowest_similarity_with": worst_match_member,
                "individual_roommate_scores": roommate_breakdown
            },
            "ai_data_report": " ".join(explanation_paragraphs)
        }

    except Exception as e:
        import traceback
        return {
            "status": "ERROR",
            "error_message": f"Lỗi hệ thống phân tích toán học: {str(e)}",
            "traceback": traceback.format_exc()
        }