import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: {
    schema: 'ai',
  },
});

export type InteractionType = 
  | 'impression'    // Lượt xem: 0.1
  | 'click'         // Lượt nhấn: 0.3
  | 'save'          // Lưu phòng: 0.7
  | 'view_detail'   // Xem thông tin: 0.5
  | 'apply';        // Gửi yêu cầu đặt phòng: 0.9

export const INTERACTION_VALUES: Record<InteractionType, number> = {
  impression: 0.1,
  click: 0.3,
  save: 0.7,
  view_detail: 0.5,
  apply: 0.9,
};

export interface InteractionData {
  userId: string;
  roomId: string;
  interactionType: InteractionType;
  sourceCreatedAt?: Date;
}

export class InteractionService {
  /**
   * Ghi log tương tác người dùng vào bảng ai.room_interactions
   */
  async logInteraction(data: InteractionData): Promise<void> {
    const { userId, roomId, interactionType, sourceCreatedAt } = data;
    const interactionValue = INTERACTION_VALUES[interactionType];

    const { error } = await supabase.from('room_interactions').insert({
      interaction_id: crypto.randomUUID(),
      user_id: userId,
      room_id: roomId,
      interaction_type: interactionType,
      interaction_value: interactionValue,
      source_created_at: sourceCreatedAt?.toISOString() || null,
      projected_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[InteractionService] Failed to log interaction:', error);
      // Không throw error để không ảnh hưởng đến flow chính
    }
  }

  /**
   * Ghi log nhiều tương tác cùng lúc (batch)
   */
  async logInteractionsBatch(interactions: InteractionData[]): Promise<void> {
    const records = interactions.map((data) => ({
      interaction_id: crypto.randomUUID(),
      user_id: data.userId,
      room_id: data.roomId,
      interaction_type: data.interactionType,
      interaction_value: INTERACTION_VALUES[data.interactionType],
      source_created_at: data.sourceCreatedAt?.toISOString() || null,
      projected_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('room_interactions').insert(records);

    if (error) {
      console.error('[InteractionService] Failed to log interactions batch:', error);
    }
  }

  /**
   * Lấy lịch sử tương tác của một người dùng với một phòng
   */
  async getUserRoomInteractions(userId: string, roomId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('room_interactions')
      .select('*')
      .eq('user_id', userId)
      .eq('room_id', roomId)
      .order('projected_at', { ascending: false });

    if (error) {
      console.error('[InteractionService] Failed to get user room interactions:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Lấy tất cả tương tác của một người dùng
   */
  async getUserInteractions(userId: string, limit = 100): Promise<any[]> {
    const { data, error } = await supabase
      .from('room_interactions')
      .select('*')
      .eq('user_id', userId)
      .order('projected_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[InteractionService] Failed to get user interactions:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Tính tổng điểm tương tác của người dùng với phòng
   */
  async getUserRoomScore(userId: string, roomId: string): Promise<number> {
    const { data, error } = await supabase
      .from('room_interactions')
      .select('interaction_value')
      .eq('user_id', userId)
      .eq('room_id', roomId);

    if (error) {
      console.error('[InteractionService] Failed to get user room score:', error);
      return 0;
    }

    if (!data || data.length === 0) {
      return 0;
    }

    return data.reduce((sum, record) => sum + (record.interaction_value || 0), 0);
  }
}

export const interactionService = new InteractionService();
