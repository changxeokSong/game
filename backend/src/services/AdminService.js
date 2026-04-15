'use strict';
const redis = require('../db/redis');
const { genToken, now } = require('../utils/helpers');
const { ADMIN_TOKEN_TTL, MAX_ADMIN_LOGS } = require('../config');

const LOG_KEY  = 'admin:logs';
const TOK_KEY  = token => `admin:token:${token}`;

async function issueToken(username) {
  const token = genToken();
  await redis.set(TOK_KEY(token), username, 'EX', ADMIN_TOKEN_TTL);
  return token;
}

async function validateToken(token) {
  const k        = TOK_KEY(token);
  const username = await redis.get(k);
  if (username) await redis.del(k);
  return username;   // null when not found / expired
}

async function log(action, by, extra = {}) {
  const entry = { action, by, ts: now(), ...extra };
  await redis.lpush(LOG_KEY, JSON.stringify(entry));
  await redis.ltrim(LOG_KEY, 0, MAX_ADMIN_LOGS - 1);
}

async function getLogs(n = 50) {
  const raw = await redis.lrange(LOG_KEY, 0, n - 1);
  return raw.map(s => JSON.parse(s));
}

module.exports = { issueToken, validateToken, log, getLogs };
