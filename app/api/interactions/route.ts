import { NextRequest, NextResponse } from 'next/server';
import { interactionService, InteractionType } from '@/lib/services/interaction.service';
import { handleApiError, successResponse } from '@/lib/api-error';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, roomId, interactionType, sourceCreatedAt } = body;

    // Validate input
    if (!userId || !roomId || !interactionType) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, roomId, interactionType' },
        { status: 400 }
      );
    }

    // Validate interaction type
    const validTypes: InteractionType[] = ['impression', 'click', 'save', 'view_detail', 'apply'];
    if (!validTypes.includes(interactionType)) {
      return NextResponse.json(
        { error: 'Invalid interaction type. Must be one of: impression, click, save, view_detail, apply' },
        { status: 400 }
      );
    }

    // Log interaction
    await interactionService.logInteraction({
      userId,
      roomId,
      interactionType,
      sourceCreatedAt: sourceCreatedAt ? new Date(sourceCreatedAt) : undefined,
    });

    return successResponse({ success: true, message: 'Interaction logged successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const roomId = searchParams.get('roomId');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    if (roomId) {
      // Get interactions for specific user-room pair
      const interactions = await interactionService.getUserRoomInteractions(userId, roomId);
      return successResponse({ interactions });
    } else {
      // Get all interactions for user
      const interactions = await interactionService.getUserInteractions(userId, limit);
      return successResponse({ interactions });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
