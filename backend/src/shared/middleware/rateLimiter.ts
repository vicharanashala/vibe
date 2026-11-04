import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { Request } from 'express';

interface LimiterOptions {
  windowMs?: number;        // Time window in milliseconds
  max?: number;             // Max requests per window per IP
  message?: object | string;
  // Defaults to per-IP (express-rate-limit's own default). Pass this to key
  // by something else instead — e.g. the bearer token, for a route where
  // many legitimate users can share one IP (school/campus NAT) and a raw
  // per-IP cap would collectively lock all of them out together.
  keyGenerator?: Options['keyGenerator'];
}

/**
 * Returns a configured rate limiter middleware
 * @param options Limiter options
 */
export const createRateLimiter = (options?: LimiterOptions): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: options?.windowMs ?? 1 * 60 * 1000, // default 15 minutes
    max: options?.max ?? 300,                      // default 100 requests per IP
    standardHeaders: true,                          // Send RateLimit-* headers
    legacyHeaders: false,                           // Disable X-RateLimit-* headers
    message: options?.message ?? {
      status: 429,
      error: 'Too many requests, please try again later.',
    },
    ...(options?.keyGenerator ? { keyGenerator: options.keyGenerator } : {}),
  });
};
