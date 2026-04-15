'use strict';
const http      = require('http');
const WebSocket = require('ws');
const { now }   = require('../utils/helpers');

/**
 * WebSocket server.
 * Upgrades only requests to path /ws.
 * Delegates message dispatching to the provided Router.
 */
class WSServer {
  constructor({ port, router, clients, broadcast }) {
    this.port      = port;
    this.router    = router;
    this.clients   = clients;
    this.bc        = broadcast;

    this._http = http.createServer((req, res) => {
      if (req.url === '/health') { res.writeHead(200); res.end('OK'); return; }
      res.writeHead(404); res.end('Not found');
    });

    this._wss = new WebSocket.Server({ noServer: true });
    this._ctx = null;   // set via setContext()

    this._http.on('upgrade', (req, socket, head) => {
      if (req.url !== '/ws') { socket.destroy(); return; }
      this._wss.handleUpgrade(req, socket, head, ws => {
        this._wss.emit('connection', ws, req);
      });
    });

    this._wss.on('connection', (ws, req) => this._onConnect(ws, req));
  }

  /** Pass the full app context to handlers. */
  setContext(ctx) { this._ctx = ctx; }

  listen() {
    return new Promise(resolve => this._http.listen(this.port, () => {
      console.log(`[WS] listening on :${this.port}`);
      resolve();
    }));
  }

  // ── Private ────────────────────────────────────────────────

  _onConnect(ws, req) {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    this.clients.set(ws, { username: null, room: 'lobby', isAdmin: false, ip, joinedAt: now() });

    ws.on('message', async raw => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      // 1. Rate Limit check: Only for "expensive/global" actions like Chat or Admin commands
      const shouldLimit = msg.type === 'chat' || (msg.type && msg.type.startsWith('admin_'));
      if (shouldLimit) {
        const isAllowed = await require('./RateLimitMiddleware').rateLimit(ip, 50, 1);
        if (!isAllowed) return; // Drop spammy global actions
      }

      await this.router.dispatch(ws, msg, this._ctx);
    });

    ws.on('close', () => this._onDisconnect(ws));
    ws.on('error', err => console.error('[WS] client error:', err.message));
  }

  _onDisconnect(ws) {
    const info = this.clients.get(ws);
    if (info?.username) {
      this._ctx.rooms.leave(ws);
      this.bc.bcastLobby({
        type: 'chat', username: '🔔',
        msg: `${info.username}님이 나갔습니다.`,
        ts: now(), room: 'lobby', system: true,
      });
      this._pushUserList();
    }
    this.clients.delete(ws);
  }

  _pushUserList() {
    const list = [...this.clients.values()]
      .filter(c => c.username)
      .map(c => ({ username: c.username, room: c.room, joinedAt: c.joinedAt }));
    this.bc.bcastAll({ type: 'user_list', users: list });
  }
}

module.exports = WSServer;
