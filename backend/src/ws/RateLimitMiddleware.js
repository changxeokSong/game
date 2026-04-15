'use strict';
const { redis } = require('../db/redis');

/**
 * Rate limit middleware using Redis with TTL.
 * Allows `limit` requests per `windowSec`.
 */
async function rateLimit(ip, limit = 50, windowSec = 1) {
  if (!ip) return true;
  const key = `ratelimit:ws:${ip}`;
  
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSec);
    }
    return current <= limit;
  } catch (err) {
    console.error('[RateLimit Error]', err);
    return true; // Fail open
  }
}

module.exports = { rateLimit };
