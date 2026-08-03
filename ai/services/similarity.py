# =====================================================
# IMPORTS
# =====================================================

import math
import random
from decimal import Decimal, InvalidOperation
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics.pairwise import cosine_similarity
# =====================================================
# CONSTANTS
# =====================================================

# Giảm trần điểm tối đa xuống để khó đạt > 90%
MAX_SIMILARITY = 0.95
MIN_SIMILARITY = 0.1


def _to_float(value, default=0.0):
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
    except (TypeError, ValueError, InvalidOperation):
        return float(default)


def location_similarity(user_loc, room_loc):
    if not user_loc or not room_loc:
        return MIN_SIMILARITY
    if user_loc == room_loc:
        return 0.75
    return 0.15

def budget_similarity(
    user_budget_min,
    user_budget_max,
    room_price
):
    user_budget_min = _to_float(user_budget_min, 0.0)
    user_budget_max = _to_float(user_budget_max, 0.0)
    room_price = _to_float(room_price, 0.0)

    if room_price <= 0:
        return MIN_SIMILARITY

    # Perfect range match
    if (
        user_budget_min
        <= room_price
        <= user_budget_max
    ):
        # Khớp ngân sách vẫn chỉ được điểm khá, không phải xuất sắc
        return 0.75

    # Distance from nearest budget bound
    diff = min(
        abs(room_price - user_budget_min),
        abs(room_price - user_budget_max)
    )

    ratio = diff / room_price
    similarity = math.exp(-6 * ratio)

    similarity = max(
        min(similarity, MAX_SIMILARITY),
        MIN_SIMILARITY
    )

    return round(similarity, 4)


# =====================================================
# BINARY MATCH
# =====================================================

def binary_match(a, b):
    """
    Match nhị phân: Khớp thì khá tốt, không khớp thì rất tệ.
    """
    if a is None or b is None:
        return 0.2 # Giảm điểm default

    return 0.75 if a == b else 0.1


# =====================================================
# OCCUPANCY
# =====================================================

def occupancy_ratio(current, maximum):
    current = _to_float(current, 0.0)
    maximum = _to_float(maximum, 0.0)

    if maximum <= 0:
        return 0.5

    ratio = current / maximum

    score = 1 - (ratio * 0.9)

    score = max(
        min(score, MAX_SIMILARITY),
        MIN_SIMILARITY
    )

    return round(score, 4)


# =====================================================
# CLEANLINESS COMPATIBILITY
# =====================================================

def cleanliness_compatibility(
    user_priority,
    room_requirement
):
    requirement_map = {
        "low": 1,
        "medium": 3,
        "high": 5
    }

    room_priority = requirement_map.get(
        str(room_requirement or "medium").lower(),
        3
    )
    user_priority = _to_float(user_priority, 3.0)

    diff = abs(user_priority - room_priority)
    penalty = ((diff / 4.0) ** 3) * 1.5
    compatibility = 1 - penalty
    compatibility = max(
        min(compatibility, MAX_SIMILARITY),
        MIN_SIMILARITY
    )

    return round(compatibility, 4)
# =====================================================
# SOCIAL COMPATIBILITY
# =====================================================

def social_compatibility(
    user_social_priority,
    room_noise_tolerance,
    room_guest_policy
):
    noise_map = {
        "low": 1,
        "medium": 3,
        "high": 5
    }

    guest_map = {
        "rarely": 1,
        "occasionally": 3,
        "frequently": 5
    }

    noise_score = noise_map.get(
        str(room_noise_tolerance or "medium").lower(),
        3
    )

    guest_score = guest_map.get(
        str(room_guest_policy or "occasionally").lower(),
        3
    )

    user_social_priority = _to_float(user_social_priority, 3.0)

    room_social = (noise_score + guest_score) / 2

    diff = abs(user_social_priority - room_social)

    # Tương tự cleanliness, dùng bậc 3 và hệ số phạt
    penalty = ((diff / 4.0) ** 3) * 1.5
    
    compatibility = 1 - penalty

    compatibility = max(
        min(compatibility, MAX_SIMILARITY),
        MIN_SIMILARITY
    )

    return round(compatibility, 4)


