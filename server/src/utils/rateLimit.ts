import { logger } from './logger';

interface RateLimitEntry {
  timestamps: number[];
}

const minutelyRequests = new Map<string, RateLimitEntry>();
const dailyRequests = new Map<string, RateLimitEntry>();

const profileLookupMinutely = new Map<string, RateLimitEntry>();

/**
 * Checks and updates rate limits for friend requests.
 * Returns true if allowed, false if limit exceeded.
 */
export function checkFriendRequestLimit(userId: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // 1. Minute check
  if (!minutelyRequests.has(userId)) {
    minutelyRequests.set(userId, { timestamps: [] });
  }
  const minEntry = minutelyRequests.get(userId)!;
  minEntry.timestamps = minEntry.timestamps.filter(t => t > oneMinuteAgo);

  if (minEntry.timestamps.length >= 5) {
    logger.warn(`[ABUSE ATTEMPT] User ${userId} exceeded friend request minute rate limit.`);
    return { allowed: false, reason: 'Friend request limit reached (max 5 per minute).' };
  }

  // 2. Day check
  if (!dailyRequests.has(userId)) {
    dailyRequests.set(userId, { timestamps: [] });
  }
  const dayEntry = dailyRequests.get(userId)!;
  dayEntry.timestamps = dayEntry.timestamps.filter(t => t > oneDayAgo);

  if (dayEntry.timestamps.length >= 20) {
    logger.warn(`[ABUSE ATTEMPT] User ${userId} exceeded friend request daily rate limit.`);
    return { allowed: false, reason: 'Friend request limit reached (max 20 per day).' };
  }

  // Record request
  minEntry.timestamps.push(now);
  dayEntry.timestamps.push(now);
  return { allowed: true };
}

/**
 * Checks and updates rate limits for QR / Public Profile Lookups.
 * Max 10 per minute to prevent user enumeration.
 */
export function checkProfileLookupLimit(ipOrUserId: string): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  if (!profileLookupMinutely.has(ipOrUserId)) {
    profileLookupMinutely.set(ipOrUserId, { timestamps: [] });
  }
  const entry = profileLookupMinutely.get(ipOrUserId)!;
  entry.timestamps = entry.timestamps.filter(t => t > oneMinuteAgo);

  if (entry.timestamps.length >= 15) {
    logger.warn(`[ABUSE ATTEMPT] IP/User ${ipOrUserId} exceeded profile lookup rate limit.`);
    return false;
  }

  entry.timestamps.push(now);
  return true;
}
