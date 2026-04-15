'use strict';
const GAMES = require('../games');

/**
 * Manages game rooms — creation, player lifecycle, physics loops.
 * Injected dependencies: clients Map, broadcast helpers, ranking service.
 */
class RoomManager {
  constructor({ clients, broadcast, rankingService, tickMs }) {
    this.clients  = clients;
    this.bc       = broadcast;
    this.rankSvc  = rankingService;
    this.tickMs   = tickMs;
    this.rooms    = new Map();
    this._seq     = 0;
  }

  // ── Public API ────────────────────────────────────────────

  join(ws, gameId) {
    if (!GAMES[gameId]) return;
    this.leave(ws);                          // leave current room first
    let room = this._findWaiting(gameId) || this._create(gameId);
    const idx = room.players.length;
    room.players.push(ws);
    this.clients.get(ws).room = room.id;

    this.bc.send(ws, {
      type: 'game_init', playerIdx: idx, gameId,
      state: room.state, gameW: GAMES[gameId].W, gameH: GAMES[gameId].H,
    });

    if (room.players.length === 2) {
      GAMES[gameId].launch(room.state);
      room.state.phase = 'playing';
      this.bc.bcastRoom(room.id, { type: 'game_start', state: room.state });
      this._startLoop(room);
    }
  }

  leave(ws) {
    const info = this.clients.get(ws);
    if (!info || info.room === 'lobby') return;
    const room = this.rooms.get(info.room);
    if (room) {
      this._stopLoop(room);
      room.players = room.players.filter(p => p !== ws);
      this.bc.bcastRoom(room.id, { type: 'opponent_left' });
      if (room.players.length === 0) this.rooms.delete(room.id);
      else room.state = GAMES[room.gameId].createState();
    }
    info.room = 'lobby';
  }

  move(ws, x, y) {
    const info = this.clients.get(ws);
    const room = info && this.rooms.get(info.room);
    if (!room) return;
    const idx = room.players.indexOf(ws);
    if (idx !== -1) GAMES[room.gameId].move(room.state, idx, x, y);
  }

  restart(ws) {
    const info = this.clients.get(ws);
    const room = info && this.rooms.get(info.room);
    if (!room || room.state.phase !== 'finished') return;
    const g    = GAMES[room.gameId];
    room.state = g.createState();
    g.launch(room.state);
    room.state.phase = 'playing';
    this.bc.bcastRoom(room.id, { type: 'game_start', state: room.state });
    this._startLoop(room);
  }

  list() {
    return [...this.rooms.values()].map(r => ({
      id: r.id, gameId: r.gameId,
      players: r.players.length, phase: r.state.phase, scores: r.state.scores,
    }));
  }

  // ── Private ───────────────────────────────────────────────

  _create(gameId) {
    const id   = `${gameId}:${++this._seq}`;
    const room = { id, gameId, players: [], state: GAMES[gameId].createState(), loop: null };
    this.rooms.set(id, room);
    return room;
  }

  _findWaiting(gameId) {
    for (const r of this.rooms.values())
      if (r.gameId === gameId && r.players.length < 2) return r;
    return null;
  }

  _startLoop(room) {
    if (room.loop) return;
    const g = GAMES[room.gameId];
    room.loop = setInterval(() => {
      if (room.players.length < 2) return;
      const scorer = g.tick(room.state);
      if (scorer !== null) { this._handleGoal(room, scorer); return; }
      this.bc.bcastRoom(room.id, { type: 'game_state', state: room.state });
    }, this.tickMs);
  }

  _stopLoop(room) {
    if (room.loop) { clearInterval(room.loop); room.loop = null; }
  }

  _handleGoal(room, scorer) {
    this._stopLoop(room);
    const g = GAMES[room.gameId];
    room.state.scores[scorer]++;
    room.state.phase = 'goal';
    this.bc.bcastRoom(room.id, { type: 'game_goal', scorer, scores: room.state.scores });

    if (room.state.scores[scorer] >= g.win) {
      room.state.phase  = 'finished';
      room.state.winner = scorer;
      this.bc.bcastRoom(room.id, { type: 'game_finished', winner: scorer, scores: room.state.scores });
      room.players.forEach((ws, i) => {
        const info = this.clients.get(ws);
        if (info?.username) this.rankSvc.recordResult(info.username, room.gameId, i === scorer ? 'win' : 'loss');
      });
      this._pushAllRankings();
      return;
    }

    setTimeout(() => {
      if (room.players.length < 2) return;
      g.launch(room.state);
      room.state.phase = 'playing';
      this.bc.bcastRoom(room.id, { type: 'game_resume', state: room.state });
      this._startLoop(room);
    }, 2000);
  }

  async _pushAllRankings() {
    const all = {};
    for (const gid of Object.keys(GAMES))
      all[gid] = await this.rankSvc.getTop(gid);
    this.bc.bcastAll({ type: 'rankings_all', data: all });
  }
}

module.exports = RoomManager;
