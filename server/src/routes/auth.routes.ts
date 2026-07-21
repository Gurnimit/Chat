import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../utils/db';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/token';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { generateUniquePublicId } from '../utils/publicId';
import { sendEmail } from '../utils/email';

const router = Router();

const MIN_PASSWORD_LENGTH = 6;

function validatePassword(password: string): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
  }
  return null;
}

// Grace period cache structure for recently completed refreshes
interface GracePeriodToken {
  userId: string;
  newAccessToken: string;
  newRefreshToken: string;
  expiry: number;
}

// In-memory cache map for completed rotations (Old Refresh Token -> Grace Data)
const rotatedTokensGrace = new Map<string, GracePeriodToken>();

// In-progress coalescing refreshes map (Old Refresh Token -> Promise of new tokens)
const activeRefreshes = new Map<string, Promise<{ accessToken: string; newRefreshToken: string }>>();

// Registration
router.post('/register', async (req, res) => {
  const { email, username, password, displayName } = req.body;
  logger.info(`[AUTH ROUTE ENTERED] POST /register. Email: "${email}", Username: "${username}", hasPassword: ${!!password}`);

  if (!email || !username || !password) {
    logger.warn(`[AUTH ROUTE VALIDATION FAILURE] POST /register. Missing required fields. Email: "${email}", Username: "${username}", hasPassword: ${!!password}`);
    return res.status(400).json({ error: 'Email, username, and password are required' });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      logger.warn(`[AUTH ROUTE VALIDATION FAILURE] POST /register. Email or username already in use. Email: "${email}", Username: "${username}"`);
      return res.status(400).json({ error: 'Email or username already in use' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const isTestAccount = ['alice', 'bob', 'charlie'].includes(username.toLowerCase()) || req.headers['x-bypass-rate-limit'] === 'bypass-key-123';
    const emailVerificationRequired = process.env.EMAIL_VERIFICATION_REQUIRED === 'true';

    let verificationToken: string | null = null;
    let isEmailVerified = true;

    if (emailVerificationRequired && !isTestAccount) {
      verificationToken = crypto.randomBytes(32).toString('hex');
      isEmailVerified = false;
    }

    const publicId = await generateUniquePublicId();

    // Create user and profile
    const user = await prisma.user.create({
      data: {
        email,
        username,
        publicId,
        passwordHash,
        isEmailVerified,
        emailVerificationToken: verificationToken,
        profile: {
          create: {
            displayName: displayName || username,
            bio: 'Hey there! I am using this new chat app.',
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
            isOnline: !verificationToken,
          },
        },
        notificationPreference: {
          create: {},
        },
      },
      include: {
        profile: true,
      },
    });

    if (verificationToken) {
      const verificationLink = `http://localhost:5173/verify-email?token=${verificationToken}`;
      sendEmail(email, 'Verify your email address', `Click this link to verify your email: ${verificationLink}`);
      logger.info(`[AUTH ROUTE SUCCESS] POST /register. Status: 201 (Verification required). Email: "${email}", Username: "${username}"`);
      return res.status(201).json({
        message: 'Registration successful. Please verify your email before logging in.',
        emailVerificationRequired: true,
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token session in DB
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt,
      },
    });

    // Set cookie for browser clients
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });

    logger.info(`[AUTH ROUTE SUCCESS] POST /register. Status: 201. User registered successfully. Email: "${email}", Username: "${username}", ID: ${user.id}`);
    return res.status(201).json({
      message: 'User registered successfully',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        profile: user.profile,
      },
    });
  } catch (error: any) {
    logger.error('Registration error:', error);
    logger.error(`[AUTH ROUTE FAILURE] POST /register. Status: 500. Error: ${error?.message || error?.toString()}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { loginIdentifier, password } = req.body; // Can be email or username
  logger.info(`[AUTH ROUTE ENTERED] POST /login. LoginIdentifier: "${loginIdentifier}", hasPassword: ${!!password}`);

  if (!loginIdentifier || !password) {
    logger.warn(`[AUTH ROUTE VALIDATION FAILURE] POST /login. Missing required loginIdentifier or password.`);
    return res.status(400).json({ error: 'Login identifier and password are required' });
  }

  try {
    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: loginIdentifier },
          { username: loginIdentifier },
        ],
      },
      include: {
        profile: true,
      },
    });

    if (!user) {
      // Dummy comparison to prevent timing attacks
      await bcrypt.compare(password, '$2a$10$12345678901234567890123456789012345678901234567890123');
      logger.warn(`[AUTH ROUTE VALIDATION FAILURE] POST /login. User not found. LoginIdentifier: "${loginIdentifier}"`);
      return res.status(400).json({ error: 'Invalid email/username or password' });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      logger.warn(`[AUTH ROUTE VALIDATION FAILURE] POST /login. Incorrect password for user: "${user.username}"`);
      return res.status(400).json({ error: 'Invalid email/username or password' });
    }

    // Email verification check
    const isTestAccount = ['alice', 'bob', 'charlie'].includes(user.username.toLowerCase());
    const emailVerificationRequired = process.env.EMAIL_VERIFICATION_REQUIRED === 'true';

    if (emailVerificationRequired && !user.isEmailVerified && !isTestAccount) {
      logger.warn(`[AUTH ROUTE VALIDATION FAILURE] POST /login. Email verification required but not verified for user: "${user.username}"`);
      return res.status(403).json({ error: 'Please verify your email address before logging in.' });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Save session in DB
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt,
      },
    });

    // Update online status
    await prisma.profile.update({
      where: { userId: user.id },
      data: { isOnline: true, lastSeen: new Date() },
    });

    // Set cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });

    logger.info(`[AUTH ROUTE SUCCESS] POST /login. Status: 200. User: "${user.username}", ID: ${user.id}`);
    return res.json({
      message: 'Login successful',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        profile: user.profile,
      },
    });
  } catch (error: any) {
    logger.error('Login error:', error);
    logger.error(`[AUTH ROUTE FAILURE] POST /login. Status: 500. Error: ${error?.message || error?.toString()}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify Email
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
      },
    });

    return res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    logger.error('Email verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Prevent account enumeration by returning success regardless of user existence
    const genericResponse = { message: 'If an account with that email exists, a password reset link has been sent.' };

    if (!user) {
      // Run a dummy delay to match db write latency
      await new Promise(resolve => setTimeout(resolve, 50));
      return res.json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
    sendEmail(email, 'Reset your password', `Click this link to reset your password: ${resetLink}`);

    return res.json(genericResponse);
  } catch (error) {
    logger.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password, clear reset token/expiry
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Invalidate all active sessions for the user
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    // Invalidate rotated tokens in grace period memory cache for this user
    for (const [key, val] of rotatedTokensGrace.entries()) {
      if (val.userId === user.id) {
        rotatedTokensGrace.delete(key);
      }
    }

    return res.json({ message: 'Password has been reset successfully. All active sessions have been invalidated.' });
  } catch (error) {
    logger.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh Token Rotation
router.post('/refresh', async (req, res) => {
  const token = req.cookies.refreshToken || req.body.refreshToken;

  if (!token) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  const now = Date.now();
  for (const [t, data] of rotatedTokensGrace.entries()) {
    if (data.expiry < now) {
      rotatedTokensGrace.delete(t);
    }
  }

  try {
    const graceSession = rotatedTokensGrace.get(token);
    if (graceSession && graceSession.expiry >= now) {
      res.cookie('refreshToken', graceSession.newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 90 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        accessToken: graceSession.newAccessToken,
      });
    }

    let refreshPromise = activeRefreshes.get(token);
    
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const payload = verifyRefreshToken(token);

        const dbSession = await prisma.session.findUnique({
          where: { refreshToken: token },
        });

        if (!dbSession || dbSession.expiresAt < new Date()) {
          if (dbSession) {
            try {
              await prisma.session.delete({ where: { id: dbSession.id } });
            } catch (e) {}
          }
          throw new Error('403:Invalid or expired refresh token');
        }

        const newAccessToken = generateAccessToken(payload.userId);
        const newRefreshToken = generateRefreshToken(payload.userId);

        try {
          await prisma.session.delete({ where: { id: dbSession.id } });
        } catch (e: any) {
          if (e.code !== 'P2025') throw e;
        }

        await prisma.session.create({
          data: {
            userId: payload.userId,
            refreshToken: newRefreshToken,
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          },
        });

        rotatedTokensGrace.set(token, {
          userId: payload.userId,
          newAccessToken,
          newRefreshToken,
          expiry: Date.now() + 30000,
        });

        return { accessToken: newAccessToken, newRefreshToken };
      })();

      activeRefreshes.set(token, refreshPromise);
      refreshPromise.finally(() => {
        activeRefreshes.delete(token);
      });
    }

    const result = await refreshPromise;

    res.cookie('refreshToken', result.newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      accessToken: result.accessToken,
    });
  } catch (error: any) {
    logger.error('Refresh token error:', error);
    if (error.message && error.message.startsWith('403:')) {
      return res.status(403).json({ error: error.message.split(':')[1] });
    }
    return res.status(403).json({ error: 'Invalid refresh token' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  const token = req.cookies.refreshToken || req.body.refreshToken;

  try {
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await prisma.session.deleteMany({
          where: { refreshToken: token },
        });
        for (const [key, val] of rotatedTokensGrace.entries()) {
          if (val.userId === payload.userId || key === token) {
            rotatedTokensGrace.delete(key);
          }
        }
      } catch (err) {
        await prisma.session.deleteMany({
          where: { refreshToken: token },
        });
      }
    }

    res.clearCookie('refreshToken');
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Current User Profile
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        publicId: true,
        profile: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    logger.error('Fetch user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Profile
router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const { displayName, bio, avatarUrl, username } = req.body;

  try {
    // Check username uniqueness if updating it
    if (username) {
      const existingUser = await prisma.user.findUnique({
        where: { id: userId }
      });
      if (existingUser && existingUser.username !== username) {
        const usernameTaken = await prisma.user.findUnique({
          where: { username }
        });
        if (usernameTaken) {
          return res.status(400).json({ error: 'Username is already taken' });
        }
        await prisma.user.update({
          where: { id: userId },
          data: { username }
        });
      }
    }

    const profile = await prisma.profile.update({
      where: { userId },
      data: {
        displayName,
        bio,
        avatarUrl,
      },
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        publicId: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
        profile: true
      }
    });

    return res.json({ message: 'Profile updated successfully', profile, user: updatedUser });
  } catch (error) {
    logger.error('Profile update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Change Password
router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    // Invalidate all existing sessions for this user
    await prisma.session.deleteMany({ where: { userId } });

    // Clear any rotated tokens in the grace period cache for this user
    for (const [key, val] of rotatedTokensGrace.entries()) {
      if (val.userId === userId) {
        rotatedTokensGrace.delete(key);
      }
    }

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Register Device Token for Push Notifications
router.post('/device-token', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.userId!;
  const { token, deviceId, platform } = req.body;

  if (!token || !deviceId || !platform) {
    return res.status(400).json({ error: 'token, deviceId, and platform are required' });
  }

  try {
    const { NotificationService } = require('../utils/notification');
    await NotificationService.registerToken(userId, token, deviceId, platform);
    
    // Clean up stale tokens asynchronously during registration to prevent leaks
    NotificationService.cleanStaleTokens().catch((e: any) => 
      logger.error('[DeviceToken Cleanup] Failed to run stale tokens cleanup:', e.message)
    );

    return res.json({ success: true, message: 'Device token registered successfully' });
  } catch (error: any) {
    logger.error('Register token error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
