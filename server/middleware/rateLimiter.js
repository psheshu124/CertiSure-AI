/**
 * In-memory sliding window rate limiter
 * Protects expensive endpoints (OCR, verification) against automated scraping and abuse.
 */
const rateLimitStore = new Map();

/**
 * Creates a rate limiter middleware
 * @param {Object} options
 * @param {number} options.windowMs - Sliding window in milliseconds (default 15 mins)
 * @param {number} options.max - Max requests per window for unauthenticated callers
 * @param {number} options.maxAuthenticated - Max requests per window for authenticated callers
 * @param {string} options.endpointName - Name for telemetry and error messages
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 20,
  maxAuthenticated = 100,
  endpointName = 'API'
} = {}) {
  return (req, res, next) => {
    const isAuthed = Boolean(req.user?.id || req.headers.authorization?.startsWith('Bearer '));
    const effectiveLimit = isAuthed ? maxAuthenticated : max;

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
    const key = `${endpointName}:${req.user?.id || ip}`;
    const now = Date.now();

    const record = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count += 1;
    }

    rateLimitStore.set(key, record);

    res.setHeader('X-RateLimit-Limit', effectiveLimit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, effectiveLimit - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > effectiveLimit) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests to ${endpointName}. Rate limit is ${effectiveLimit} requests per ${Math.round(windowMs / 60000)} minutes. Please wait ${retryAfterSec}s before retrying.`
      });
    }

    next();
  };
}

// Automatic cleanup every 10 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);
