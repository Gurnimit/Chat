import prisma from './db';
import { logger } from './logger';

export interface NotificationProvider {
  send(payload: { token: string; title: string; body: string; data?: any }): Promise<boolean>;
}

export class MockProvider implements NotificationProvider {
  async send(payload: { token: string; title: string; body: string; data?: any }): Promise<boolean> {
    logger.info(`[Notification MockProvider] Dispatching push notification:
      Token: ${payload.token}
      Title: ${payload.title}
      Body: ${payload.body}
      Data: ${JSON.stringify(payload.data || {})}`);
    return true; // Always succeeds in mock fallback
  }
}

export class FCMProvider implements NotificationProvider {
  private hasCreds: boolean = false;
  // Dynamic import or local stub for firebase-admin to prevent load crashes when firebase is not configured
  private adminSdk: any = null;

  constructor() {
    // Check if credentials exist
    try {
      let serviceAccount: any = null;
      const fcmKey = process.env.FCM_SERVICE_ACCOUNT_KEY;
      const fcmPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

      if (fcmKey) {
        serviceAccount = JSON.parse(fcmKey);
      } else if (fcmPath) {
        const fs = require('fs');
        const path = require('path');
        const resolvedPath = path.resolve(fcmPath);
        if (fs.existsSync(resolvedPath)) {
          const fileContent = fs.readFileSync(resolvedPath, 'utf8');
          serviceAccount = JSON.parse(fileContent);
        } else {
          logger.warn(`[Notification FCMProvider] Service account file not found at path: ${resolvedPath}`);
        }
      }

      if (serviceAccount) {
        const admin = require('firebase-admin');
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
        }
        this.adminSdk = admin;
        this.hasCreds = true;
        logger.info('[Notification FCMProvider] Firebase Admin initialized successfully.');
      } else {
        logger.warn('[Notification FCMProvider] Neither FCM_SERVICE_ACCOUNT_KEY nor FIREBASE_SERVICE_ACCOUNT_PATH loaded successfully. Defers to MockProvider.');
      }
    } catch (err: any) {
      logger.error('[Notification FCMProvider] Initialization failed:', err.message);
    }
  }

  async send(payload: { token: string; title: string; body: string; data?: any }): Promise<boolean> {
    if (!this.hasCreds || !this.adminSdk) {
      logger.warn('[Notification FCMProvider] FCM credentials missing. Failing delivery via FCM provider.');
      return false;
    }

    try {
      const channelId = payload.data?.type === 'call' ? 'calls' : 'messages';
      const message = {
        token: payload.token,
        notification: {
          title: payload.title,
          body: payload.body
        },
        android: {
          notification: {
            channelId: channelId
          }
        },
        data: payload.data ? Object.keys(payload.data).reduce((acc: any, key) => {
          acc[key] = String(payload.data[key]);
          return acc;
        }, {}) : undefined
      };

      await this.adminSdk.messaging().send(message);
      logger.info(`[Notification FCMProvider] Push sent successfully to token: ${payload.token}`);
      return true;
    } catch (err: any) {
      logger.error(`[Notification FCMProvider] Failed to send push to token ${payload.token}:`, err.message);
      // If the error code indicates token is invalid or unregistered, clean it up
      const errStr = (err.code || '') + ' ' + (err.message || '');
      if (
        err.code === 'messaging/invalid-registration-token' || 
        err.code === 'messaging/registration-token-not-registered' ||
        errStr.includes('invalid-registration-token') ||
        errStr.includes('registration-token-not-registered') ||
        errStr.includes('invalid-argument')
      ) {
        logger.info(`[Notification FCMProvider] Token invalid/unregistered. Cleaning up token: ${payload.token}`);
        prisma.deviceToken.delete({
          where: { token: payload.token }
        }).catch(e => logger.error('Error cleaning up invalid token:', e.message));
      }
      return false;
    }
  }
}

export class NotificationService {
  private static provider: NotificationProvider | null = null;

