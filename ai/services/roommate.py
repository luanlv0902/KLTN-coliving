# =====================================================
# ROOMMATE MATCHING
# =====================================================
import pandas as pd
from utils.loader import users_df, rooms_df, occupancy_df

def match_roommates(userId, roomId):
    
    indexed_users_df = users_df.set_index('userId')
    if userId not in indexed_users_df.index:
        return pd.DataFrame(columns=["roommate_id", "compatibility_score", "compatibility_reasons"])
    user = indexed_users_df.loc[userId]
    roommate_ids = get_roommates(roomId)
    rows = []

    for roommate_id in roommate_ids:
        if roommate_id == userId: continue
        
        roommate = indexed_users_df.loc[roommate_id]
        
        compatibility = roommate_compatibility(user, roommate)
        
        rows.append({
            "roommate_id": roommate_id,
            "compatibility_score": compatibility["score"],
            "compatibility_reasons": compatibility["reasons"],
            # Thêm các thông tin profile cần hiển thị
            "name": roommate.get("name", "Người dùng ẩn danh"), # Giả sử có cột name
            "avatar": roommate.get("avatar_url", "/default-avatar.png"),
            "age": roommate.get("age", None),
            "occupation": roommate.get("10", "Chưa cập nhật"),
            "cleanliness_level": roommate.get("priority_cleanliness", 0),
            "social_level": roommate.get("priority_social_environment", 0),
            "accept_smoking": roommate.get("accept_smoking_roommates", False),
            "accept_pets": roommate.get("accept_pets", False),
        })

    result_df = pd.DataFrame(rows)
    if result_df.empty:
        return pd.DataFrame(columns=["roommate_id", "compatibility_score", "compatibility_reasons"])

    # Sắp xếp giảm dần theo điểm số tương thích
    return result_df.sort_values(
        by="compatibility_score",
        ascending=False
    )


def roommate_compatibility(user, roommate):
    """
    Tính điểm tương thích giữa hai người dùng dựa trên các tiêu chí:
    Hút thuốc, Thú cưng, Độ sạch sẽ, và Môi trường xã hội.
    """
    score = 0
    reasons = []


    if user["accept_smoking_roommates"] == roommate["accept_smoking_roommates"]:
        score += 1
        reasons.append("Cùng quan điểm về việc hút thuốc")

    if user["accept_pets"] == roommate["accept_pets"]:
        score += 1
        reasons.append("Cùng quan điểm về thú cưng")
    clean_diff = abs(user["priority_cleanliness"] - roommate["priority_cleanliness"])
    clean_score = 1 - (clean_diff / 5)
    clean_score = max(0, clean_score)
    
    score += clean_score

    if clean_score >= 0.8:
        reasons.append("Thói quen sạch sẽ tương đồng")
    social_diff = abs(user["priority_social_environment"] - roommate["priority_social_environment"])
    
    # Chuẩn hóa điểm tương tự như độ sạch sẽ
    social_score = 1 - (social_diff / 5)
    social_score = max(0, social_score)
    
    score += social_score

    if social_score >= 0.8:
        reasons.append("Phong cách giao tiếp và hòa đồng phù hợp")


    final_score = round(score / 4, 4)

    return {
        "score": final_score,
        "reasons": reasons
    }


def get_roommates(roomId: str) -> list:
    if not roomId:
        return []
    if occupancy_df.empty:
        return []
    print(occupancy_df.head(3))
    mask = (occupancy_df["roomId"] == roomId) & (occupancy_df["status"] == "ACTIVE")
    roommates = occupancy_df.loc[mask]
    if roommates.empty:
        return []

    return roommates["userId"].tolist()