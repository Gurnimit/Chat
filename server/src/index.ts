import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
import helmet from 'helmet';

// Load environment variables
dotenv.config();

import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';
import uploadRoutes from './routes/upload.routes';
import observabilityRoutes from './routes/observability.routes';
import friendRoutes from './routes/friend.routes';
import callRoutes from './routes/call.routes';
import notificationRoutes from './routes/notification.routes';
import { setupChatSockets } from './sockets/chat.socket';
import prisma from './utils/db';
import { logger } from './utils/logger';
import { correlationMiddleware } from './middleware/correlation.middleware';

// Validate critical environment variables
const requiredEnv = ['ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET', 'DATABASE_URL'];
const missingEnv = requiredEnv.filter(name => !process.env[name]);
if (missingEnv.length > 0) {
  logger.error(`FATAL: Missing critical environment variables: ${missingEnv.join(', ')}`);
  console.error(`FATAL: Missing critical environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Validate Firebase/FCM environment variables if enabled
if (process.env.FCM_ENABLED === 'true') {
  const fcmPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!fcmPath) {
    logger.error('FATAL: FCM_ENABLED is set to true, but FIREBASE_SERVICE_ACCOUNT_PATH is not defined in the environment.');
    console.error('FATAL: FCM_ENABLED is set to true, but FIREBASE_SERVICE_ACCOUNT_PATH is not defined in the environment.');
    process.exit(1);
  }

  const fs = require('fs');
  const path = require('path');
  const resolvedPath = path.resolve(fcmPath);

  if (!fs.existsSync(resolvedPath)) {
    logger.error(`FATAL: Firebase service account file not found at: ${resolvedPath}`);
    console.error(`FATAL: Firebase service account file not found at: ${resolvedPath}`);
    process.exit(1);
  }

  try {
    const fileContent = fs.readFileSync(resolvedPath, 'utf8');
    JSON.parse(fileContent);
  } catch (err: any) {
    logger.error(`FATAL: Firebase service account file at ${resolvedPath} is not a valid JSON: ${err.message}`);
    console.error(`FATAL: Firebase service account file at ${resolvedPath} is not a valid JSON: ${err.message}`);
    process.exit(1);
  }
}

// Block usage of default secrets in production, warn in development
const hasDefaultSecrets =
  process.env.ACCESS_TOKEN_SECRET === 'super_secret_access_key_123' ||
  process.env.REFRESH_TOKEN_SECRET === 'super_secret_refresh_key_456';

if (process.env.NODE_ENV === 'production' && hasDefaultSecrets) {
  logger.error('FATAL: Default development JWT secrets are not allowed in production environment.');
  console.error('FATAL: Default development JWT secrets are not allowed in production environment.');
  process.exit(1);
}

if (process.env.NODE_ENV !== 'production' && hasDefaultSecrets) {
  logger.warn('WARNING: Using default development JWT secrets. Do not use in production.');
}

const app = express();
const server = http.createServer(app);

// CORS configurations
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
const allowedOrigins = allowedOriginsEnv
  ? allowedOriginsEnv.split(',').map(o => o.trim()).filter(Boolean)
  : [
      'http://localhost:5173',
      'http://localhost:5000',
      'http://localhost',
      'https://localhost',
      'http://10.114.9.121:5000',
      'http://10.114.9.121:5173',
      'http://10.114.9.121'
    ];

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

app.set('io', io);

// Rate limit bypass only works in non-production environments
const canBypassRateLimit = (req: any) =>
  process.env.NODE_ENV !== 'production' &&
  req.headers['x-bypass-rate-limit'] === 'bypass-key-123';

// Rate limiting to secure authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again after 15 minutes' },
  skip: canBypassRateLimit,
});

// Stricter rate limit for login attempts (15 attempts per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  skip: canBypassRateLimit,
});

// Stricter rate limit for account registrations (5 attempts per hour)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts, please try again after an hour' },
  skip: canBypassRateLimit,
});

// Rate limit for file uploads (10 uploads per 10 minutes)
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many file uploads, please try again after 10 minutes' },
  skip: canBypassRateLimit,
});

// Rate limit for diagnostics logging (30 requests per 10 minutes)
const diagnosticsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many diagnostics logs sent, please try again later' },
  skip: canBypassRateLimit,
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "http:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
      mediaSrc: ["'self'", "blob:", "http:", "https:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  xContentTypeOptions: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Setup correlation tracing middleware
app.use(correlationMiddleware);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static Files Serving for Uploads with custom security headers and disposition limits
app.use('/uploads', (req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox;");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  const ext = path.extname(req.path).toLowerCase();
  const inlineExts = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.mp3', '.ogg', '.wav', '.aac', '.mp4', '.webm', '.avi'];
  if (inlineExts.includes(ext)) {
    res.setHeader('Content-Disposition', 'inline');
  } else {
    res.setHeader('Content-Disposition', 'attachment');
  }
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

// Routes mapping
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/diagnostics/log', diagnosticsLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', chatRoutes); // Exposes /chats, /users/search, /messages
app.use('/api/upload', uploadLimiter, uploadRoutes);
app.use('/api/observability', observabilityRoutes);
app.use('/api/friends', authLimiter, friendRoutes);
app.use('/api/calls', authLimiter, callRoutes);
app.use('/api/notifications', authLimiter, notificationRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Secure Real-time Chat API is running!' });
});

// Setup Sockets
setupChatSockets(io);

// Server startup
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully.');

    server.listen(Number(PORT), '0.0.0.0', () => {
      logger.info(`Server is running on port ${PORT} (bound to 0.0.0.0)`);
      logger.info(`Socket server initialized.`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Clean up DB connections on process termination
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  logger.info('Prisma disconnected.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  logger.info('Prisma disconnected.');
  process.exit(0);
});
