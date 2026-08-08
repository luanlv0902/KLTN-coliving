
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


MAJOR_CITY_DISTRICTS = {
    "HA_NOI": {
        "BA_DINH", "HOAN_KIEM", "HAI_BA_TRUNG", "DONG_DA", "TAY_HO", "CAU_GIAY",
        "THANH_XUAN", "HOANG_MAI", "LONG_BIEN", "BAC_TU_LIEM", "NAM_TU_LIEM",
        "HA_DONG", "DONG_ANH", "GIA_LAM", "THANH_TRI", "SOC_SON", "ME_LINH",
        "CHUONG_MY", "THANH_OAI", "THUONG_TIN", "HOAI_DUC", "DAN_PHUONG",
        "QUOC_OAI", "THACH_THAT", "PHUC_THO", "BA_VI", "SON_TAY", "MY_DUC",
        "PHU_XUYEN", "UNG_HOA",
    },
    "HO_CHI_MINH": {
        "SAI_GON", "TAN_DINH", "BEN_THANH", "CAU_ONG_LANH", "BAN_CO", "XUAN_HOA",
        "NHIEU_LOC", "XOM_CHIEU", "KHANH_HOI", "VINH_HOI", "CHO_QUAN", "AN_DONG",
        "CHO_LON", "BINH_TAY", "BINH_TIEN", "BINH_PHU", "PHU_LAM", "TAN_THUAN",
        "PHU_THUAN", "TAN_MY", "TAN_HUNG", "CHANH_HUNG", "PHU_DINH", "BINH_DONG",
        "DIEN_HONG", "VUON_LAI", "HOA_HUNG", "MINH_PHUNG", "BINH_THOI", "HOA_BINH",
        "PHU_THO", "DONG_HUNG_THUAN", "TRUNG_MY_TAY", "TAN_THOI_HIEP", "THOI_AN",
        "AN_PHU_DONG", "AN_LAC", "TAN_TAO", "BINH_TAN", "BINH_TRI_DONG",
        "BINH_HUNG_HOA", "GIA_DINH", "BINH_THANH", "BINH_LOI_TRUNG", "THANH_MY_TAY",
        "BINH_QUOI", "HANH_THONG", "AN_NHON", "GO_VAP", "AN_HOI_DONG",
        "THONG_TAY_HOI", "AN_HOI_TAY", "DUC_NHUAN", "CAU_KIEU", "PHU_NHUAN",
        "TAN_SON_HOA", "TAN_SON_NHAT", "TAN_HOA", "BAY_HIEN", "TAN_BINH", "TAN_SON",
        "TAY_THANH", "TAN_SON_NHI", "PHU_THO_HOA", "TAN_PHU", "PHU_THANH", "HIEP_BINH",
        "THU_DUC", "TAM_BINH", "LINH_XUAN", "TANG_NHON_PHU", "LONG_BINH", "LONG_PHUOC",
        "LONG_TRUONG", "CAT_LAI", "BINH_TRUNG", "PHUOC_LONG", "AN_KHANH", "VINH_LOC",
        "TAN_VINH_LOC", "BINH_LOI", "TAN_NHUT", "BINH_CHANH", "HUNG_LONG", "BINH_HUNG",
        "BINH_KHANH", "AN_THOI_DONG", "CAN_GIO", "CU_CHI", "TAN_AN_HOI", "THAI_MY",
        "AN_NHON_TAY", "NHUAN_DUC", "PHU_HOA_DONG", "BINH_MY", "DONG_THANH", "HOC_MON",
        "XUAN_THOI_SON", "BA_DIEM", "NHA_BE", "HIEP_PHUOC", "THANH_AN", "DONG_HOA",
        "DI_AN", "TAN_DONG_HIEP",
    },
    "DA_NANG": {
        "HAI_CHAU", "THANH_KHE", "SON_TRA", "NGU_HANH_SON", "LIEN_CHIEU", "CAM_LE",
        "HOA_VANG", "HOANG_SA",
    },
}

MAJOR_CITY_ALIAS = {
    "HA_NOI": "HA_NOI",
    "HANOI": "HA_NOI",
    "HN": "HA_NOI",
    "HO_CHI_MINH": "HO_CHI_MINH",
    "HCM": "HO_CHI_MINH",
    "HCMC": "HO_CHI_MINH",
    "TPHCM": "HO_CHI_MINH",
    "SAI_GON": "HO_CHI_MINH",
    "DA_NANG": "DA_NANG",
    "DANANG": "DA_NANG",
    "DN": "DA_NANG",
}

MAJOR_CITY_GEO_BOUNDS = {
    "HA_NOI": {"lat_min": 20.80, "lat_max": 21.30, "lng_min": 105.55, "lng_max": 106.05},
    "HO_CHI_MINH": {"lat_min": 10.30, "lat_max": 11.20, "lng_min": 106.30, "lng_max": 107.05},
    "DA_NANG": {"lat_min": 15.90, "lat_max": 16.25, "lng_min": 107.95, "lng_max": 108.35},
}


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


def _infer_major_city_from_geo(latitude, longitude):
    lat = _safe_optional_float(latitude)
    lng = _safe_optional_float(longitude)
    if lat is None or lng is None:
        return None
    for city, bounds in MAJOR_CITY_GEO_BOUNDS.items():
        if bounds["lat_min"] <= lat <= bounds["lat_max"] and bounds["lng_min"] <= lng <= bounds["lng_max"]:
            return city
    return None


def _infer_major_city(area_code, latitude=None, longitude=None, district_text=None, address_text=None):
    code = str(area_code or "").strip().upper()
    if not code:
        code = ""
    if code in MAJOR_CITY_ALIAS:
        return MAJOR_CITY_ALIAS[code]
    for city, districts in MAJOR_CITY_DISTRICTS.items():
        if code in districts:
            return city

    city_from_geo = _infer_major_city_from_geo(latitude, longitude)
    if city_from_geo:
        return city_from_geo

    text = f"{district_text or ''} {address_text or ''}".strip().upper()
    if "HA NOI" in text or "HANOI" in text:
        return "HA_NOI"
    if "HO CHI MINH" in text or "TP HCM" in text or "TPHCM" in text or "SAI GON" in text:
        return "HO_CHI_MINH"
    if "DA NANG" in text or "DANANG" in text:
        return "DA_NANG"

    return None


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
    preferred_major_city = _infer_major_city(preferred_district)
    preferred_lat, preferred_lng = _derive_preferred_coordinates(preferred_district, rooms_df)

    def build_rows(enforce_preference_filters: bool, enforce_capacity: bool):
        rows = []
        for _, room in rooms_df.iterrows():
            room_major_city = _infer_major_city(
                room.get("districtId"),
                room.get("latitude"),
                room.get("longitude"),
                room.get("district"),
                room.get("address"),
            )
            if preferred_major_city and room_major_city != preferred_major_city:
                continue
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
                "major_city_match": 1.0 if preferred_major_city and preferred_major_city == room_major_city else 0.0,
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
        weights = {
            "major_city_match": 0.30,
            "location_similarity": 0.12,
            "budget_similarity": 0.12,
            "cleanliness_similarity": 0.12,
            "sleep_similarity": 0.10,
            "social_similarity": 0.08,
            "smoking_match": 0.08,
            "pet_match": 0.04,
            "occupancy_ratio": 0.04,
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