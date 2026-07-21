import { Router } from 'express';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

// Get paginated notifications
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  try {
    const totalCount = await prisma.notification.count({
      where: {
        userId: currentUserId,
        NOT: {
          type: 'MESSAGE',
        },
      },
    });

    const notifications = await prisma.notification.findMany({
      where: {
        userId: currentUserId,
        NOT: {
          type: 'MESSAGE',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });

    return res.json({
      notifications,
      pagination: {
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page * limit < totalCount,
      },
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get notification preferences
router.get('/preferences', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;

  try {
    let preferences = await prisma.notificationPreference.findUnique({
      where: { userId: currentUserId },
    });

    if (!preferences) {
      preferences = await prisma.notificationPreference.create({
        data: {
          userId: currentUserId,
        },
      });
    }

    return res.json(preferences);
  } catch (error) {
    logger.error('Get preferences error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update notification preferences
router.put('/preferences', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;
  const { 
    messages, 
    calls, 
    friendRequests, 
    groupNotifications, 
    soundEffects,
    whoCanSendFriendRequests,
    whoCanCallMe,
    whoCanSeeProfilePhoto,
    whoCanSeeLastSeen
  } = req.body;

  try {
    const updated = await prisma.notificationPreference.upsert({
      where: { userId: currentUserId },
      update: {
        messages: messages !== undefined ? Boolean(messages) : undefined,
        calls: calls !== undefined ? Boolean(calls) : undefined,
        friendRequests: friendRequests !== undefined ? Boolean(friendRequests) : undefined,
        groupNotifications: groupNotifications !== undefined ? Boolean(groupNotifications) : undefined,
        soundEffects: soundEffects !== undefined ? Boolean(soundEffects) : undefined,
        whoCanSendFriendRequests: whoCanSendFriendRequests !== undefined ? String(whoCanSendFriendRequests) : undefined,
        whoCanCallMe: whoCanCallMe !== undefined ? String(whoCanCallMe) : undefined,
        whoCanSeeProfilePhoto: whoCanSeeProfilePhoto !== undefined ? String(whoCanSeeProfilePhoto) : undefined,
        whoCanSeeLastSeen: whoCanSeeLastSeen !== undefined ? String(whoCanSeeLastSeen) : undefined,
      },
      create: {
        userId: currentUserId,
        messages: messages !== undefined ? Boolean(messages) : true,
        calls: calls !== undefined ? Boolean(calls) : true,
        friendRequests: friendRequests !== undefined ? Boolean(friendRequests) : true,
        groupNotifications: groupNotifications !== undefined ? Boolean(groupNotifications) : true,
        soundEffects: soundEffects !== undefined ? Boolean(soundEffects) : true,
        whoCanSendFriendRequests: whoCanSendFriendRequests !== undefined ? String(whoCanSendFriendRequests) : 'EVERYONE',
        whoCanCallMe: whoCanCallMe !== undefined ? String(whoCanCallMe) : 'EVERYONE',
        whoCanSeeProfilePhoto: whoCanSeeProfilePhoto !== undefined ? String(whoCanSeeProfilePhoto) : 'EVERYONE',
        whoCanSeeLastSeen: whoCanSeeLastSeen !== undefined ? String(whoCanSeeLastSeen) : 'EVERYONE',
      },
    });

    return res.json(updated);
  } catch (error) {
    logger.error('Update preferences error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all notifications as read (MUST be before /:id/read)
router.put('/read-all', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;

  try {
    await prisma.notification.updateMany({
      where: {
        userId: currentUserId,
        isRead: false,
        NOT: {
          type: 'MESSAGE',
        },
      },
      data: {
        isRead: true,
      },
    });

    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    logger.error('Mark all notifications read error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark single notification as read
router.put('/:id/read', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;
  const notificationId = req.params.id;

  try {
    const updated = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: currentUserId,
      },
      data: {
        isRead: true,
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    logger.error('Mark notification read error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
