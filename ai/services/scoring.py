# =====================================================
# SỬA FILE: services/scoring.py
# =====================================================
import pandas as pd

def calculate_colab_heuristic_score(scores_dict: dict) -> float:
    """
    Hàm tính điểm cốt lõi mô phỏng chính xác cấu trúc trọng số từ file Colab.
    Tất cả các trọng số được phân bổ dựa trên mức độ quan trọng trong bài toán Coliving.
    """
    # Định nghĩa bảng trọng số chuẩn hóa theo file Colab (Tổng = 1.0)
    weights = {
        # 1. Nền tảng vị trí & kinh tế (30%)
        "location_similarity": 0.15,
        "budget_similarity": 0.15,
        
        # 2. Thói quen sinh hoạt & Nhịp sinh học (40%)
        "cleanliness_similarity": 0.15,
        "sleep_similarity": 0.15,
        "social_similarity": 0.10,
        
        # 3. Quy định cứng & Khác (30%)
        "smoking_match": 0.10,
        "pet_match": 0.10,
        "occupancy_ratio": 0.10
    }
    
    weighted_sum = 0.0
    total_weight = 0.0
    
    for feature, weight in weights.items():
        # Lấy điểm số của từng thuộc tính (đã được chuẩn hóa về đoạn [0, 1])
        val = scores_dict.get(feature, 0.5)
        weighted_sum += val * weight
        total_weight += weight
        
    if total_weight == 0:
        return 50.0
        
    # Quy đổi kết quả về hệ điểm % (0.0 -> 100.0)
    colab_score = (weighted_sum / total_weight) * 100
    return round(colab_score, 2)


def calculate_xgboost_score(scores_dict, model=None) -> float:
    """
    Hàm tính điểm tổng hợp cuối cùng, đặt trọn tâm tư duy vào mô hình Colab.
    """
    # 1. Tính toán điểm Heuristic theo thuật toán cấu trúc của file Colab trước
    colab_score = calculate_colab_heuristic_score(scores_dict)
    
    # 2. Nếu không có model XGBoost, sử dụng 100% điểm của file Colab
    if model is None:
        return colab_score
        
    try:
        feature_columns = [
            'location_similarity', 'budget_similarity', 'smoking_match', 'pet_match',
            'sleep_group_similarity', 'cleanliness_group_similarity', 'social_group_similarity', 'guest_group_similarity',
            'sleep_similarity', 'cleanliness_similarity', 'social_similarity', 'guest_similarity', 'occupancy_ratio'
        ]
        row_data = {col: scores_dict.get(col, 0.5) for col in feature_columns}
        X = pd.DataFrame([row_data])
        
        # Điểm xác suất từ XGBoost (0.0 -> 100.0)
        xgb_prob = model.predict_proba(X)[0, 1] * 100
        
        final_score = (colab_score * 0.85) + (xgb_prob * 0.15)
        return round(final_score, 2)
        
    except Exception as e:
        print(f"[SCORING] XGBoost error, hạ tầng tự động Fallback dùng 100% điểm Colab: {e}")
        return colab_score