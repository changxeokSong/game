'use strict';
const redis = require('../db/redis');

const rankKey = gameId      => `rankings:${gameId}`;
const statKey = (name, gid) => `usergame:${name}:${gid}`;

async function recordResult(name, gameId, result) {
  const rk = rankKey(gameId);
  const sk = statKey(name, gameId);
  if (result === 'win') {
    await redis.zincrby(rk, 1, name);
    await redis.hincrby(sk, 'wins', 1);
  } else {
    await redis.hincrby(sk, 'losses', 1);
    // Ensure the member exists in the sorted set even with 0 wins
    const score = await redis.zscore(rk, name);
    if (score === null) await redis.zadd(rk, 0, name);
  }
}

async function getTop(gameId, limit = 20) {
  const rk = rankKey(gameId);
  const raw = await redis.zrevrange(rk, 0, limit - 1, 'WITHSCORES');
  const result = [];
  for (let i = 0; i < raw.length; i += 2) {
    const name   = raw[i];
    const wins   = parseInt(raw[i + 1], 10);
    const stats  = await redis.hgetall(statKey(name, gameId));
    const losses = parseInt(stats?.losses || 0, 10);
    const total  = wins + losses;
    result.push({ name, wins, losses, rate: total > 0 ? Math.round(wins / total * 100) : 0 });
  }
  return result;
}

async function resetGame(gameId) {
  const rk      = rankKey(gameId);
  const members = await redis.zrange(rk, 0, -1);
  const pipe    = redis.pipeline();
  pipe.del(rk);
  for (const m of members) pipe.del(statKey(m, gameId));
  await pipe.exec();
}

module.exports = { recordResult, getTop, resetGame };
