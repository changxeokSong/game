'use strict';
const { sanitize } = require('../utils/helpers');

/** Registers: chat */
function register(router, ctx) {
  const { clients, bc, chatSvc } = ctx;

  router.on('chat', async (ws, msg) => {
    const info = clients.get(ws);
    if (!info?.username) return;
    const text = sanitize(msg.msg).trim();
    if (!text) return;
    const entry = await chatSvc.add(info.username, text, info.room);
    // Note: Global broadcast is handled via Redis Pub/Sub in index.js
  });
}

module.exports = { register };
