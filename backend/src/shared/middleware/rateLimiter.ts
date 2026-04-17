import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

interface LimiterOptions {
  windowMs?: number;        // Time window in milliseconds
  max?: number;             // Max requests per window per IP
  message?: object | string;
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
  });
};
