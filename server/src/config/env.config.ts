import dotenv from 'dotenv';
import path from 'path';

// Determine environment file to load
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;

dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config(); // fallback to default .env

export interface EnvironmentConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  ACCESS_TOKEN_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
  ALLOWED_ORIGINS: string[];
  EMAIL_VERIFICATION_REQUIRED: boolean;
  FCM_ENABLED: boolean;
  FIREBASE_SERVICE_ACCOUNT_PATH?: string;
  S3_ENDPOINT?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY?: string;
  S3_SECRET_KEY?: string;
  TURN_URLS: string[];
  TURN_USERNAME: string;
  TURN_PASSWORD: string;
}

export const validateAndGetEnv = (): EnvironmentConfig => {
  const missingVars: string[] = [];

  const requiredKeys = ['DATABASE_URL', 'ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET'];

  for (const key of requiredKeys) {
    if (!process.env[key]) {
      missingVars.push(key);
    }
  }

  if (missingVars.length > 0) {
    console.error(`❌ [FATAL] Startup validation failed. Missing required environment variables: ${missingVars.join(', ')}`);
    if (nodeEnv === 'production') {
      process.exit(1);
    }
  }

  const originsRaw = process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5000';
  const origins = originsRaw.split(',').map((o) => o.trim()).filter(Boolean);

  const turnUrlsRaw = process.env.TURN_URLS || 'turn:openrelay.metered.ca:80,turn:openrelay.metered.ca:443';
  const turnUrls = turnUrlsRaw.split(',').map((u) => u.trim()).filter(Boolean);

  return {
    NODE_ENV: nodeEnv,
    PORT: Number(process.env.PORT) || 5000,
    DATABASE_URL: process.env.DATABASE_URL || '',
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || 'default_dev_access_secret',
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'default_dev_refresh_secret',
    ALLOWED_ORIGINS: origins,
    EMAIL_VERIFICATION_REQUIRED: process.env.EMAIL_VERIFICATION_REQUIRED === 'true',
    FCM_ENABLED: process.env.FCM_ENABLED === 'true',
    FIREBASE_SERVICE_ACCOUNT_PATH: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
    S3_SECRET_KEY: process.env.S3_SECRET_KEY,
    TURN_URLS: turnUrls,
    TURN_USERNAME: process.env.TURN_USERNAME || 'openrelayproject',
    TURN_PASSWORD: process.env.TURN_PASSWORD || 'openrelayproject',
  };
};

export const envConfig = validateAndGetEnv();
