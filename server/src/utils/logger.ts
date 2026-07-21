import { AsyncLocalStorage } from 'async_hooks';

export const correlationStore = new AsyncLocalStorage<string>();

const SENSITIVE_KEYS = [
  'password',
  'token',
  'refreshtoken',
  'accesstoken',
  'cookie',
  'authorization',
  'credentials',
  'credential',
  'sdp',
  'candidate',
  'pwd',
  'ufrag',
  'secret'
];

function redactValue(key: string, value: any): any {
  if (value && typeof value === 'string') {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      return '[REDACTED]';
    }
    if (key.toLowerCase() === 'authorization' || value.toLowerCase().startsWith('bearer ')) {
      return '[REDACTED]';
    }
  }
  return value;
}

export function redactObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item));
  }
  if (typeof obj === 'object') {
    const redacted: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else if (typeof val === 'object') {
        redacted[key] = redactObject(val);
      } else {
        redacted[key] = redactValue(key, val);
      }
    }
    return redacted;
  }
  return obj;
}

export function redactString(str: string): string {
  let redacted = str;
  // Redact JWT tokens
  redacted = redacted.replace(/eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[REDACTED_JWT]');
  // Redact password JSON fields
  redacted = redacted.replace(/("password"\s*:\s*")[^"]+(")/gi, '$1[REDACTED]$2');
  // Redact password query params
  redacted = redacted.replace(/(password=[^&\s]+)/gi, 'password=[REDACTED]');
  // Redact emails
  redacted = redacted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
  return redacted;
}

function formatArgs(args: any[]): string {
  return args.map(arg => {
    if (arg instanceof Error) {
      return redactString(arg.stack || arg.message);
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(redactObject(arg));
      } catch (e) {
        return '[Unserializable Object]';
      }
    }
    if (typeof arg === 'string') {
      return redactString(arg);
    }
    return String(arg);
  }).join(' ');
}

export const logger = {
  info(...args: any[]) {
    const correlationId = correlationStore.getStore() || 'SYS';
    console.log(`[${new Date().toISOString()}] [INFO] [CID:${correlationId}] ${formatArgs(args)}`);
  },
  warn(...args: any[]) {
    const correlationId = correlationStore.getStore() || 'SYS';
    console.warn(`[${new Date().toISOString()}] [WARN] [CID:${correlationId}] ${formatArgs(args)}`);
  },
  error(...args: any[]) {
    const correlationId = correlationStore.getStore() || 'SYS';
    console.error(`[${new Date().toISOString()}] [ERROR] [CID:${correlationId}] ${formatArgs(args)}`);
  }
};
