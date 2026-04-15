'use strict';
const Redis     = require('ioredis');
const { REDIS_URL } = require('../config');

const redis = new Redis(REDIS_URL, {
  retryStrategy: times => Math.min(times * 100, 3000),
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

const pub = new Redis(REDIS_URL);
const sub = new Redis(REDIS_URL);

redis.on('connect', () => console.log('[Redis] connected'));
redis.on('error',   err => console.error('[Redis]', err.message));

module.exports = { redis, pub, sub };
