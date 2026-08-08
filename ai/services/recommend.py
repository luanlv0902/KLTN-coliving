
import pandas as pd
from decimal import Decimal
from utils.loader_supabase import (
    users_df,
    rooms_df,
    occupancy_df,
    interact_df, 
    model,
    cache_lock,
    use_ai_projections,
    refresh_projection_cache,
    load_users_from_supabase,
    load_interactions_from_supabase,
    load_service_rows_live,
)
from services.similarity import (
    location_similarity,
    budget_similarity,
    binary_match,
    occupancy_ratio,
    cleanliness_compatibility,
    social_compatibility,
    sleep_compatibility,
    guest_tolerance_compatibility
)
from services.collaborative_filtering import calculate_collaborative_scores
from services.scoring import calculate_xgboost_score
from services.roommate import get_roommates
from services.explain import explain_recommendation


def _safe_float(value, default=0.0):
    if value is None:
        return float(default)
    if isinstance(value, Decimal):
        return float(value)
    try:
        if pd.isna(value):
            return float(default)
    except (TypeError, ValueError):
        pass
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _safe_optional_float(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _derive_preferred_coordinates(preferred_district, rooms: pd.DataFrame):
    district = str(preferred_district or "").strip()
    if not district or district.lower() == "all":
        return None, None

    if "districtId" not in rooms.columns:
        return None, None

    district_rooms = rooms[rooms["districtId"] == district]
    if district_rooms.empty:
        return None, None

    lat_series = pd.to_numeric(district_rooms.get("latitude"), errors="coerce")
    lng_series = pd.to_numeric(district_rooms.get("longitude"), errors="coerce")
    valid_mask = lat_series.notna() & lng_series.notna()
    if not valid_mask.any():
        return None, None

    target_lat = float(lat_series[valid_mask].median())
    target_lng = float(lng_series[valid_mask].median())
    return target_lat, target_lng


def _replace_in_place(target_df: pd.DataFrame, source_df: pd.DataFrame) -> None:
    target_df.drop(target_df.index, inplace=True)
    if len(target_df.columns) > 0:
        target_df.drop(columns=list(target_df.columns), inplace=True)
    for column in source_df.columns:
        target_df[column] = source_df[column].to_numpy(copy=True)
    target_df.reset_index(drop=True, inplace=True)


def _refresh_runtime_data() -> None:
    """Keep in-memory dataframes synchronized with latest preference/interaction changes."""
    if use_ai_projections():
        refresh_projection_cache()
        live_users = pd.DataFrame(load_service_rows_live("users"))
        live_preferences = pd.DataFrame(load_service_rows_live("preferences"))
        live_interactions = pd.DataFrame(load_service_rows_live("interactions"))

        if not live_users.empty:
            live_users = live_users.rename(columns={"id": "userId"})
            if not live_preferences.empty:
                live_users = live_users.merge(live_preferences, on="userId", how="left")
            live_users = live_users.loc[:, ~live_users.columns.duplicated()]
            live_users["budgetMinVnd"] = live_users["budgetMinVnd"].fillna(3000000)
            live_users["budgetMaxVnd"] = live_users["budgetMaxVnd"].fillna(15000000)
            live_users["preferredDistrict"] = live_users["preferredDistrict"].fillna("all")
            live_users["lifestyleArchetype"] = live_users["lifestyleArchetype"].fillna("Young Professional")
            live_users["priorityCleanliness"] = live_users["priorityCleanliness"].fillna(3)
            live_users["prioritySocialEnvironment"] = live_users["prioritySocialEnvironment"].fillna(3)
            live_users["acceptSmokingRoommates"] = live_users["acceptSmokingRoommates"].fillna(False)
            live_users["acceptPets"] = live_users["acceptPets"].fillna(False)
            live_users = live_users.rename(columns={
                "budgetMinVnd": "budget_min_vnd",
                "budgetMaxVnd": "budget_max_vnd",
                "preferredDistrict": "preferred_location_district_id",
                "lifestyleArchetype": "lifestyle_archetype",
                "priorityCleanliness": "priority_cleanliness",
                "prioritySocialEnvironment": "priority_social_environment",
                "acceptSmokingRoommates": "accept_smoking_roommates",
                "acceptPets": "accept_pets",
            }).reset_index(drop=True)

        if not live_interactions.empty:
            live_interactions = live_interactions.rename(columns={"interactionValue": "rating"})

        with cache_lock:
            if not live_users.empty:
                _replace_in_place(users_df, live_users)
            _replace_in_place(interact_df, live_interactions)
        return

    fresh_users = load_users_from_supabase()
    fresh_interactions = load_interactions_from_supabase()
    with cache_lock:
        _replace_in_place(users_df, fresh_users)
        _replace_in_place(interact_df, fresh_interactions)

def recommend_rooms(userId, top_k=10):
    print(f"\n[RECOMMEND] ===== STARTING RECOMMENDATIONS =====")
    print(f"[RECOMMEND] User ID: {userId}, Top K: {top_k}")
    _refresh_runtime_data()
    cf_scores_dict = calculate_collaborative_scores(interact_df, userId)

    if users_df.empty or userId not in users_df["userId"].values:
        print(f" User {userId} không tìm thấy hoặc dữ liệu trống.")
        return pd.DataFrame()

    user = users_df[users_df["userId"] == userId].iloc[0]
    user_budget_min = _safe_float(user.get("budget_min_vnd"), 3000000)
    user_budget_max = _safe_float(user.get("budget_max_vnd"), 15000000)
    priority_cleanliness = _safe_float(user.get("priority_cleanliness"), 3)
    priority_social_environment = _safe_float(user.get("priority_social_environment"), 3)
    preferred_district = user.get("preferred_location_district_id")
    preferred_lat, preferred_lng = _derive_preferred_coordinates(preferred_district, rooms_df)

    def build_rows(enforce_preference_filters: bool, enforce_capacity: bool):
        rows = []
        for _, room in rooms_df.iterrows():
            if enforce_capacity and room["current_occupants"] >= room["maxOccupants"]:
                continue
            if enforce_preference_filters and room.get("allowSmoking") == True and user.get("accept_smoking_roommates") == False:
                continue
            if enforce_preference_filters and room.get("allowPets") == False and user.get("accept_pets") == True:
                continue

            roomId = room["roomId"]
            cf_score = cf_scores_dict.get(roomId, 0.5)
            room_minimum_budget = _safe_float(room.get("minimumBudget"), 5000000)
            room_current_occupants = _safe_float(room.get("current_occupants"), 0)
            room_max_occupants = _safe_float(room.get("maxOccupants"), 1)
            room_latitude = _safe_optional_float(room.get("latitude"))
            room_longitude = _safe_optional_float(room.get("longitude"))

            row = {
                "location_similarity": location_similarity(
                    preferred_district,
                    room["districtId"],
                    preferred_lat,
                    preferred_lng,
                    room_latitude,
                    room_longitude,
                ),
                "budget_similarity": budget_similarity(user_budget_min, user_budget_max, room_minimum_budget),
                "smoking_match": binary_match(user["accept_smoking_roommates"], room["allowSmoking"]),
                "pet_match": binary_match(user["accept_pets"], room["allowPets"]),
                "sleep_similarity": sleep_compatibility(user["lifestyle_archetype"], room["preferredSleepHabit"]),
                "cleanliness_similarity": cleanliness_compatibility(priority_cleanliness, room["cleanlinessRequired"]),
                "social_similarity": social_compatibility(priority_social_environment, room["noiseTolerance"], room["guestPolicy"]),
                "guest_similarity": guest_tolerance_compatibility(priority_social_environment, room["guestPolicy"]),
                "occupancy_ratio": occupancy_ratio(room_current_occupants, room_max_occupants),
                "cf_score": cf_score,
                "roomId": roomId,
                "title": room.get("title", "Phòng Coliving"),
                "districtId": room["districtId"],
                "latitude": room_latitude,
                "longitude": room_longitude,
                "price": room_minimum_budget,
            }
            rows.append(row)
        return rows

    rows = build_rows(enforce_preference_filters=True, enforce_capacity=True)
    if not rows:
        print("[RECOMMEND] No strict-match rooms found; returning fallback default rooms.")
        rows = build_rows(enforce_preference_filters=False, enforce_capacity=True)

    if not rows:
        print("[RECOMMEND] All available rooms were filtered out by capacity; returning extended fallback rooms.")
        rows = build_rows(enforce_preference_filters=False, enforce_capacity=False)

    if not rows:
        print("[RECOMMEND] No rooms available to recommend.")
        return pd.DataFrame()

    recommend_df = pd.DataFrame(rows)

    def calculate_row_score(row):
        # Trọng số phân bổ ưu tiên chính xác theo cấu trúc mô hình file 
        weights = {
            "location_similarity": 0.15,
            "budget_similarity": 0.15,
            "cleanliness_similarity": 0.15,
            "sleep_similarity": 0.15,
            "social_similarity": 0.10,
            "smoking_match": 0.10,
            "pet_match": 0.10,
            "occupancy_ratio": 0.10
        }
        # Tính toán điểm Heuristic cơ bản
        colab_heuristic_score = sum(row.get(feat, 0.5) * weight for feat, weight in weights.items())
        # 80% Điểm Heuristic cốt lõi + 20% Điểm Lọc cộng tác hành vi thực tế (cf_score)
        final_score = (colab_heuristic_score * 0.80) + (row.get("cf_score", 0.5) * 0.20)
        
        return round(final_score, 4)
    
    # Áp dụng tính điểm
    recommend_df["recommendation_score"] = recommend_df.apply(calculate_row_score, axis=1)

    def apply_explanation(row):
        exp_data = explain_recommendation(row)
        return pd.Series({
            "status": exp_data["status"],
            "explanation": exp_data["explanation"],
            "score_breakdown": exp_data.get("score_breakdown"),
            "positive_reasons": exp_data.get("positive_reasons"),
            "concerns": exp_data.get("concerns"),
        })

    # Merge giải thích vào DataFrame
    explanation_df = recommend_df.apply(apply_explanation, axis=1)
    recommend_df = pd.concat([recommend_df, explanation_df], axis=1)

    # Sắp xếp phòng có điểm tương thích cao nhất lên đầu
    recommend_df = recommend_df.sort_values(by="recommendation_score", ascending=False)
    
    return recommend_df.head(top_k)