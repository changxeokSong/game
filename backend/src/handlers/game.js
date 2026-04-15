'use strict';
const { _pushUserList } = require('./auth');

/** Registers: join_game, leave_game, game_move, game_restart */
function register(router, ctx) {
  const { clients, bc, rooms } = ctx;

  router.on('join_game', async (ws, msg) => {
    const info = clients.get(ws);
    if (!info?.username) return;
    rooms.join(ws, msg.gameId);
    _pushUserList(clients, bc);
  });

  router.on('leave_game', (ws) => {
    rooms.leave(ws);
    _pushUserList(clients, bc);
    bc.send(clients.get(ws) ? ws : ws, { type: 'left_game' });
  });

  router.on('game_move', (ws, msg) => {
    rooms.move(ws, msg.x, msg.y);
  });

  router.on('game_restart', (ws) => {
    rooms.restart(ws);
  });
}

module.exports = { register };
