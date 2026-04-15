'use strict';
const redis = require('../db/redis');
const { now } = require('../utils/helpers');

const key = name => `user:${name}`;

async function getOrCreate(name) {
  const k = key(name);
  const exists = await redis.exists(k);
  if (!exists) await redis.hset(k, { firstSeen: now(), lastSeen: now() });
  return redis.hgetall(k);
}

async function touch(name) {
  await redis.hset(key(name), 'lastSeen', now());
}

async function count() {
  const keys = await redis.keys('user:*');
  return keys.filter(k => !k.includes(':')).length;
}

module.exports = { getOrCreate, touch, count };
