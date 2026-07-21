import { Router } from 'express';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { checkFriendRequestLimit, checkProfileLookupLimit } from '../utils/rateLimit';

const router = Router();

// Get public profile lookup by publicId (Rate Limited, secure profile query)
router.get('/public-profile/:publicId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const requesterId = req.userId!;
  const { publicId } = req.params;

  const rateLimitKey = `${requesterId}-${req.ip}`;
  if (!checkProfileLookupLimit(rateLimitKey)) {
    return res.status(429).json({ error: 'Too many profile lookups. Please try again later.' });
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { publicId },
      include: { profile: true }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const targetUserId = targetUser.id;

    // Check block rule
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: requesterId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: requesterId }
        ]
      }
    });

    let relationship: 'FRIENDS' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'NONE' | 'BLOCKED' = 'NONE';
    let requestId: string | undefined = undefined;
    let blockState: 'YOU_BLOCKED' | 'BLOCKED_BY_THEM' | null = null;

    if (block) {
      relationship = 'BLOCKED';
      blockState = block.blockerId === requesterId ? 'YOU_BLOCKED' : 'BLOCKED_BY_THEM';
    } else {
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userId: requesterId, friendId: targetUserId },
            { userId: targetUserId, friendId: requesterId }
          ]
        }
      });

      if (friendship) {
        relationship = 'FRIENDS';
      } else {
        const request = await prisma.friendRequest.findFirst({
          where: {
            OR: [
              { senderId: requesterId, receiverId: targetUserId },
              { senderId: targetUserId, receiverId: requesterId }
            ],
            status: 'PENDING'
          }
        });

        if (request) {
          relationship = request.senderId === requesterId ? 'PENDING_SENT' : 'PENDING_RECEIVED';
          requestId = request.id;
        }
      }
    }

    const isBlocked = relationship === 'BLOCKED';

    return res.json({
      publicId: targetUser.publicId,
      username: targetUser.username,
      displayName: isBlocked ? targetUser.username : (targetUser.profile?.displayName || targetUser.username),
      avatarUrl: isBlocked ? null : targetUser.profile?.avatarUrl,
      bio: isBlocked ? null : targetUser.profile?.bio,
      relationship,
      requestId,
      blockState
    });

  } catch (error) {
    logger.error('Public profile lookup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Send friend request
router.post('/request', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const senderId = req.userId!;
  const { receiverId, receiverUsername, receiverPublicId } = req.body;

  const limitCheck = checkFriendRequestLimit(senderId);
  if (!limitCheck.allowed) {
    return res.status(429).json({ error: limitCheck.reason });
  }

  try {
    let targetUserId = receiverId;

    if (!targetUserId && receiverPublicId) {
      const user = await prisma.user.findUnique({
        where: { publicId: receiverPublicId }
      });
      if (user) targetUserId = user.id;
    }

    if (!targetUserId && receiverUsername) {
      const user = await prisma.user.findUnique({
        where: { username: receiverUsername }
      });
      if (user) targetUserId = user.id;
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'Receiver not found' });
    }

    if (senderId === targetUserId) {
      return res.status(400).json({ error: 'Cannot send a friend request to yourself' });
    }

    // Check if block exists either way
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: senderId }
        ]
      }
    });

    if (block) {
      return res.status(400).json({ error: 'Blocked user. Action not permitted.' });
    }

    // Verify privacy settings for incoming friend requests
    const receiverPref = await prisma.notificationPreference.findUnique({
      where: { userId: targetUserId }
    });
    if (receiverPref) {
      if (receiverPref.whoCanSendFriendRequests === 'NOONE') {
        return res.status(403).json({ error: 'This user has disabled incoming friend requests.' });
      }
      if (receiverPref.whoCanSendFriendRequests === 'FRIENDS') {
        // Find mutual friends
        const senderFriends = await prisma.friendship.findMany({ where: { userId: senderId }, select: { friendId: true } });
        const receiverFriends = await prisma.friendship.findMany({ where: { userId: targetUserId }, select: { friendId: true } });
        const senderFriendIds = senderFriends.map(f => f.friendId);
        const receiverFriendIds = receiverFriends.map(f => f.friendId);
        const mutualFriends = senderFriendIds.filter(id => receiverFriendIds.includes(id));
        if (mutualFriends.length === 0) {
          return res.status(403).json({ error: 'This user only accepts friend requests from mutual friends.' });
        }
      }
    }

    // Check if already friends
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        userId: senderId,
        friendId: targetUserId
      }
    });

    if (existingFriendship) {
      return res.status(400).json({ error: 'You are already friends with this user' });
    }

    // Check if there's already a pending request
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: senderId }
        ]
      }
    });

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        return res.status(400).json({ error: 'Friend request is already pending' });
      }
      // If rejected, we can allow sending it again
      await prisma.friendRequest.delete({
        where: { id: existingRequest.id }
      });
    }

    // Create the request
    const newRequest = await prisma.friendRequest.create({
      data: {
        senderId,
        receiverId: targetUserId,
        status: 'PENDING'
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            profile: true
          }
        }
      }
    });

    // Notify receiver via sockets
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${targetUserId}`).emit('friend_request_received', { request: newRequest });
    }

    // Send push notification
    const { NotificationService } = require('../utils/notification');
    NotificationService.sendPush(
      targetUserId,
      'New Friend Request',
      `${newRequest.sender.profile?.displayName || newRequest.sender.username} sent you a friend request.`,
      { type: 'friend_request', requestId: newRequest.id }
    ).catch((e: any) => logger.error('Friend request push failed:', e.message));

    return res.status(201).json(newRequest);
  } catch (error) {
    logger.error('Send friend request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept friend request
router.post('/request/:id/accept', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const requestId = req.params.id;

  try {
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId }
    });

    if (!request || request.receiverId !== userId || request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Friend request not found or not pending' });
    }

    // Update request
    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED' }
    });

    // Add reciprocal friendships
    await prisma.$transaction([
      prisma.friendship.create({
        data: { userId: request.senderId, friendId: request.receiverId }
      }),
      prisma.friendship.create({
        data: { userId: request.receiverId, friendId: request.senderId }
      })
    ]);

    const acceptor = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, profile: true }
    });

    // Notify sender via sockets
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${request.senderId}`).emit('friend_request_accepted', {
        requestId,
        friend: acceptor
      });
      // Force both users to join sockets updates
      io.to(`user:${request.senderId}`).emit('friend_list_changed');
      io.to(`user:${request.receiverId}`).emit('friend_list_changed');
    }

    // Send push notification
    const { NotificationService } = require('../utils/notification');
    NotificationService.sendPush(
      request.senderId,
      'Friend Request Accepted',
      `${acceptor?.profile?.displayName || acceptor?.username} accepted your friend request.`,
      { type: 'friend_accept', friendId: userId }
    ).catch((e: any) => logger.error('Friend accept push failed:', e.message));

    return res.json({ success: true, message: 'Friend request accepted' });
  } catch (error) {
    logger.error('Accept friend request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject friend request
router.post('/request/:id/reject', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const requestId = req.params.id;

  try {
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId }
    });

    if (!request || request.receiverId !== userId || request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Friend request not found' });
    }

    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' }
    });

    // Notify sender
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${request.senderId}`).emit('friend_request_rejected', { requestId });
    }

    return res.json({ success: true, message: 'Friend request rejected' });
  } catch (error) {
    logger.error('Reject friend request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel outgoing friend request
router.delete('/request/:id/cancel', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const requestId = req.params.id;

  try {
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId }
    });

    if (!request || request.senderId !== userId || request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Friend request not found' });
    }

    await prisma.friendRequest.delete({
      where: { id: requestId }
    });

    // Notify receiver
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${request.receiverId}`).emit('friend_request_cancelled', { requestId });
    }

    return res.json({ success: true, message: 'Friend request cancelled' });
  } catch (error) {
    logger.error('Cancel friend request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove friend
router.delete('/:friendId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const friendId = req.params.friendId;

  try {
    // Delete reciprocal friendships
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId }
        ]
      }
    });

    // Also clean up any associated friend requests
    await prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId }
        ]
      }
    });

    // Notify sockets
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('friend_removed', { friendId });
      io.to(`user:${friendId}`).emit('friend_removed', { friendId: userId });
      io.to(`user:${userId}`).emit('friend_list_changed');
      io.to(`user:${friendId}`).emit('friend_list_changed');
    }

    return res.json({ success: true, message: 'Friend removed successfully' });
  } catch (error) {
    logger.error('Remove friend error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Block user
router.post('/block', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const blockerId = req.userId!;
  const { blockedId, blockedPublicId } = req.body;

  let targetBlockedId = blockedId;
  if (!targetBlockedId && blockedPublicId) {
    const user = await prisma.user.findUnique({
      where: { publicId: blockedPublicId }
    });
    if (user) targetBlockedId = user.id;
  }

  if (!targetBlockedId) {
    return res.status(400).json({ error: 'blockedId or blockedPublicId is required' });
  }

  if (blockerId === targetBlockedId) {
    return res.status(400).json({ error: 'Cannot block yourself' });
  }

  try {
    // Remove active friendship if exists
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: blockerId, friendId: targetBlockedId },
          { userId: targetBlockedId, friendId: blockerId }
        ]
      }
    });

    // Clean up active requests
    await prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: blockerId, receiverId: targetBlockedId },
          { senderId: targetBlockedId, receiverId: blockerId }
        ]
      }
    });

    // Upsert block
    await prisma.block.upsert({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId: targetBlockedId
        }
      },
      update: {},
      create: {
        blockerId,
        blockedId: targetBlockedId
      }
    });

    // Emit event
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${blockerId}`).emit('user_blocked', { blockedId: targetBlockedId });
      io.to(`user:${targetBlockedId}`).emit('blocked_by_user', { blockerId });
      io.to(`user:${blockerId}`).emit('friend_list_changed');
      io.to(`user:${targetBlockedId}`).emit('friend_list_changed');
    }

    return res.json({ success: true, message: 'User blocked successfully' });
  } catch (error) {
    logger.error('Block user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Unblock user
router.delete('/block/:blockedId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const blockerId = req.userId!;
  const blockedIdOrPublicId = req.params.blockedId;

  try {
    let targetBlockedId = blockedIdOrPublicId;
    if (blockedIdOrPublicId.startsWith('VC-')) {
      const user = await prisma.user.findUnique({
        where: { publicId: blockedIdOrPublicId }
      });
      if (user) targetBlockedId = user.id;
    }

    await prisma.block.delete({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId: targetBlockedId
        }
      }
    });

    // Emit event
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${blockerId}`).emit('user_unblocked', { blockedId: targetBlockedId });
      io.to(`user:${targetBlockedId}`).emit('unblocked_by_user', { blockerId });
    }

    return res.json({ success: true, message: 'User unblocked successfully' });
  } catch (error) {
    logger.error('Unblock user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List friends
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;

  try {
    const friendships = await prisma.friendship.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true
          }
        }
      }
    });

    // Extract friend profiles
    const friendIds = friendships.map(f => f.friendId);
    const friends = await prisma.user.findMany({
      where: {
        id: { in: friendIds }
      },
      select: {
        id: true,
        username: true,
        publicId: true,
        email: true,
        profile: true
      }
    });

    const { sanitizeProfilesList } = require('../utils/privacy');
    const sanitizedFriends = await sanitizeProfilesList(userId, friends);
    return res.json(sanitizedFriends);
  } catch (error) {
    logger.error('List friends error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List requests (pending incoming and outgoing)
router.get('/requests', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;

  try {
    const incoming = await prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING'
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            publicId: true,
            profile: true
          }
        }
      }
    });

    const outgoing = await prisma.friendRequest.findMany({
      where: {
        senderId: userId,
        status: 'PENDING'
      },
      include: {
        receiver: {
          select: {
            id: true,
            username: true,
            publicId: true,
            profile: true
          }
        }
      }
    });

    return res.json({ incoming, outgoing });
  } catch (error) {
    logger.error('List friend requests error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List blocked users
router.get('/blocked', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const blockerId = req.userId!;

  try {
    const blocks = await prisma.block.findMany({
      where: { blockerId },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            publicId: true,
            profile: true
          }
        }
      }
    });

    const blockedUsers = blocks.map(b => b.blocked);
    return res.json(blockedUsers);
  } catch (error) {
    logger.error('List blocked users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
