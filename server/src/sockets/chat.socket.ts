import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/token';
import prisma from '../utils/db';

// Map of userId -> Set of socketIds (handles multiple tabs/devices)
const userSockets = new Map<string, Set<string>>();

// Global socket.io server instance for push updates
let ioInstance: Server | null = null;

// Map of userId -> { callLogId: string; conversationStartedAt?: Date }
const activeCalls = new Map<string, { callLogId: string; conversationStartedAt?: Date }>();

export const sendSocketNotification = (userId: string, notification: any) => {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit('notification_received', notification);
  }
};

// In-memory sliding-window event rate limiter for WebSockets
const socketRateLimits = new Map<string, { [event: string]: number[] }>();

// Queue of pending presence updates: userId -> { isOnline: boolean, lastSeen: Date }
const pendingPresenceUpdates = new Map<string, { isOnline: boolean; lastSeen: Date }>();

const checkRateLimit = (socketId: string, event: string, limit: number, windowMs: number): boolean => {
  const now = Date.now();
  if (!socketRateLimits.has(socketId)) {
    socketRateLimits.set(socketId, {});
  }
  const limits = socketRateLimits.get(socketId)!;
  if (!limits[event]) {
    limits[event] = [];
  }
  
  // Filter out timestamps outside the sliding window
  limits[event] = limits[event].filter(ts => now - ts < windowMs);
  
  if (limits[event].length >= limit) {
    return false;
  }
  
  limits[event].push(now);
  return true;
};


