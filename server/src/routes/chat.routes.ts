import { Router, Response } from 'express';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger, redactObject, redactString } from '../utils/logger';
import { NotificationService } from '../utils/notification';

const router = Router();

// Search users
router.get('/users/search', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;
  const query = req.query.q as string;

  if (!query) {
    return res.status(400).json({ error: 'Search query required' });
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { username: { contains: query } },
              { email: { contains: query } },
              { profile: { displayName: { contains: query } } },
            ],
          },
          { id: { not: currentUserId } },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        profile: true,
      },
      take: 20,
    });

    const { sanitizeProfilesList } = require('../utils/privacy');
    const sanitizedUsers = await sanitizeProfilesList(currentUserId, users);
    return res.json(sanitizedUsers);
  } catch (error) {
    logger.error('Search users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent chats list
router.get('/chats', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;

  try {
    // Get all chats where user is a member
    const memberships = await prisma.chatMember.findMany({
      where: { userId: currentUserId },
      include: {
        chat: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    email: true,
                    profile: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                attachments: true,
                reads: true,
              },
            },
          },
        },
      },
    });

    const chatsList = await Promise.all(
      memberships.map(async (m) => {
        const chat = m.chat;
        const otherMembers = chat.members
          .filter((member) => member.userId !== currentUserId)
          .map((member) => member.user);

        const lastMessage = chat.messages[0] || null;

        // Calculate unread message count using lastReadMessageId optimization
        const lastReadId = m.lastReadMessageId;
        let unreadCount = 0;

        if (lastReadId) {
          const lastReadMsg = await prisma.message.findUnique({
            where: { id: lastReadId },
            select: { createdAt: true }
          });
          if (lastReadMsg) {
            unreadCount = await prisma.message.count({
              where: {
                chatId: chat.id,
                senderId: { not: currentUserId },
                createdAt: { gt: lastReadMsg.createdAt }
              }
            });
          } else {
            unreadCount = await prisma.message.count({
              where: {
                chatId: chat.id,
                senderId: { not: currentUserId }
              }
            });
          }
        } else {
          unreadCount = await prisma.message.count({
            where: {
              chatId: chat.id,
              senderId: { not: currentUserId }
            }
          });
        }

        return {
          id: chat.id,
          type: chat.type,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          otherMember: otherMembers[0] || null, // For 1v1 chats
          otherMembers,
          lastMessage,
          unreadCount,
        };
      })
    );

    // Sort by last message date, fallback to chat creation date
    chatsList.sort((a, b) => {
      const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    const { sanitizeProfileForUser, sanitizeProfilesList } = require('../utils/privacy');
    const sanitizedChatsList = await Promise.all(
      chatsList.map(async (chat) => {
        if (chat.otherMember) {
          chat.otherMember = await sanitizeProfileForUser(currentUserId, chat.otherMember);
        }
        if (chat.otherMembers) {
          chat.otherMembers = await sanitizeProfilesList(currentUserId, chat.otherMembers);
        }
        return chat;
      })
    );

    return res.json(sanitizedChatsList);
  } catch (error) {
    logger.error('Get recent chats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch chat messages (paginated)
router.get('/chats/:chatId/messages', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;
  const chatId = req.params.chatId;
  const limit = parseInt(req.query.limit as string) || 50;
  const cursor = req.query.cursor as string; // Message ID for pagination cursor

  try {
    // Verify user belongs to the chat
    const membership = await prisma.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId: currentUserId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied: not a member of this chat' });
    }

    const messages = await prisma.message.findMany({
      where: { chatId },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        attachments: true,
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                profile: true,
              },
            },
          },
        },
        reads: true,
        replyTo: {
          include: {
            attachments: true,
          },
        },
      },
    });

    // Return chronological messages order for easier UI consumption
    return res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create/get a direct chat with a user