# =====================================================
# SLEEP COMPATIBILITY
# =====================================================

def sleep_compatibility(
    user_archetype,
    room_sleep_habit
):
    archetype_sleep_map = {
        "Privacy Seeker": 1,
        "Remote Worker": 2,
        "Social Butterfly": 5,
        "Student": 4,
        "Young Professional": 3
    }

    sleep_map = {
        "early": 1,
        "normal": 3,
        "late": 5
    }

    user_sleep = archetype_sleep_map.get(
        user_archetype,
        3
    )

    room_sleep = sleep_map.get(
        room_sleep_habit.lower(),
        3
    )

    diff = abs(user_sleep - room_sleep)

    # Giấc ngủ là yếu tố quan trọng, phạt rất nặng nếu lệch
    # Diff=2 (ví dụ Early vs Normal) phải bị phạt mạnh
    penalty = ((diff / 4.0) ** 2.5) * 1.8
    
    compatibility = 1 - penalty

    compatibility = max(
        min(compatibility, MAX_SIMILARITY),
        MIN_SIMILARITY
    )

    return round(compatibility, 4)


# =====================================================
# GUEST TOLERANCE
# =====================================================

def guest_tolerance_compatibility(
    user_social_priority,
    room_guest_policy
):
    guest_map = {
        "rarely": 1,
        "occasionally": 3,
        "frequently": 5
    }

    policy_score = guest_map.get(
        str(room_guest_policy or "occasionally").lower(),
        3
    )

    user_social_priority = _to_float(user_social_priority, 3.0)

    diff = abs(user_social_priority - policy_score)

    # Phạt nặng
    penalty = ((diff / 4.0) ** 3) * 1.5
    
    compatibility = 1 - penalty

    compatibility = max(
        min(compatibility, MAX_SIMILARITY),
        MIN_SIMILARITY
    )

    return round(compatibility, 4)


# =====================================================
# ROOMMATE CLEANLINESS AVG
# =====================================================

def roommate_cleanliness_avg(
    roommate_ids,
    users_df
):
    if not roommate_ids:
        return 3 # Neutral

    indexed_users = users_df.set_index("userId")

    cleanliness_values = []

    for roommate_id in roommate_ids:
        if roommate_id in indexed_users.index:
            cleanliness_values.append(
                indexed_users.loc[
                    roommate_id,
                    "priority_cleanliness"
                ]
            )

    if not cleanliness_values:
        return 3

    return sum(cleanliness_values) / len(cleanliness_values)


# =====================================================
# ROOMMATE SOCIAL AVG
# =====================================================

def roommate_social_avg(
    roommate_ids,
    users_df
):
    if not roommate_ids:
        return 3 # Neutral

    indexed_users = users_df.set_index("userId")

    social_values = []

    for roommate_id in roommate_ids:
        if roommate_id in indexed_users.index:
            social_values.append(
                indexed_users.loc[
                    roommate_id,
                    "priority_social_environment"
                ]
            )

    if not social_values:
        return 3

    return sum(social_values) / len(social_values)


# =====================================================
# COMPATIBILITY WITH ROOMMATES
# =====================================================

