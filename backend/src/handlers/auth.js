'use strict';
const GAMES      = require('../games');
const { sanitize, now } = require('../utils/helpers');
const { ADMIN_CODE } = require('../config');

/** Registers: login, admin_auth, admin_auth_token */
function register(router, ctx) {
  const { clients, bc, userSvc, chatSvc, rankSvc, adminSvc } = ctx;

  // ── login ──────────────────────────────────────────────────
  router.on('login', async (ws, msg) => {
    const name = sanitize(msg.username).trim().slice(0, 20);
    if (!name) { bc.send(ws, { type: 'login_error', reason: '이름을 입력하세요.' }); return; }

    const dup = [...clients.values()].some(c => c.username === name && c !== clients.get(ws));
    if (dup) { bc.send(ws, { type: 'login_error', reason: '이미 접속 중인 닉네임입니다.' }); return; }

    const info = clients.get(ws);
    info.username = name;
    await userSvc.getOrCreate(name);
    await userSvc.touch(name);

    const [chatHistory, rankings] = await Promise.all([
      chatSvc.getRecent(60),
      _allRankings(rankSvc),
    ]);

    bc.send(ws, {
      type: 'login_ok', username: name, isAdmin: info.isAdmin,
      chatHistory, rankings,
      roomList: ctx.rooms.list(),
      games: Object.values(GAMES).map(g => ({ id: g.id, name: g.name, desc: g.desc, icon: g.icon })),
    });

    _pushUserList(clients, bc);
    if (!msg.silent) {
      let sysMsg = `${name}님이 입장했습니다.`;
      if (msg.context === 'game') {
        sysMsg = `${name}님이 ${msg.gameId || '게임'}방에 입장했습니다! 🎮`;
      } else if (msg.context === 'lobby' && msg.fromGame) {
        sysMsg = `${name}님이 게임을 마치고 로비로 복귀했습니다. 🏠`;
      }
      bc.bcastLobby({ type: 'chat', username: '🔔', msg: sysMsg, ts: now(), room: 'lobby', system: true });
    }
  });

  // ── admin_auth (easter egg) ────────────────────────────────
  router.on('admin_auth', async (ws, msg) => {
    if (msg.code !== ADMIN_CODE) { bc.send(ws, { type: 'admin_denied' }); return; }
    const info  = clients.get(ws);
    info.isAdmin = true;
    const token = await adminSvc.issueToken(info.username);
    await adminSvc.log('admin_login', info.username, { ip: info.ip });
    bc.send(ws, { type: 'admin_granted', token });
  });

  // ── admin_auth_token (admin page re-auth) ─────────────────
  router.on('admin_auth_token', async (ws, msg) => {
    const owner = await adminSvc.validateToken(msg.token);
    if (!owner) { bc.send(ws, { type: 'admin_denied' }); return; }
    const info   = clients.get(ws);
    info.isAdmin = true;
    const data   = await _adminData(ctx);
    bc.send(ws, { type: 'admin_ok', data });
  });
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

async function _allRankings(rankSvc) {
  const all = {};
  for (const gid of Object.keys(GAMES)) all[gid] = await rankSvc.getTop(gid);
  return all;
}

function _pushUserList(clients, bc) {
  const list = [...clients.values()]
    .filter(c => c.username)
    .map(c => ({ username: c.username, room: c.room, joinedAt: c.joinedAt }));
  bc.bcastAll({ type: 'user_list', users: list });
}

async function _adminData(ctx) {
  const { clients, rooms, chatSvc, rankSvc, adminSvc, userSvc } = ctx;
  const [chatHistory, adminLogs, rankings, dbUsers] = await Promise.all([
    chatSvc.getRecent(100),
    adminSvc.getLogs(50),
    _allRankings(rankSvc),
    userSvc.count(),
  ]);
  return {
    onlineUsers: [...clients.values()].map(c => ({ username: c.username, room: c.room, ip: c.ip, joinedAt: c.joinedAt, isAdmin: c.isAdmin })),
    rooms: rooms.list(),
    chatHistory, adminLogs, rankings, dbUsers,
  };
}

module.exports = { register, _adminData, _pushUserList };