router.post('/chats/direct', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;
  const { otherUserId } = req.body;

  if (!otherUserId) {
    return res.status(400).json({ error: 'otherUserId is required' });
  }

  if (currentUserId === otherUserId) {
    return res.status(400).json({ error: 'Cannot create a direct chat with yourself' });
  }

  try {
    // Enforce mutual friendship
    const friendship = await prisma.friendship.findFirst({
      where: {
        userId: currentUserId,
        friendId: otherUserId
      }
    });

    if (!friendship) {
      return res.status(400).json({ error: 'You must be friends with this user to start a chat.' });
    }

    // Check if chat already exists
    const existingChats = await prisma.chat.findMany({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId: currentUserId } } },
          { members: { some: { userId: otherUserId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                profile: true,
              },
            },
          },
        },
      },
    });

    // Find if there is a chat containing exactly both members
    const directChat = existingChats.find(chat => chat.members.length === 2);

    if (directChat) {
      const otherMember = directChat.members.find(m => m.userId === otherUserId)!.user;
      return res.json({
        id: directChat.id,
        type: directChat.type,
        otherMember,
        unreadCount: 0,
      });
    }

    // Otherwise create a new direct chat
    const newChat = await prisma.chat.create({
      data: {
        type: 'DIRECT',
        members: {
          create: [
            { userId: currentUserId },
            { userId: otherUserId },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                profile: true,
              },
            },
          },
        },
      },
    });

    const otherMember = newChat.members.find(m => m.userId === otherUserId)!.user;

    return res.status(201).json({
      id: newChat.id,
      type: newChat.type,
      otherMember,
      unreadCount: 0,
    });
  } catch (error) {
    console.error('Create direct chat error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Edit message
router.put('/messages/:messageId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;
  const messageId = req.params.messageId;
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId !== currentUserId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    if (message.isDeleted) {
      return res.status(400).json({ error: 'Cannot edit a deleted message' });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        isEdited: true,
      },
      include: {
        attachments: true,
        reads: true,
        replyTo: true,
        reactions: true,
      },
    });

    return res.json(updatedMessage);
  } catch (error) {
    console.error('Edit message error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete message (Soft Delete)
router.delete('/messages/:messageId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;
  const messageId = req.params.messageId;

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId !== currentUserId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const deletedMessage = await prisma.message.update({
      where: { id: messageId },
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

    return res.json(deletedMessage);
  } catch (error) {
    console.error('Delete message error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get WebRTC ICE Server Configuration
router.get('/chats/ice-config', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    // ── STUN servers ──────────────────────────────────────────────────────
    const stunUrlsEnv = process.env.STUN_URLS;
    let stunUrls: string[] = [];
    if (stunUrlsEnv) {
      stunUrls = stunUrlsEnv.split(',').map(u => u.trim()).filter(Boolean);
    }
    if (stunUrls.length === 0) {
      stunUrls = [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ];
    }

    // ── TURN servers ──────────────────────────────────────────────────────
    // Supports comma-separated list in TURN_URLS (preferred) or legacy TURN_URL
    // Format per entry: "turn:host:port" (uses shared TURN_USERNAME/TURN_PASSWORD)
    const sharedUsername = process.env.TURN_USERNAME || '';
    const sharedPassword = process.env.TURN_PASSWORD || '';

    const turnUrlsRaw = process.env.TURN_URLS || process.env.TURN_URL || '';
    const turnEntries = turnUrlsRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const iceServers: any[] = [{ urls: stunUrls }];
    let turnConfigured = false;

    if (turnEntries.length > 0 && sharedUsername && sharedPassword) {
      // Group all TURN urls into a single iceServer entry for efficiency
      iceServers.push({
        urls: turnEntries,
        username: sharedUsername,
        credential: sharedPassword,
      });
      turnConfigured = true;
    } else if (turnEntries.length > 0) {
      // URLs provided but no credentials — add as STUN-like entries (will fail auth but won't break)
      iceServers.push({ urls: turnEntries });
    }

    return res.json({
      iceServers,
      turnConfigured,
      turnUrlCount: turnEntries.length,
    });
  } catch (error) {
    console.error('Error fetching ICE config:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


// Diagnostics logging endpoint
router.post('/diagnostics/log', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { level, message, details } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const safeDetails = details ? redactObject(details) : undefined;
  const safeMessage = redactString(message);

  const logMsg = `[Client Diagnostics] ${safeMessage}`;
  if (level === 'warn') {
    logger.warn(logMsg, safeDetails);
  } else if (level === 'error') {
    logger.error(logMsg, safeDetails);
  } else {
    logger.info(logMsg, safeDetails);
  }

  return res.json({ success: true });
});

// Create Group Chat
router.post('/chats/group', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;
  const { name, description, avatarUrl, memberIds } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  const uniqueMemberIds = Array.from(new Set(memberIds || [])) as string[];
  // Include creator
  const allMemberIds = Array.from(new Set([currentUserId, ...uniqueMemberIds]));

  const MAX_GROUP_MEMBERS = parseInt(process.env.MAX_GROUP_MEMBERS || '100');
  if (allMemberIds.length > MAX_GROUP_MEMBERS) {
    return res.status(400).json({ error: `Group size exceeds maximum limit of ${MAX_GROUP_MEMBERS} members.` });
  }

  try {
    const chat = await prisma.chat.create({
      data: {
        type: 'GROUP',
        groupName: name,
        groupDescription: description || null,
        groupAvatarUrl: avatarUrl || null,
        groupCreatedAt: new Date(),
        groupUpdatedAt: new Date(),
        members: {
          create: allMemberIds.map((userId) => ({
            userId,
            role: userId === currentUserId ? 'OWNER' : 'MEMBER'
          }))
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                profile: true
              }
            }
          }
        }
      }
    });

    // Broadcast group creation via Socket.IO
    const io = req.app.get('io');
    if (io) {
      allMemberIds.forEach((mId) => {
        io.to(`user:${mId}`).emit('group_created', { chat });
      });
    }

    // Send push notifications for group invitation (excluding the creator)
    allMemberIds.forEach((mId) => {
      if (mId !== currentUserId) {
        NotificationService.sendPush(
          mId,
          'Group Invitation',
          `You were added to a new group: ${name}`,
          { type: 'group_invite', chatId: chat.id }
        ).catch((e: any) => logger.error('Group invite push failed:', e.message));
      }
    });

    return res.status(201).json(chat);
  } catch (error) {
    logger.error('Create group chat error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Group Metadata
router.put('/chats/group/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;
  const chatId = req.params.id;
  const { name, description, avatarUrl } = req.body;

  try {
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUserId } }
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Access denied: Requires admin or owner permissions' });
    }

    const updatedChat = await prisma.chat.update({
      where: { id: chatId },
      data: {
        groupName: name !== undefined ? name : undefined,
        groupDescription: description !== undefined ? description : undefined,
        groupAvatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
        groupUpdatedAt: new Date(),
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                profile: true
              }
            }
          }
        }
      }
    });

    // Broadcast update via socket
    const io = req.app.get('io');
    if (io) {
      updatedChat.members.forEach((member) => {
        io.to(`user:${member.userId}`).emit('group_updated', { chat: updatedChat });
      });
    }

    return res.json(updatedChat);
  } catch (error) {
    logger.error('Update group metadata error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Add Members to Group Chat
router.post('/chats/group/:id/members', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;
  const chatId = req.params.id;
  const { memberIds } = req.body;

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'memberIds array is required' });
  }

  try {
    const currentMember = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUserId } }
    });

    if (!currentMember || (currentMember.role !== 'OWNER' && currentMember.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Access denied: Requires admin or owner permissions' });
    }

    const existingMembers = await prisma.chatMember.findMany({
      where: { chatId },
      select: { userId: true }
    });
    const existingMemberIds = existingMembers.map(m => m.userId);

    const newMemberIds = Array.from(new Set(memberIds)).filter(mId => !existingMemberIds.includes(mId)) as string[];
    if (newMemberIds.length === 0) {
      return res.status(400).json({ error: 'All specified users are already members of this group' });
    }

    const totalMemberCount = existingMemberIds.length + newMemberIds.length;
    const MAX_GROUP_MEMBERS = parseInt(process.env.MAX_GROUP_MEMBERS || '100');
    if (totalMemberCount > MAX_GROUP_MEMBERS) {
      return res.status(400).json({ error: `Adding members exceeds the limit of ${MAX_GROUP_MEMBERS} members.` });
    }

    // Insert new members
    await prisma.chatMember.createMany({
      data: newMemberIds.map(userId => ({
        chatId,
        userId,
        role: 'MEMBER'
      }))
    });

    const updatedChat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                profile: true
              }
            }
          }
        }
      }
    });

    // Notify all members
    const io = req.app.get('io');
    if (io && updatedChat) {
      updatedChat.members.forEach((member) => {
        io.to(`user:${member.userId}`).emit('member_joined', { chatId, members: updatedChat.members, newMemberIds });
      });
    }

    // Send push notifications to newly added members
    if (updatedChat) {
      newMemberIds.forEach((mId) => {
        if (mId !== currentUserId) {
          NotificationService.sendPush(
            mId,
            'Group Invitation',
            `You were added to a group: ${updatedChat.groupName}`,
            { type: 'group_invite', chatId }
          ).catch((e: any) => logger.error('Group invite push failed:', e.message));
        }
      });
    }

    return res.json(updatedChat);
  } catch (error) {
    logger.error('Add members error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove Member or Leave Group
router.delete('/chats/group/:id/members/:userId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;
  const chatId = req.params.id;
  const targetUserId = req.params.userId;

  try {
    const isLeaving = currentUserId === targetUserId;

    // Fetch details of target user and initiator
    const targetMember = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: targetUserId } }
    });

    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found in this group' });
    }

    if (targetMember.role === 'OWNER') {
      // Owner cannot leave or be removed unless ownership is transferred or group is deleted
      return res.status(400).json({ error: 'OWNER cannot leave the group. Transfer ownership first or delete the group.' });
    }

    if (!isLeaving) {
      // Removing someone else. Initiator must be OWNER or ADMIN
      const currentMember = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId, userId: currentUserId } }
      });

      if (!currentMember || (currentMember.role !== 'OWNER' && currentMember.role !== 'ADMIN')) {
        return res.status(403).json({ error: 'Access denied: Requires admin or owner permissions' });
      }

      // Admins cannot remove other Admins/Owners
      if (currentMember.role === 'ADMIN' && targetMember.role === 'ADMIN') {
        return res.status(403).json({ error: 'Access denied: Admins cannot remove other Admins' });
      }
    }

    // Delete membership
    await prisma.chatMember.delete({
      where: { chatId_userId: { chatId, userId: targetUserId } }
    });

    // Notify via Socket
    const existingMembers = await prisma.chatMember.findMany({
      where: { chatId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: true
          }
        }
      }
    });

    const io = req.app.get('io');
    if (io) {
      // Emit to remaining members + the removed member
      const notifyUsers = [...existingMembers.map(m => m.userId), targetUserId];
      notifyUsers.forEach((userId) => {
        io.to(`user:${userId}`).emit('member_left', { chatId, userId: targetUserId, remainingMembers: existingMembers });
      });
    }

    return res.json({ success: true, remainingMembers: existingMembers });
  } catch (error) {
    logger.error('Remove member/leave error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Transfer Owner Role
router.post('/chats/group/:id/transfer-owner', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const currentUserId = req.userId!;
  const chatId = req.params.id;
  const { newOwnerId } = req.body;

  if (!newOwnerId) {
    return res.status(400).json({ error: 'newOwnerId is required' });
  }

  try {
    const currentMember = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: currentUserId } }
    });

    if (!currentMember || currentMember.role !== 'OWNER') {
      return res.status(403).json({ error: 'Access denied: Only OWNER can transfer group ownership' });
    }

    const targetMember = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: newOwnerId } }
    });

    if (!targetMember) {
      return res.status(404).json({ error: 'New owner must be a member of the group' });
    }

    // Update old owner to ADMIN, new owner to OWNER
    await prisma.$transaction([
      prisma.chatMember.update({
        where: { chatId_userId: { chatId, userId: currentUserId } },
        data: { role: 'ADMIN' }
      }),
      prisma.chatMember.update({
        where: { chatId_userId: { chatId, userId: newOwnerId } },
        data: { role: 'OWNER' }
      })
    ]);

    const updatedMembers = await prisma.chatMember.findMany({
      where: { chatId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            profile: true
          }
        }
      }
    });

    const io = req.app.get('io');
    if (io) {
      updatedMembers.forEach((member) => {
        io.to(`user:${member.userId}`).emit('owner_transferred', { chatId, oldOwnerId: currentUserId, newOwnerId, members: updatedMembers });
      });
    }

    return res.json({ success: true, members: updatedMembers });
  } catch (error) {
    logger.error('Transfer ownership error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