  public static getProvider(): NotificationProvider {
    if (!this.provider) {
      const fcmEnabled = process.env.FCM_ENABLED === 'true';
      const hasCreds = !!(process.env.FCM_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      if (fcmEnabled && hasCreds) {
        this.provider = new FCMProvider();
      } else {
        this.provider = new MockProvider();
      }
    }
    return this.provider;
  }

  public static async sendPush(userId: string, title: string, body: string, data?: any): Promise<void> {
    try {
      // Check notification preferences
      const preferences = await prisma.notificationPreference.findUnique({
        where: { userId }
      });

      if (preferences) {
        const t = data?.type ? String(data.type).toLowerCase() : '';
        if (t === 'message' && !preferences.messages) {
          logger.info(`[NotificationService] Push skipped: messages disabled for user ${userId}`);
          return;
        }
        if (t === 'mention' && !preferences.messages) {
          logger.info(`[NotificationService] Push skipped: message mentions disabled for user ${userId}`);
          return;
        }
        if ((t === 'call' || t === 'missed_call') && !preferences.calls) {
          logger.info(`[NotificationService] Push skipped: calls disabled for user ${userId}`);
          return;
        }
        if ((t === 'friend_request' || t === 'friend_accept') && !preferences.friendRequests) {
          logger.info(`[NotificationService] Push skipped: friend requests disabled for user ${userId}`);
          return;
        }
        if (t === 'group_invite' && !preferences.groupNotifications) {
          logger.info(`[NotificationService] Push skipped: group notifications disabled for user ${userId}`);
          return;
        }
      }
    } catch (prefErr: any) {
      logger.error('[NotificationService] Preference check error:', prefErr.message);
    }

    let dbType: string | null = null;
    if (data && data.type) {
      const t = String(data.type).toLowerCase();
      if (t === 'friend_request') dbType = 'FRIEND_REQUEST';
      else if (t === 'friend_accept') dbType = 'FRIEND_ACCEPTED';
      else if (t === 'group_invite') dbType = 'GROUP_INVITE';
      else if (t === 'missed_call') dbType = 'MISSED_CALL';
      else if (t === 'mention') dbType = 'MENTION';
      else if (t === 'system') dbType = 'SYSTEM';
      else if (t === 'message') dbType = 'MESSAGE';
      else dbType = data.type.toUpperCase();
    }

    const metadataStr = data ? JSON.stringify(data) : null;

    // 1. Create a Notification record with status "queued"
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type: dbType,
        metadata: metadataStr,
        status: 'queued',
        isRead: false
      }
    });

    // Send real-time socket notification if receiver is connected
    try {
      const { sendSocketNotification } = require('../sockets/chat.socket');
      sendSocketNotification(userId, notification);
    } catch (socketErr: any) {
      logger.error('[NotificationService] Socket emit failed:', socketErr.message);
    }

    try {
      // 2. Fetch active device tokens for the user
      const tokens = await prisma.deviceToken.findMany({
        where: { userId }
      });

      if (tokens.length === 0) {
        logger.info(`[NotificationService] No active device tokens registered for user: ${userId}.`);
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: 'failed',
            failureReason: 'No registered device tokens'
          }
        });
        return;
      }

      let successCount = 0;
      let failCount = 0;
      let lastFailureReason = '';

      const provider = this.getProvider();

      for (const t of tokens) {
        const isSent = await provider.send({
          token: t.token,
          title,
          body,
          data
        });

        // Update token's lastSeenAt
        prisma.deviceToken.update({
          where: { id: t.id },
          data: { lastSeenAt: new Date() }
        }).catch(err => logger.error('Failed to update token lastSeenAt:', err.message));

        if (isSent) {
          successCount++;
        } else {
          failCount++;
          lastFailureReason = 'FCM provider transmission failure';
        }
      }

      // 3. Update database notification record with final delivery stats
      if (successCount > 0) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: 'sent',
            sentAt: new Date()
          }
        });
      } else {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: 'failed',
            failureReason: lastFailureReason || 'All delivery attempts failed'
          }
        });
      }

    } catch (err: any) {
      logger.error('[NotificationService] Processing failed:', err.message);
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'failed',
          failureReason: err.message
        }
      });
    }
  }

  // Token registration helper
  public static async registerToken(userId: string, token: string, deviceId: string, platform: string): Promise<void> {
    try {
      // Clean up other associations for this token if it exists (token uniqueness in DB)
      await prisma.deviceToken.deleteMany({
        where: {
          token,
          NOT: {
            userId,
            deviceId
          }
        }
      });

      // Upsert user device mapping
      await prisma.deviceToken.upsert({
        where: {
          userId_deviceId: {
            userId,
            deviceId
          }
        },
        update: {
          token,
          platform,
          lastSeenAt: new Date()
        },
        create: {
          userId,
          deviceId,
          token,
          platform
        }
      });

      logger.info(`[NotificationService] Token registered successfully: User ${userId}, Device ${deviceId}, Platform ${platform}`);
    } catch (err: any) {
      logger.error('[NotificationService] Register token failed:', err.message);
      throw err;
    }
  }

  // Cleanup strategy for stale tokens (tokens inactive > 30 days)
  public static async cleanStaleTokens(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const deleteResult = await prisma.deviceToken.deleteMany({
        where: {
          lastSeenAt: { lt: thirtyDaysAgo }
        }
      });
      logger.info(`[NotificationService] Cleaned up ${deleteResult.count} stale device tokens.`);
      return deleteResult.count;
    } catch (err: any) {
      logger.error('[NotificationService] Clean stale tokens failed:', err.message);
      return 0;
    }
  }
}
