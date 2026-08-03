import { useCallback } from 'react';
import { InteractionType } from '@/lib/services/interaction.service';

interface UseInteractionOptions {
  userId?: string;
  roomId?: string;
}

export function useInteraction({ userId, roomId }: UseInteractionOptions) {
  const logInteraction = useCallback(
    async (interactionType: InteractionType, sourceCreatedAt?: Date) => {
      if (!userId || !roomId) {
        console.warn('[useInteraction] Missing userId or roomId');
        return;
      }

      try {
        await fetch('/api/interactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            roomId,
            interactionType,
            sourceCreatedAt: sourceCreatedAt?.toISOString(),
          }),
        });
      } catch (error) {
        console.error('[useInteraction] Failed to log interaction:', error);
        // Không throw error để không ảnh hưởng UX
      }
    },
    [userId, roomId]
  );

  const logImpression = useCallback(() => {
    logInteraction('impression');
  }, [logInteraction]);

  const logClick = useCallback(() => {
    logInteraction('click');
  }, [logInteraction]);

  const logViewDetail = useCallback((sourceCreatedAt?: Date) => {
    logInteraction('view_detail', sourceCreatedAt);
  }, [logInteraction]);

  const logSave = useCallback(() => {
    logInteraction('save');
  }, [logInteraction]);

  const logApply = useCallback(() => {
    logInteraction('apply');
  }, [logInteraction]);

  return {
    logInteraction,
    logImpression,
    logClick,
    logViewDetail,
    logSave,
    logApply,
  };
}
