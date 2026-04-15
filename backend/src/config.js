'use strict';
module.exports = {
  PORT:            process.env.PORT       || 8080,
  REDIS_URL:       process.env.REDIS_URL  || 'redis://localhost:6379',
  ADMIN_CODE:      process.env.ADMIN_CODE || 'anggimotti',
  TICK_MS:         1000 / 128,
  ADMIN_TOKEN_TTL: 3600, // seconds (1 hour for stable sessions)
  MAX_CHAT:        300,
  MAX_ADMIN_LOGS:  100,
};
