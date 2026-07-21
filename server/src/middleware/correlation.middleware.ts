import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { correlationStore } from '../utils/logger';

export const correlationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  res.setHeader('x-correlation-id', correlationId);
  correlationStore.run(correlationId, next);
};