export const setupChatSockets = (io: Server) => {
  ioInstance = io;
  // Start the presence batching interval (every 20 seconds)
  setInterval(() => {
    if (pendingPresenceUpdates.size > 0) {
      const updates = Array.from(pendingPresenceUpdates.entries()).map(([userId, val]) => ({
        userId,
        isOnline: val.isOnline,
        lastSeen: val.lastSeen,
      }));
      pendingPresenceUpdates.clear();
      io.emit('presence_batch', { updates });
      console.log(`[Socket] Broadcasted presence batch for ${updates.length} users.`);
    }
  }, 20000);

  // Middleware to authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const payload = verifyAccessToken(token);
      (socket as any).userId = payload.userId;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = (socket as any).userId;
    console.log(`User connected: ${userId} (Socket: ${socket.id})`);

    // Add socket to user's list
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    // Join personal room to receive messages/events directed to this user
    socket.join(`user:${userId}`);

    // Update online status in database asynchronously (do not await to avoid blocking event listener registration)
    prisma.profile.update({
      where: { userId },
      data: { isOnline: true, lastSeen: new Date() },
    }).then((profile) => {
      // Add to batch queue instead of broadcasting immediately
      pendingPresenceUpdates.set(userId, { isOnline: true, lastSeen: profile.lastSeen });
    }).catch((e) => {
      console.error('Error updating status on connect:', e);
    });

    // Event: typing indicator
    socket.on('typing', async (data: { chatId: string; isTyping: boolean }) => {
      // Find chat members to broadcast typing indicator to
      try {
        const members = await prisma.chatMember.findMany({
          where: { chatId: data.chatId },
          select: { userId: true },
        });

        members.forEach((member) => {
          if (member.userId !== userId) {
            io.to(`user:${member.userId}`).emit('user_typing', {
              chatId: data.chatId,
              userId,
              isTyping: data.isTyping,
            });
          }
        });
      } catch (e) {
        console.error('Error in typing event:', e);
      }
    });

    // Event: send message
    socket.on('send_message', async (data: {
      chatId: string;
      content: string;
      clientMessageId?: string;
      replyToId?: string;
      attachments?: Array<{
        fileUrl: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
      }>;
    }) => {
      console.log(`[Socket] Received send_message from user ${userId} for chat ${data.chatId}, clientMessageId: ${data.clientMessageId}`);
      // Message spam protection: Limit to 10 messages per 5 seconds
      if (!checkRateLimit(socket.id, 'send_message', 10, 5000)) {
        console.log(`[Socket] send_message rejected due to rate limit for user ${userId}`);
        socket.emit('message_error', { error: 'Spam protection: Message rate limit exceeded. Please wait a moment.' });
        return;
      }
      try {
        // Enforce block rules for direct chats
        const chat = await prisma.chat.findUnique({
          where: { id: data.chatId },
          include: {
            members: {
              select: { userId: true }
            }
          }
        });

        if (chat && chat.type === 'DIRECT') {
          const otherMember = chat.members.find(m => m.userId !== userId);
          if (otherMember) {
            const block = await prisma.block.findFirst({
              where: {
                OR: [
                  { blockerId: userId, blockedId: otherMember.userId },
                  { blockerId: otherMember.userId, blockedId: userId }
                ]
              }
            });
            if (block) {
              console.log(`[Socket] send_message blocked due to active block between ${userId} and ${otherMember.userId}`);
              socket.emit('message_error', { error: 'Blocked user. Action not permitted.' });
              return;
            }
          }
        }

        let message = null;

        // Deduplication check
        if (data.clientMessageId) {
          message = await prisma.message.findUnique({
            where: {
              clientMessageId_senderId: {
                clientMessageId: data.clientMessageId,
                senderId: userId,
              },
            },
            include: {
              attachments: true,
              reactions: true,
              reads: true,
              replyTo: {
                include: {
                  attachments: true,
                },
              },
            },
          });
        }

        if (!message) {
          console.log(`[Socket] Saving message to database for chat ${data.chatId}...`);
          // Save message to database
          message = await prisma.message.create({
            data: {
              chatId: data.chatId,
              senderId: userId,
              content: data.content,
              clientMessageId: data.clientMessageId || null,
              replyToId: data.replyToId || null,
              attachments: data.attachments ? {
                create: data.attachments.map(att => ({
                  fileUrl: att.fileUrl,
                  fileName: att.fileName,
                  fileSize: att.fileSize,
                  mimeType: att.mimeType,
                })),
              } : undefined,
            },
            include: {
              attachments: true,
              reactions: true,
              reads: true,
              replyTo: {
                include: {
                  attachments: true,
                },
              },
            },
          });
        }

        // Fetch user profile for the sender
        const sender = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            profile: true,
          },
        });

        const fullMessage = {
          ...message,
          sender,
        };

        // Find members of the chat
        const members = await prisma.chatMember.findMany({
          where: { chatId: data.chatId },
          select: { userId: true },
        });

        // Broadcast to all chat members (including sender for multi-device synchronization)
        members.forEach((member) => {
          io.to(`user:${member.userId}`).emit('message_received', {
            chatId: data.chatId,
            message: fullMessage,
          });
        });

        // Create push and db notifications for other members if they are offline / not active
        const { NotificationService } = require('../utils/notification');
        members.forEach((member) => {
          if (member.userId !== userId) {
            NotificationService.sendPush(
              member.userId,
              sender?.profile?.displayName || sender?.username || 'New Message',
              data.content || 'Sent an attachment',
              { chatId: data.chatId, type: 'message' }
            ).catch((e: any) => console.error('Push notification failed:', e));
          }
        });
      } catch (e) {
        console.error('Error saving/sending message:', e);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    // Event: message read receipt
    socket.on('mark_read', async (data: { chatId: string; messageId?: string }) => {
      try {
        const query: any = {
          chatId: data.chatId,
          senderId: { not: userId },
          reads: {
            none: { userId },
          },
        };

        // If specific messageId is given, read up to that message
        if (data.messageId) {
          const targetMsg = await prisma.message.findUnique({
            where: { id: data.messageId },
            select: { createdAt: true },
          });

          if (targetMsg) {
            query.createdAt = { lte: targetMsg.createdAt };
          }
        }

        // Find unread messages
        const unreadMessages = await prisma.message.findMany({
          where: query,
          select: { id: true },
        });

        if (unreadMessages.length === 0) return;

        const readAt = new Date();

        // Update ChatMember lastReadMessageId for this user if messageId is provided
        if (data.messageId) {
          await prisma.chatMember.update({
            where: {
              chatId_userId: {
                chatId: data.chatId,
                userId,
              },
            },
            data: {
              lastReadMessageId: data.messageId,
            },
          }).catch(err => console.error('Failed to update lastReadMessageId:', err));
        }

        // Bulk insert reads
        await prisma.messageRead.createMany({
          data: unreadMessages.map((msg) => ({
            messageId: msg.id,
            userId,
            readAt,
          })),
        });

        // Upsert into MessageStatus
        for (const msg of unreadMessages) {
          await prisma.messageStatus.upsert({
            where: {
              messageId_userId: {
                messageId: msg.id,
                userId,
              },
            },
            update: {
              readAt,
            },
            create: {
              messageId: msg.id,
              userId,
              readAt,
            },
          });
        }

        // Fetch chat members
        const members = await prisma.chatMember.findMany({
          where: { chatId: data.chatId },
          select: { userId: true },
        });

        // Notify other members
        members.forEach((member) => {
          if (member.userId !== userId) {
            io.to(`user:${member.userId}`).emit('messages_read', {
              chatId: data.chatId,
              userId,
              messageIds: unreadMessages.map(m => m.id),
              readAt,
            });
          }
        });
      } catch (e) {
        console.error('Error marking messages as read:', e);
      }
    });

    // Event: message delivery receipt
    socket.on('mark_delivered', async (data: { chatId: string; messageIds: string[] }) => {
      try {
        if (!data.messageIds || !Array.isArray(data.messageIds) || data.messageIds.length === 0) return;
        const now = new Date();
        
        for (const messageId of data.messageIds) {
          await prisma.messageStatus.upsert({
            where: {
              messageId_userId: {
                messageId,
                userId,
              },
            },
            update: {
              deliveredAt: now,
            },
            create: {
              messageId,
              userId,
              deliveredAt: now,
            },
          });
        }

        // Fetch chat members
        const members = await prisma.chatMember.findMany({
          where: { chatId: data.chatId },
          select: { userId: true },
        });

        members.forEach((member) => {
          if (member.userId !== userId) {
            io.to(`user:${member.userId}`).emit('messages_delivered', {
              chatId: data.chatId,
              userId,
              messageIds: data.messageIds,
              deliveredAt: now,
            });
          }
        });
      } catch (e) {
        console.error('Error marking messages as delivered:', e);
      }
    });

    // Event: add/update message reaction (toggle emoji reaction)
    socket.on('react_message', async (data: { chatId: string; messageId: string; emoji: string }) => {
      try {
        const existingReaction = await prisma.messageReaction.findUnique({
          where: {
            messageId_userId_emoji: {
              messageId: data.messageId,
              userId,
              emoji: data.emoji,
            },
          },
        });

        let reaction = null;
        let action: 'added' | 'removed' = 'added';

        if (existingReaction) {
          await prisma.messageReaction.delete({
            where: {
              messageId_userId_emoji: {
                messageId: data.messageId,
                userId,
                emoji: data.emoji,
              },
            },
          });
          action = 'removed';
        } else {
          reaction = await prisma.messageReaction.create({
            data: {
              messageId: data.messageId,
              userId,
              emoji: data.emoji,
              createdAt: new Date(),
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  profile: true,
                },
              },
            },
          });
          action = 'added';
        }

        // Notify other chat members
        const members = await prisma.chatMember.findMany({
          where: { chatId: data.chatId },
          select: { userId: true },
        });

        members.forEach((member) => {
          io.to(`user:${member.userId}`).emit('message_reaction', {
            chatId: data.chatId,
            messageId: data.messageId,
            userId,
            emoji: data.emoji,
            action,
            reaction,
          });
        });
      } catch (e) {
        console.error('Error reacting to message:', e);
      }
    });

    // Event: edit message via socket
    socket.on('edit_message', async (data: { chatId: string; messageId: string; content: string }) => {
      try {
        const message = await prisma.message.findUnique({
          where: { id: data.messageId },
        });

        if (!message || message.senderId !== userId || message.isDeleted) return;

        const updatedMessage = await prisma.message.update({
          where: { id: data.messageId },
          data: {
            content: data.content,
            isEdited: true,
          },
          include: {
            attachments: true,
            reads: true,
            replyTo: true,
            reactions: true,
          },
        });

        const members = await prisma.chatMember.findMany({
          where: { chatId: data.chatId },
          select: { userId: true },
        });

        members.forEach((member) => {
          io.to(`user:${member.userId}`).emit('message_edited', {
            chatId: data.chatId,
            message: updatedMessage,
          });
        });
      } catch (e) {
        console.error('Error editing message:', e);
      }
    });

    // Event: delete message via socket (soft delete)
    socket.on('delete_message', async (data: { chatId: string; messageId: string }) => {
      try {
        const message = await prisma.message.findUnique({
          where: { id: data.messageId },
        });

        if (!message || message.senderId !== userId) return;

        const deletedMessage = await prisma.message.update({
          where: { id: data.messageId },
          data: {
            content: 'This message was deleted',
            isDeleted: true,
          },
          include: {
            attachments: true,
            reads: true,
            replyTo: true,
            reactions: true,
          },
        });

        const members = await prisma.chatMember.findMany({
          where: { chatId: data.chatId },
          select: { userId: true },
        });

        members.forEach((member) => {
          io.to(`user:${member.userId}`).emit('message_deleted', {
            chatId: data.chatId,
            message: deletedMessage,
          });
        });
      } catch (e) {
        console.error('Error deleting message:', e);
      }
    });

    // WebRTC Calling Signaling Events
    socket.on('call_user', async (data: { toUserId: string; offer: any; callType?: 'audio' | 'video' }) => {
      console.log(`[CALL_START] userId=${userId} → toUserId=${data.toUserId} callType=${data.callType || 'audio'} offerPresent=${!!data.offer}`);
      console.log(`[WEBRTC_OFFER] Offer received from userId=${userId} sdpType=${data.offer?.type} sdpLength=${data.offer?.sdp?.length}`);
      // Call signaling abuse protection: Limit to 3 call initiations per 30 seconds in prod (100 in dev)
      const callLimit = process.env.NODE_ENV === 'production' ? 3 : 100;
      if (!checkRateLimit(socket.id, 'call_user', callLimit, 30000)) {
        socket.emit('call_error', { error: 'Abuse protection: Call rate limit exceeded. Please wait a moment.' });
        return;
      }
      try {
        const block = await prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: userId, blockedId: data.toUserId },
              { blockerId: data.toUserId, blockedId: userId }
            ]
          }
        });
        if (block) {
          console.log(`[Socket] call_user blocked due to active block between ${userId} and ${data.toUserId}`);
          socket.emit('call_error', { error: 'Blocked user. Action not permitted.' });
          return;
        }

        // Enforce Who Can Call Me privacy settings
        const receiverPref = await prisma.notificationPreference.findUnique({
          where: { userId: data.toUserId }
        });
        if (receiverPref) {
          if (receiverPref.whoCanCallMe === 'NOONE') {
            socket.emit('call_error', { error: 'This user has disabled incoming calls.' });
            return;
          }
          if (receiverPref.whoCanCallMe === 'FRIENDS') {
            const isFriend = await prisma.friendship.findFirst({
              where: {
                userId: userId,
                friendId: data.toUserId
              }
            });
            if (!isFriend) {
              socket.emit('call_error', { error: 'This user only accepts calls from friends.' });
              return;
            }
          }
        }

        const caller = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            profile: true,
          },
        });

        // Write CallLog start
        const callLog = await prisma.callLog.create({
          data: {
            callerId: userId,
            receiverId: data.toUserId,
            callType: (data.callType || 'audio').toUpperCase(),
            status: 'MISSED', // Default to MISSED until answered/rejected
            startedAt: new Date(),
          }
        });
        const callInfo = { callLogId: callLog.id };
        activeCalls.set(userId, callInfo);
        activeCalls.set(data.toUserId, callInfo);

        console.log(`[CALL_FORWARD] Forwarding incoming_call to userId=${data.toUserId} callLogId=${callLog.id}`);
        io.to(`user:${data.toUserId}`).emit('incoming_call', {
          caller,
          offer: data.offer,
          callType: data.callType || 'audio',
          callLogId: callLog.id
        });

        // Trigger push and database notification for incoming calls
        const { NotificationService } = require('../utils/notification');
        NotificationService.sendPush(
          data.toUserId,
          'Incoming Call',
          `${caller?.profile?.displayName || caller?.username || 'Someone'} is calling you...`,
          { type: 'call', callType: data.callType || 'audio', callerId: userId }
        ).catch((e: any) => console.error('Call push notification failed:', e));
      } catch (e) {
        console.error('Error in call_user socket:', e);
      }
    });

    socket.on('switch_to_audio', (data: { toUserId: string }) => {
      io.to(`user:${data.toUserId}`).emit('switched_to_audio', {
        fromUserId: userId,
      });
    });

    socket.on('switch_to_video', (data: { toUserId: string }) => {
      io.to(`user:${data.toUserId}`).emit('switched_to_video', {
        fromUserId: userId,
      });
    });

    socket.on('accept_call', async (data: { toUserId: string; answer: any }) => {
      console.log(`[CALL_ACCEPTED] userId=${userId} accepted call from userId=${data.toUserId}`);
      console.log(`[WEBRTC_ANSWER] Answer received from userId=${userId} sdpType=${data.answer?.type} sdpLength=${data.answer?.sdp?.length}`);
      // Mark conversation starting timestamp
      const callInfo = activeCalls.get(userId) || activeCalls.get(data.toUserId);
      if (callInfo) {
        callInfo.conversationStartedAt = new Date();
      }

      console.log(`[CALL_FORWARD] Forwarding call_accepted to userId=${data.toUserId}`);
      io.to(`user:${data.toUserId}`).emit('call_accepted', {
        fromUserId: userId,
        answer: data.answer,
      });
    });

    socket.on('reject_call', async (data: { toUserId: string }) => {
      console.log(`[CALL_DECLINED] userId=${userId} rejected call from/to userId=${data.toUserId}`);
      const callInfo = activeCalls.get(userId) || activeCalls.get(data.toUserId);
      if (callInfo) {
        try {
          await prisma.callLog.update({
            where: { id: callInfo.callLogId },
            data: {
              status: 'REJECTED',
              endedAt: new Date(),
              durationSeconds: 0
            }
          });
        } catch (err: any) {
          console.error('Failed to update call log on reject:', err.message);
        }
        activeCalls.delete(userId);
        activeCalls.delete(data.toUserId);
      }

      console.log(`[CALL_FORWARD] Forwarding call_rejected to userId=${data.toUserId}`);
      io.to(`user:${data.toUserId}`).emit('call_rejected', {
        fromUserId: userId,
      });
    });

    socket.on('ice_candidate', (data: { toUserId: string; candidate: any }) => {
      // ICE candidate flood protection: Limit to 100 exchanges per 10 seconds
      if (!checkRateLimit(socket.id, 'ice_candidate', 100, 10000)) {
        return;
      }
      console.log(`[ICE_CANDIDATE] Relaying from userId=${userId} → toUserId=${data.toUserId} type=${data.candidate?.type || 'unknown'} protocol=${data.candidate?.protocol || '?'}`);
      io.to(`user:${data.toUserId}`).emit('ice_candidate', {
        fromUserId: userId,
        candidate: data.candidate,
      });
    });

    // ICE restart relay — used when RTCPeerConnection.restartIce() is not available
    // Relays a new ICE restart offer WITHOUT creating a new CallLog or re-triggering incoming_call
    socket.on('ice_restart', (data: { toUserId: string; offer: any }) => {
      console.log(`[ICE_CANDIDATE] ICE restart offer from userId=${userId} → toUserId=${data.toUserId}`);
      io.to(`user:${data.toUserId}`).emit('call_restarted', {
        fromUserId: userId,
        offer: data.offer,
      });
    });

    socket.on('end_call', async (data: { toUserId: string; missed?: boolean }) => {
      const callInfo = activeCalls.get(userId) || activeCalls.get(data.toUserId);
      if (callInfo) {
        const now = new Date();
        let status = 'COMPLETED';
        let durationSeconds = 0;
        if (callInfo.conversationStartedAt) {
          durationSeconds = Math.round((now.getTime() - callInfo.conversationStartedAt.getTime()) / 1000);
          status = 'COMPLETED';
        } else {
          status = data.missed ? 'MISSED' : 'CANCELLED';
        }
        try {
          await prisma.callLog.update({
            where: { id: callInfo.callLogId },
            data: {
              status,
              endedAt: now,
              durationSeconds
            }
          });
        } catch (err: any) {
          console.error('Failed to update call log on end:', err.message);
        }
        activeCalls.delete(userId);
        activeCalls.delete(data.toUserId);
      }

      io.to(`user:${data.toUserId}`).emit('call_ended', {
        fromUserId: userId,
      });

      if (data.missed) {
        try {
          const caller = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              username: true,
              publicId: true,
              profile: true,
            },
          });
          const { NotificationService } = require('../utils/notification');
          NotificationService.sendPush(
            data.toUserId,
            'Missed Call',
            `You missed a call from ${caller?.profile?.displayName || caller?.username || 'Someone'}.`,
            { 
              type: 'missed_call', 
              callerId: userId,
              callerUsername: caller?.username || 'user',
              callerPublicId: caller?.publicId || '',
              callerDisplayName: caller?.profile?.displayName || '',
              callerAvatarUrl: caller?.profile?.avatarUrl || ''
            }
          ).catch((e: any) => console.error('Missed call push notification failed:', e.message));
        } catch (err: any) {
          console.error('Error sending missed call push:', err.message);
        }
      }
    });

    // Disconnect handling
    socket.on('disconnect', async () => {
      // Clean up socket rate-limiter caches on disconnect to prevent memory leaks
      socketRateLimits.delete(socket.id);
      console.log(`User disconnected: ${userId} (Socket: ${socket.id})`);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          // No more active sessions, user is truly offline
          userSockets.delete(userId);

          // If user went completely offline, end any active call they were in
          const callInfo = activeCalls.get(userId);
          if (callInfo) {
            const now = new Date();
            let status = 'FAILED';
            let durationSeconds = 0;
            if (callInfo.conversationStartedAt) {
              durationSeconds = Math.round((now.getTime() - callInfo.conversationStartedAt.getTime()) / 1000);
              status = 'COMPLETED';
            } else {
              status = 'CANCELLED';
            }
            try {
              const callLog = await prisma.callLog.update({
                where: { id: callInfo.callLogId },
                data: {
                  status,
                  endedAt: now,
                  durationSeconds
                }
              });
              const otherUserId = callLog.callerId === userId ? callLog.receiverId : callLog.callerId;
              io.to(`user:${otherUserId}`).emit('call_ended', { fromUserId: userId });
              activeCalls.delete(callLog.callerId);
              activeCalls.delete(callLog.receiverId);
            } catch (err: any) {
              console.error('Failed to cleanup call log on disconnect:', err.message);
            }
          }

          try {
            const lastSeen = new Date();
            await prisma.profile.update({
              where: { userId },
              data: { isOnline: false, lastSeen },
            });
            // Add to batch queue instead of broadcasting immediately
            pendingPresenceUpdates.set(userId, { isOnline: false, lastSeen });
          } catch (e) {
            console.error('Error updating status on disconnect:', e);
          }
        }
      }
    });
  });
};