def compatibility_with_roommates(
    user_cleanliness,
    user_social,
    roommate_ids,
    users_df
):
    user_cleanliness = _to_float(user_cleanliness, 3.0)
    user_social = _to_float(user_social, 3.0)

    if not roommate_ids:
        return 0.3 # Giảm điểm default nếu không có roommate info

    indexed_users = users_df.set_index("userId")

    compatibility_scores = []

    for roommate_id in roommate_ids:
        if roommate_id in indexed_users.index:
            roommate = indexed_users.loc[roommate_id]

            # -------------------------
            # CLEANLINESS
            # -------------------------
            roommate_cleanliness = _to_float(roommate["priority_cleanliness"], 3.0)
            clean_diff = abs(user_cleanliness - roommate_cleanliness)
            # Phạt nặng: bậc 3
            clean_score = 1 - ((clean_diff / 4.0) ** 3) * 1.5

            # -------------------------
            # SOCIAL
            # -------------------------
            roommate_social = _to_float(roommate["priority_social_environment"], 3.0)
            social_diff = abs(user_social - roommate_social)
            # Phạt nặng: bậc 3
            social_score = 1 - ((social_diff / 4.0) ** 3) * 1.5

            # Weighted average
            avg_compatibility = (clean_score * 0.6 + social_score * 0.4)

            # GIẢM ĐIỂM TỔNG THỂ: Nhân với 0.7 thay vì 0.85
            # Điều này đảm bảo ngay cả khi match tốt, điểm cũng chỉ quanh 0.5-0.6
            avg_compatibility *= 0.7

            avg_compatibility = max(
                min(avg_compatibility, MAX_SIMILARITY),
                MIN_SIMILARITY
            )

            compatibility_scores.append(avg_compatibility)

    if not compatibility_scores:
        return 0.3

    final_score = sum(compatibility_scores) / len(compatibility_scores)

    # Small randomness to avoid duplicates (giữ nguyên nhưng biên độ nhỏ)
    final_score += random.uniform(-0.01, 0.01)

    # Hard cap ở 0.80 thay vì 0.90
    final_score = max(
        min(final_score, 0.80),
        MIN_SIMILARITY
    )

    return round(final_score, 4)

def calculate_cluster_lifestyle_similarity(users_df, current_userId, target_room_occupants):
 
    if not target_room_occupants: # Phòng trống
        return 0.5 # Điểm trung bình mặc định

    # Chọn các cột lối sống giống như trong mô hình phân cụm của PDF
    lifestyle_cols = [
        'priority_cleanliness', 
        'priority_social_environment', 
        'sleep_habit', # Đảm bảo dạng số hóa (0, 1, 2..)
        'guest_tolerance'
    ]
    
    # Lọc các cột hợp lệ hiện có trong dataframe của bạn
    available_cols = [col for col in lifestyle_cols if col in users_df.columns]
    
    if len(available_cols) < 2:
        return 0.5

    # Chuẩn hóa dữ liệu lối sống
    scaler = MinMaxScaler()
    X = scaler.fit_transform(users_df[available_cols].fillna(3)) # Điền mặc định mức trung bình (3/5)

    # Bước 2: K-means Clustering (chia làm 4 nhóm lối sống chính)
    kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
    users_df['cluster_lifestyle'] = kmeans.fit_predict(X)

    # Lấy thông tin cụm và vector của User hiện tại
    userIdx = users_df[users_df['userId'] == current_userId].index
    if userIdx.empty:
        return 0.5
    
    current_user_cluster = users_df.loc[userIdx[0], 'cluster_lifestyle']
    current_user_vector = X[userIdx[0]].reshape(1, -1)

    # Bước 3: Tính Cosine Similarity với những người cùng phòng mục tiêu
    roommate_similarities = []
    
    for roommate_id in target_room_occupants:
        rm_idx = users_df[users_df['userId'] == roommate_id].index
        if rm_idx.empty:
            continue
            
        # Thưởng điểm nếu cùng Nhóm Cụm lối sống (K-means)
        cluster_bonus = 1.2 if users_df.loc[rm_idx[0], 'cluster_lifestyle'] == current_user_cluster else 1.0
        
        # Tính độ tương đồng hình học Cosine (Collaborative Filtering tư duy từ PDF)
        rm_vector = X[rm_idx[0]].reshape(1, -1)
        sim = cosine_similarity(current_user_vector, rm_vector)[0][0]
        
        roommate_similarities.append(sim * cluster_bonus)

    if not roommate_similarities:
        return 0.4

    # Trả về độ tương đồng trung bình với các bạn cùng phòng (giới hạn trong khoảng 0-1)
    final_sim = sum(roommate_similarities) / len(roommate_similarities)
    return float(np.clip(final_sim, 0.0, 1.0))