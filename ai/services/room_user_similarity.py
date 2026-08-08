import pandas as pd
import numpy as np
from .similarity import (
    location_similarity,
    budget_similarity,
    binary_match,
    occupancy_ratio,
    cleanliness_compatibility,
    social_compatibility,
    sleep_compatibility,
    guest_tolerance_compatibility,
)
from .scoring import calculate_xgboost_score

from .explain import explain_recommendation
from utils.loader import model as xgb_model
from utils.loader_supabase import (
    load_users_from_supabase,
    load_rooms_from_supabase,
    load_occupancy_from_supabase
)

NP_BOOL_TYPES = tuple(
    value
    for value in (getattr(np, "bool_", None), getattr(np, "bool8", None))
    if value is not None
)

def convert_to_native_types(obj):
    """Convert numpy types to native Python types for JSON serialization"""
    if isinstance(obj, (np.integer, np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif NP_BOOL_TYPES and isinstance(obj, NP_BOOL_TYPES):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: convert_to_native_types(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_to_native_types(item) for item in obj]
    elif isinstance(obj, pd.Series):
        return convert_to_native_types(obj.to_dict())
    return obj

def ensure_column(df, column_name, aliases=None):
    aliases = aliases or []
    if column_name in df.columns:
        return df
    for alias in aliases:
        if alias in df.columns:
            return df.rename(columns={alias: column_name})
    return df

def missing_columns(df, required_columns):
    return [column for column in required_columns if column not in df.columns]


def _derive_preferred_coordinates(preferred_district, rooms_df: pd.DataFrame):
    district = str(preferred_district or "").strip()
    if not district or district.lower() == "all":
        return None, None
    if "districtId" not in rooms_df.columns:
        return None, None

    district_rooms = rooms_df[rooms_df["districtId"] == district]
    if district_rooms.empty:
        return None, None

    lat_series = pd.to_numeric(district_rooms.get("latitude"), errors="coerce")
    lng_series = pd.to_numeric(district_rooms.get("longitude"), errors="coerce")
    valid_mask = lat_series.notna() & lng_series.notna()
    if not valid_mask.any():
        return None, None

    return float(lat_series[valid_mask].median()), float(lng_series[valid_mask].median())

def get_detailed_compatibility(userId: str, roomId: str):
    try:
        # 1. Load Data
        users_df = load_users_from_supabase().reset_index(drop=True)
        rooms_df = load_rooms_from_supabase().reset_index(drop=True)
      
        users_df = users_df.loc[:, ~users_df.columns.duplicated()]
        rooms_df = rooms_df.loc[:, ~rooms_df.columns.duplicated()]
        occupancy_df = load_occupancy_from_supabase()

        users_df = ensure_column(users_df, "userId", ["id", "user_id", "userID"])
        rooms_df = ensure_column(rooms_df, "roomId", ["id", "room_id", "roomID"])
        occupancy_df = ensure_column(occupancy_df, "roomId", ["room_id", "roomID"])
        occupancy_df = ensure_column(occupancy_df, "userId", ["user_id", "userID"])

        user_missing = missing_columns(users_df, ["userId"])
        room_missing = missing_columns(rooms_df, ["roomId"])
        occupancy_missing = missing_columns(occupancy_df, ["roomId", "userId"])
        if user_missing or room_missing:
            return {
                "error": "AI data source is missing required identifier columns",
                "userId": userId,
                "roomId": roomId,
                "missing": {
                    "users": user_missing,
                    "rooms": room_missing,
                    "occupancy": occupancy_missing,
                },
            }

        if occupancy_missing:
            occupancy_df = pd.DataFrame(columns=["roomId", "userId"])

        user_row = users_df.loc[users_df['userId'] == userId]
        room_row = rooms_df.loc[rooms_df['roomId'] == roomId]
        
        if user_row.empty:
            return {"error": f"User {userId} not found"}
        
        if room_row.empty:
            return {"error": f"Room {roomId} not found"}
        
        user = user_row.iloc[0]
        room = room_row.iloc[0]

        if room.get('current_occupants', 0) >= room.get('maxOccupants', 999):
            return {
                "userId": userId,
                "roomId": roomId,
                "error": "Phòng đã đầy",
                "overall_score": 0
            }

        preferred_district = user.get('preferred_location_district_id', 'all')
        preferred_lat, preferred_lng = _derive_preferred_coordinates(preferred_district, rooms_df)
        location_score = location_similarity(
            preferred_district,
            room.get('districtId'),
            preferred_lat,
            preferred_lng,
            room.get('latitude'),
            room.get('longitude'),
        )

        budget_score = budget_similarity(
            user.get('budget_min_vnd', 3000000),
            user.get('budget_max_vnd', 15000000),
            room.get('minimumBudget', 5000000)
        )

        smoking_score = binary_match(
            user.get('accept_smoking_roommates', False),
            room.get('allowSmoking', False)
        )
        pet_score = binary_match(
            user.get('accept_pets', False),
            room.get('allowPets', False)
        )
        
        # Occupancy
        occupancy_score = occupancy_ratio(
            room.get('current_occupants', 0),
            room.get('maxOccupants', 4)
        )
        
        cleanliness_score = cleanliness_compatibility(
            user.get('priority_cleanliness', 3),
            room.get('cleanlinessRequired', 'medium')
        )
        
        social_score = social_compatibility(
            user.get('priority_social_environment', 3),
            room.get('noiseTolerance', 'medium'),
            room.get('guestPolicy', 'occasionally') 
        )
        
        sleep_score = sleep_compatibility(
            user.get('lifestyle_archetype', 'Young Professional'),
            room.get('preferredSleepHabit', 'normal')
        )
        
        # Guest Tolerance
        guest_score = guest_tolerance_compatibility(
            user.get('priority_social_environment', 3),
            room.get('guestPolicy', 'occasionally')
        )


        roommate_score = 0.5 

        current_roommates_rows = occupancy_df[occupancy_df['roomId'] == roomId]
        
        # Nếu có người ở
        if not current_roommates_rows.empty:
            individual_scores = []
            
            # Lấy thông tin user hiện tại để so sánh
            user_clean = user.get('priority_cleanliness', 3)
            user_social = user.get('priority_social_environment', 3)

            for _, occ_row in current_roommates_rows.iterrows():
                roommate_id = occ_row['userId']
                
                # Bỏ qua nếu trùng với user đang check (trường hợp hiếm)
                if roommate_id == userId:
                    continue
                
                # Tìm thông tin roommate trong users_df
                roommate_row = users_df[users_df['userId'] == roommate_id]
                
                if not roommate_row.empty:
                    roommate = roommate_row.iloc[0]
                    
                    r_clean = roommate.get('priority_cleanliness', 3)
                    r_social = roommate.get('priority_social_environment', 3)

                    # Tính độ tương đồng Cleanliness
                    clean_diff = abs(user_clean - r_clean)
                    # Công thức phạt nặng: 1 - ((diff/4)^3 * 1.5)
                    c_score = max(0.05, min(0.75, 1 - ((clean_diff / 4.0) ** 3) * 1.5))

                    # Tính độ tương đồng Social
                    social_diff = abs(user_social - r_social)
                    s_score = max(0.05, min(0.75, 1 - ((social_diff / 4.0) ** 3) * 1.5))

                    # Trung bình weighted
                    avg_compat = (c_score * 0.6) + (s_score * 0.4)
                    
                    # Phạt nhẹ vì sống chung luôn có ma sát
                    individual_scores.append(avg_compat * 0.9)

            if individual_scores:
                roommate_score = sum(individual_scores) / len(individual_scores)
        
        # =====================================================
        # 4. COMPILE SCORES
        # =====================================================
        scores = {
            "location_similarity": round(location_score, 4),
            "budget_similarity": round(budget_score, 4),
            "smoking_match": round(smoking_score, 4),
            "pet_match": round(pet_score, 4),
            "sleep_similarity": round(sleep_score, 4),
            "cleanliness_similarity": round(cleanliness_score, 4),
            "social_similarity": round(social_score, 4),
            "guest_similarity": round(guest_score, 4),
            "occupancy_ratio": round(occupancy_score, 4),
            "roommate_compatibility": round(roommate_score, 4),
        }
        
        # =====================================================
        # 5. CALCULATE OVERALL SCORE (using XGBoost model)
        # =====================================================
        # Prepare scores dict with proper feature names for XGBoost
        xgb_scores = {
            "location_similarity": location_score,
            "budget_similarity": budget_score,
            "smoking_match": smoking_score,
            "pet_match": pet_score,
            "sleep_group_similarity": sleep_score,
            "cleanliness_group_similarity": cleanliness_score,
            "social_group_similarity": social_score,
            "guest_group_similarity": guest_score,
            "sleep_similarity": sleep_score,
            "cleanliness_similarity": cleanliness_score,
            "social_similarity": social_score,
            "guest_similarity": guest_score,
            "occupancy_ratio": occupancy_score,
        }
        overall_score = calculate_xgboost_score(xgb_scores, xgb_model)
        
        print(f"\n[COMPATIBILITY] ===== SCORE DETAILS =====")
        print(f"[COMPATIBILITY] User: {userId}, Room: {roomId}")
        print(f"[COMPATIBILITY]  scores: {xgb_scores}")
        print(f"[COMPATIBILITY] Overall score: {overall_score}%")
        
        reasons = explain_recommendation(scores)
        
        user_info = {
            "id": user.get('userId'), # Sửa thành 'userId'
            "name": user.get('fullName'),
            "email": user.get('email'),
            "preferences": {
                "budgetMin": user.get('budget_min_vnd'),  
                "budgetMax": user.get('budget_max_vnd'),       
                "preferredDistrict": user.get('preferred_location_district_id'), 
                "lifestyleArchetype": user.get('lifestyle_archetype'),
                "priorityCleanliness": user.get('priority_cleanliness'),
                "prioritySocialEnvironment": user.get('priority_social_environment'),
                "acceptSmokingRoommates": user.get('accept_smoking_roommates'),
                "acceptPets": user.get('accept_pets'),     
            }
        }
        
        room_info = {
            "id": room.get('roomId'), 
            "title": room.get('title'),
            "price": room.get('minimumBudget'),
            "district": room.get('districtId'),
            "requirements": {
                "cleanlinessRequired": room.get('cleanlinessRequired'),
                "noiseTolerance": room.get('noiseTolerance'),
                "guestPolicy": room.get('guestPolicy'),
                "preferredSleepHabit": room.get('preferredSleepHabit'),
                "allowSmoking": room.get('allowSmoking'),
                "allowPets": room.get('allowPets'),
                "currentOccupants": room.get('current_occupants'), 
                "maxOccupants": room.get('maxOccupants'),
            }
        }
        
        result = {
            "userId": userId,
            "roomId": roomId,
            "user_info": user_info,
            "room_info": room_info,
            "scores": scores,
            "reasons": reasons,
            "overall_score": round(overall_score, 2),
        }
        return convert_to_native_types(result)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "error": f"Error calculating compatibility: {str(e)}",
            "userId": userId,
            "roomId": roomId
        }
