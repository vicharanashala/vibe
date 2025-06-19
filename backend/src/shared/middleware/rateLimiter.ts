import rateLimit from 'express-rate-limit';
import {Request, Response, NextFunction} from 'express';

export const rateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 5, // Limit each IP to 5 requests per window
  standardHeaders: true, // Use `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {error: 'Too many requests, please try again later.'},
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Max 5 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

export function AuthRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (process.env.NODE_ENV === 'production') {
    return authRateLimiter(req, res, next); // delegate to express-rate-limit
  } else {
    next();
  }
}
