import { Router } from 'express';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

// Log call details (Create or Update Call Log)
router.post('/log', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;
  const { id, callerId, receiverId, callType, startedAt, endedAt, durationSeconds, status } = req.body;

  if (!receiverId || !callType || !status) {
    return res.status(400).json({ error: 'receiverId, callType, and status are required' });
  }

  try {
    const finalCallerId = callerId || currentUserId;

    if (id) {
      // Update existing call log
      const updatedLog = await prisma.callLog.update({
        where: { id },
        data: {
          endedAt: endedAt ? new Date(endedAt) : undefined,
          durationSeconds: durationSeconds !== undefined ? Number(durationSeconds) : undefined,
          status,
        },
      });
      return res.json(updatedLog);
    } else {
      // Create new call log
      const newLog = await prisma.callLog.create({
        data: {
          callerId: finalCallerId,
          receiverId,
          callType: callType.toUpperCase(),
          startedAt: startedAt ? new Date(startedAt) : new Date(),
          endedAt: endedAt ? new Date(endedAt) : null,
          durationSeconds: durationSeconds !== undefined ? Number(durationSeconds) : 0,
          status,
        },
      });
      return res.status(201).json(newLog);
    }
  } catch (error) {
    logger.error('Log call error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get call history
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;

  try {
    const history = await prisma.callLog.findMany({
      where: {
        OR: [
          { callerId: currentUserId },
          { receiverId: currentUserId },
        ],
      },
      include: {
        caller: {
          select: {
            id: true,
            username: true,
            publicId: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            publicId: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 50, // Limit to recent 50 logs for performance
    });

    return res.json(history);
  } catch (error) {
    logger.error('Get call history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
