# =====================================================
# FILE: services/collaborative_filtering.py
# =====================================================
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

def load_interactions_from_supabase():
    """Load interaction data from Supabase ai.room_interactions table"""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("[COLLABORATIVE FILTERING] Missing SUPABASE_URL or SUPABASE_KEY")
        return pd.DataFrame()
    
    try:
        # Create Supabase client with ai schema
        supabase = create_client(supabase_url, supabase_key, {
            'db': {'schema': 'ai'}
        })
        
        # Fetch all interactions
        response = supabase.table('room_interactions').select('*').execute()
        
        if not response.data:
            print("[COLLABORATIVE FILTERING] No interaction data found in Supabase")
            return pd.DataFrame()
        
        # Convert to DataFrame
        df = pd.DataFrame(response.data)
        
        # Map columns to expected format
        df = df.rename(columns={
            'user_id': 'userId',
            'room_id': 'roomId',
            'interaction_value': 'rating'
        })
        
        # Ensure required columns exist
        required_cols = ['userId', 'roomId', 'rating']
        if not all(col in df.columns for col in required_cols):
            print(f"[COLLABORATIVE FILTERING] Missing required columns. Available: {df.columns.tolist()}")
            return pd.DataFrame()
        
        print(f"[COLLABORATIVE FILTERING] Loaded {len(df)} interactions from Supabase")
        return df
        
    except Exception as e:
        print(f"[COLLABORATIVE FILTERING] Error loading from Supabase: {e}")
        return pd.DataFrame()

def calculate_collaborative_scores(interact_df, current_userId):

    # Nếu dữ liệu trống (User chưa tương tác gì), trả về dict rỗng
    if interact_df is None or interact_df.empty:
        return {}
    try:
        # 1. Tạo Ma trận Tương tác (Pivot Table)
        interaction_matrix = interact_df.pivot_table(
            index='userId', 
            columns='roomId', 
            values='rating', 
            aggfunc='max'
        ).fillna(0)
        # Kiểm tra xem user hiện tại có trong ma trận lịch sử tương tác không
        if current_userId not in interaction_matrix.index:
            return {}
        # 2. Tính toán ma trận độ tương đồng Cosine giữa các Người dùng
        user_sim_matrix = cosine_similarity(interaction_matrix)
        user_sim_df = pd.DataFrame(user_sim_matrix, index=interaction_matrix.index,
                                    columns=interaction_matrix.index)
        # 3. Lấy ra danh sách độ tương đồng của Người dùng hiện tại đối với các người dùng khác
        user_similarities = user_sim_df[current_userId].drop(current_userId)

        # Lọc bỏ các user hoàn toàn không tương đồng (độ tương đồng <= 0)
        user_similarities = user_similarities[user_similarities > 0]
        if user_similarities.empty:
            return {}
        # 4. Lấy ma trận tương tác của tất cả người dùng khác
        other_users_interactions = interaction_matrix.drop(current_userId)
        # 5. Dự đoán điểm số cho từng phòng
        predicted_scores = {}
        user_vector = interaction_matrix.loc[current_userId]
        for roomId in interaction_matrix.columns:
            # Nếu user hiện tại đã tương tác sâu (đặt/thuê phòng, rating >= 4.0), bỏ qua không gợi ý trùng lặp
            if user_vector[roomId] >= 4.0:
                continue              
            room_interactions = other_users_interactions[roomId]
            active_users = room_interactions[room_interactions > 0].index
            relevant_sims = user_similarities.reindex(active_users).dropna()
            relevant_interactions = room_interactions.reindex(relevant_sims.index)

            if not relevant_sims.empty and relevant_sims.sum() > 0:
                # Công thức Collaborative Filtering
                score = np.dot(relevant_sims, relevant_interactions) / relevant_sims.sum()
                # Chuẩn hóa điểm số dự đoán từ thang [1-5] về hệ [0.0 - 1.0]
                predicted_scores[roomId] = min(max(score / 5.0, 0.0), 1.0)
            else:
                predicted_scores[roomId] = 0.0

        return predicted_scores

    except Exception as e:
        print(f"[COLLABORATIVE FILTERING] Lỗi tính toán ma trận tương tác: {e}")
        return {}