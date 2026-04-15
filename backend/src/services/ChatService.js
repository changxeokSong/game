'use strict';
const redis = require('../db/redis');
const { now } = require('../utils/helpers');
const { MAX_CHAT } = require('../config');

const CHAT_KEY = 'chat:history';

async function add(username, msg, room) {
  const entry = { username, msg, room, ts: now() };
  await redis.lpush(CHAT_KEY, JSON.stringify(entry));
  await redis.ltrim(CHAT_KEY, 0, MAX_CHAT - 1);
  return entry;
}

async function getRecent(n = 60) {
  const raw = await redis.lrange(CHAT_KEY, 0, n - 1);
  return raw.map(s => JSON.parse(s)).reverse();
}

async function clearAll() {
  await redis.del(CHAT_KEY);
}

module.exports = { add, getRecent, clearAll };
