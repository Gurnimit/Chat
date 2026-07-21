import prisma from './db';

export async function sanitizeProfileForUser(requestingUserId: string, targetUser: any) {
  if (!targetUser) return targetUser;
  
  // Get target user ID
  const targetUserId = targetUser.id || targetUser.userId;
  if (!targetUserId || targetUserId === requestingUserId) {
    return targetUser; // Don't restrict own profile
  }

  // Fetch target user's privacy preferences
  const targetPref = await prisma.notificationPreference.findUnique({
    where: { userId: targetUserId }
  });

  if (!targetPref) return targetUser;

  // Clone object to prevent side-effects
  const sanitized = JSON.parse(JSON.stringify(targetUser));
  const hasProfile = !!sanitized.profile;

  // 1. Profile photo privacy check
  if (targetPref.whoCanSeeProfilePhoto === 'NOONE') {
    if (hasProfile) sanitized.profile.avatarUrl = null;
    else if (sanitized.avatarUrl !== undefined) sanitized.avatarUrl = null;
  } else if (targetPref.whoCanSeeProfilePhoto === 'FRIENDS') {
    const isFriend = await prisma.friendship.findFirst({
      where: { userId: requestingUserId, friendId: targetUserId }
    });
    if (!isFriend) {
      if (hasProfile) sanitized.profile.avatarUrl = null;
      else if (sanitized.avatarUrl !== undefined) sanitized.avatarUrl = null;
    }
  }

  // 2. Last seen / online status privacy check
  if (targetPref.whoCanSeeLastSeen === 'NOONE') {
    if (hasProfile) {
      sanitized.profile.isOnline = false;
      sanitized.profile.lastSeen = new Date(0).toISOString();
    } else {
      if (sanitized.isOnline !== undefined) sanitized.isOnline = false;
      if (sanitized.lastSeen !== undefined) sanitized.lastSeen = new Date(0).toISOString();
    }
  } else if (targetPref.whoCanSeeLastSeen === 'FRIENDS') {
    const isFriend = await prisma.friendship.findFirst({
      where: { userId: requestingUserId, friendId: targetUserId }
    });
    if (!isFriend) {
      if (hasProfile) {
        sanitized.profile.isOnline = false;
        sanitized.profile.lastSeen = new Date(0).toISOString();
      } else {
        if (sanitized.isOnline !== undefined) sanitized.isOnline = false;
        if (sanitized.lastSeen !== undefined) sanitized.lastSeen = new Date(0).toISOString();
      }
    }
  }

  return sanitized;
}

export async function sanitizeProfilesList(requestingUserId: string, usersList: any[]) {
  if (!usersList || !Array.isArray(usersList)) return usersList;
  return Promise.all(usersList.map(u => sanitizeProfileForUser(requestingUserId, u)));
}
