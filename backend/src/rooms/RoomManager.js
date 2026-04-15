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
    const info = this.clients.get(ws);
    if (!info) return;

    // Resolve spectate-by-roomId case
    if (typeof gameId === 'object') {
      const room = this.rooms.get(gameId.roomId);
      if (!room) return;
      if (room.players.length >= 2) {
        return this._spectate(ws, room.id);
      }
      gameId = room.gameId;
    }

    if (!GAMES[gameId]) return;

    // Leave current room first (safe — will not re-enter)
    this.leave(ws);

    const room = this._findWaiting(gameId) || this._create(gameId);
    if (!room) return;

    // Full room → spectate instead
    if (room.players.length >= 2) {
      return this._spectate(ws, room.id);
    }

    const idx = room.players.length;
    room.players.push(ws);
    this.clients.get(ws).room = room.id;

    this.bc.send(ws, {
      type: 'game_init', playerIdx: idx, gameId,
      state: room.state,
      gameW: GAMES[gameId].W, gameH: GAMES[gameId].H,
      playerNames: room.players.map(p => this.clients.get(p)?.username || 'Unknown'),
    });

    if (room.players.length === 2) {
      this._startGame(room);
    }

    this._pushRoomList();
  }

  leave(ws) {
    const info = this.clients.get(ws);
    if (!info || info.room === 'lobby') return;
    const room = this.rooms.get(info.room);
    if (room) {
      if (room.players.includes(ws)) {
        this._stopLoop(room);
        room.players = room.players.filter(p => p !== ws);

        if (room.players.length === 0 && room.spectators.length === 0) {
          // Empty room — delete
          this.rooms.delete(room.id);
        } else if (room.players.length === 0) {
          // Only spectators remain — reset state and notify
          room.state = GAMES[room.gameId].createState();
          this.bc.bcastRoom(room.id, { type: 'opponent_left' });
        } else {
          // 1 player remains — reset state to waiting, notify everyone
          room.state = GAMES[room.gameId].createState();
          this.bc.bcastRoom(room.id, { type: 'opponent_left' });
        }
      } else {
        // Spectator leaving
        room.spectators = room.spectators.filter(p => p !== ws);
        if (room.players.length === 0 && room.spectators.length === 0) {
          this.rooms.delete(room.id);
        }
      }
    }
    info.room = 'lobby';
    this._pushRoomList();
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
    if (room.players.length < 2) return;
    this._startGame(room);
  }

  list() {
    return [...this.rooms.values()].map(r => ({
      id: r.id, gameId: r.gameId,
      players:     r.players.length,
      playerNames: r.players.map(p => this.clients.get(p)?.username || 'Unknown'),
      spectators:  r.spectators.length,
      phase:       r.state.phase, scores: r.state.scores,
    }));
  }

  // ── Private ───────────────────────────────────────────────

  _create(gameId) {
    const id   = `${gameId}:${++this._seq}`;
    const room = {
      id, gameId, players: [], spectators: [],
      state: GAMES[gameId].createState(), loop: null,
    };
    this.rooms.set(id, room);
    return room;
  }

  _findWaiting(gameId) {
    for (const r of this.rooms.values()) {
      if (r.gameId === gameId && r.players.length < 2 && r.state.phase === 'waiting') return r;
    }
    return null;
  }

  /** Separate method to avoid re-entrant leave() inside spectate */
  _spectate(ws, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Leave current room if not already done
    const info = this.clients.get(ws);
    if (!info) return;
    if (info.room !== 'lobby') this.leave(ws);

    room.spectators.push(ws);
    info.room = room.id;

    this.bc.send(ws, {
      type: 'game_init', playerIdx: -1, gameId: room.gameId, isSpectator: true,
      state: room.state,
      gameW: GAMES[room.gameId].W, gameH: GAMES[room.gameId].H,
      playerNames: room.players.map(p => this.clients.get(p)?.username || 'Unknown'),
    });

    const name = this.clients.get(ws)?.username || '?';
    this.bc.bcastRoom(room.id, {
      type: 'chat', username: '🔔',
      msg: `${name}님이 관전을 시작했습니다.`,
      ts: Date.now(), system: true,
    });
    this._pushRoomList();
  }

  _startGame(room) {
    this._stopLoop(room); // ensure no duplicate loops
    const g    = GAMES[room.gameId];
    room.state = g.createState();
    g.launch(room.state);
    room.state.phase = 'playing';
    this.bc.bcastRoom(room.id, {
      type: 'game_start', state: room.state,
      playerNames: room.players.map(p => this.clients.get(p)?.username || 'Unknown'),
    });
    this._startLoop(room);
  }

  _startLoop(room) {
    if (room.loop) return; // already running
    const g = GAMES[room.gameId];
    room.loop = setInterval(() => {
      if (room.players.length < 2) { this._stopLoop(room); return; }
      const scorer = g.tick(room.state);
      if (scorer === null) {
        this.bc.bcastRoom(room.id, { type: 'game_state', state: room.state });
        return;
      }
      // scorer === -1 means tie (e.g. Tron simultaneous death)
      if (scorer === -1) {
        this._handleTie(room);
      } else {
        this._handleGoal(room, scorer);
      }
    }, this.tickMs);
  }

  _stopLoop(room) {
    if (room.loop) { clearInterval(room.loop); room.loop = null; }
  }

  _handleTie(room) {
    this._stopLoop(room);
    room.state.phase = 'goal';
    this.bc.bcastRoom(room.id, { type: 'game_goal', scorer: -1, scores: room.state.scores, tie: true });
    setTimeout(() => {
      if (room.players.length < 2) return;
      const g = GAMES[room.gameId];
      g.launch(room.state);
      room.state.phase = 'playing';
      this.bc.bcastRoom(room.id, { type: 'game_resume', state: room.state });
      this._startLoop(room);
      this._pushRoomList();
    }, 2000);
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
      // Record ranked results
      room.players.forEach((ws, i) => {
        const info = this.clients.get(ws);
        if (info?.username) this.rankSvc.recordResult(info.username, room.gameId, i === scorer ? 'win' : 'loss');
      });
      this._pushAllRankings();
      this._pushRoomList();
      return;
    }

    setTimeout(() => {
      if (room.players.length < 2) return;
      g.launch(room.state);
      room.state.phase = 'playing';
      this.bc.bcastRoom(room.id, { type: 'game_resume', state: room.state });
      this._startLoop(room);
      this._pushRoomList();
    }, 2000);
  }

  async _pushAllRankings() {
    const all = {};
    for (const gid of Object.keys(GAMES)) all[gid] = await this.rankSvc.getTop(gid);
    this.bc.bcastAll({ type: 'rankings_all', data: all });
  }

  _pushRoomList() {
    this.bc.bcastLobby({ type: 'room_list', rooms: this.list() });
  }
}

module.exports = RoomManager;
