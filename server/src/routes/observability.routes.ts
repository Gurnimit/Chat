import { Router } from 'express';
import prisma from '../utils/db';
import os from 'os';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

// Health Check Endpoint
router.get('/health', async (req, res) => {
  const healthInfo: any = {
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    system: {
      platform: process.platform,
      arch: process.arch,
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      loadAverage: os.loadavg()
    },
    database: {
      status: 'UNKNOWN'
    }
  };

  try {
    // Check database connection by running a simple query
    await prisma.$queryRaw`SELECT 1`;
    healthInfo.database.status = 'UP';
  } catch (err: any) {
    healthInfo.status = 'DOWN';
    healthInfo.database.status = 'DOWN';
    healthInfo.database.error = err.message;
    logger.error('[Observability Health] Database check failed:', err.message);
  }

  const statusCode = healthInfo.status === 'UP' ? 200 : 503;
  return res.status(statusCode).json(healthInfo);
});

// Privacy-Safe Observability Metrics Endpoint (requires authentication to prevent exposure)
router.get('/metrics', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    // Query basic aggregate counts to monitor database health and application growth
    const totalUsers = await prisma.user.count();
    const totalMessages = await prisma.message.count();
    const totalChats = await prisma.chat.count();
    const directChats = await prisma.chat.count({ where: { type: 'DIRECT' } });
    const groupChats = await prisma.chat.count({ where: { type: 'GROUP' } });

    // Notification delivery aggregates
    const notificationStats = await prisma.notification.groupBy({
      by: ['status'],
      _count: {
        _all: true
      }
    });

    // Format notification delivery stats
    const notifications: Record<string, number> = {
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0
    };
    notificationStats.forEach(stat => {
      notifications[stat.status] = stat._count._all;
    });

    const memoryUsage = process.memoryUsage();

    return res.json({
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external
        }
      },
      db_aggregates: {
        users: totalUsers,
        messages: totalMessages,
        chats: {
          total: totalChats,
          direct: directChats,
          group: groupChats
        },
        notifications
      }
    });
  } catch (err: any) {
    logger.error('[Observability Metrics] Error generating metrics:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
