'use strict';

/**
 * A small fixed-window rate limiter, kept in memory so the project gains no new
 * dependency. Good enough for a single instance; if you ever run more than one
 * backend replica, move this to Redis or Supabase.
 */
function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, keyFn, message } = {}) {
  const hits = new Map();

  // Drop expired buckets so a long-running process cannot grow unbounded.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  if (sweep.unref) sweep.unref();

  return function rateLimiter(req, res, next) {
    const key = keyFn ? keyFn(req) : req.ip;
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: message || `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      });
    }

    next();
  };
}

module.exports = rateLimit;
