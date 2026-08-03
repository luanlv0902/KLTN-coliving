'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useInteraction } from '@/lib/hooks/useInteraction';

type RoomDetailInteractionLoggerProps = {
  roomId: string;
};

export function RoomDetailInteractionLogger({ roomId }: RoomDetailInteractionLoggerProps) {
  const { user } = useAuth();
  const { logViewDetail } = useInteraction({ userId: user?.id, roomId });

  useEffect(() => {
    // Log view_detail interaction when room detail page is loaded
    logViewDetail();
  }, [logViewDetail]);

  return null; // This component doesn't render anything
}
