'use strict';
const GAMES = require('../games');
const { sanitize } = require('../utils/helpers');
const { _adminData } = require('./auth');

/** Registers: admin_kick, admin_reset_rankings, admin_clear_chat, admin_broadcast, admin_refresh */
function register(router, ctx) {
  const { clients, bc, chatSvc, rankSvc, adminSvc } = ctx;

  const guard = (ws) => {
    const info = clients.get(ws);
    return info?.isAdmin;
  };

  router.on('admin_kick', async (ws, msg) => {
    if (!guard(ws)) return;
    const reason = sanitize(msg.reason) || '관리자 강퇴';
    for (const [w, c] of clients) {
      if (c.username === msg.username) {
        bc.send(w, { type: 'kicked', reason });
        setTimeout(() => w.close(), 500);
      }
    }
    const info = clients.get(ws);
    await adminSvc.log('kick', info.username, { target: msg.username, reason });
    bc.send(ws, { type: 'admin_ok', data: await _adminData(ctx) });
  });

  router.on('admin_reset_rankings', async (ws, msg) => {
    if (!guard(ws)) return;
    const gid = msg.gameId;
    if (gid) {
      await rankSvc.resetGame(gid);
    } else {
      for (const id of Object.keys(GAMES)) await rankSvc.resetGame(id);
    }
    const all = {};
    for (const id of Object.keys(GAMES)) all[id] = await rankSvc.getTop(id);
    bc.bcastAll({ type: 'rankings_all', data: all });
    const info = clients.get(ws);
    await adminSvc.log('reset_rankings', info.username, { gameId: gid || 'all' });
    bc.send(ws, { type: 'admin_ok', data: await _adminData(ctx) });
  });

  router.on('admin_clear_chat', async (ws) => {
    if (!guard(ws)) return;
    await chatSvc.clearAll();
    bc.bcastAll({ type: 'chat_cleared' });
    const info = clients.get(ws);
    await adminSvc.log('clear_chat', info.username);
    bc.send(ws, { type: 'admin_ok', data: await _adminData(ctx) });
  });

  router.on('admin_broadcast', async (ws, msg) => {
    if (!guard(ws)) return;
    const text = sanitize(msg.msg).trim();
    if (!text) return;
    bc.bcastAll({ type: 'chat', username: '📢', msg: text, ts: new Date().toISOString(), room: 'all', system: true });
  });

  router.on('admin_refresh', async (ws) => {
    if (!guard(ws)) return;
    bc.send(ws, { type: 'admin_ok', data: await _adminData(ctx) });
  });
}

module.exports = { register };
