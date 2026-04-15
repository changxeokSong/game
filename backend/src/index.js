'use strict';
const { PORT, TICK_MS }   = require('./config');
const { createBroadcast } = require('./utils/broadcast');

const UserService    = require('./services/UserService');
const ChatService    = require('./services/ChatService');
const RankingService = require('./services/RankingService');
const AdminService   = require('./services/AdminService');
const RoomManager    = require('./rooms/RoomManager');
const Router         = require('./ws/Router');
const WSServer       = require('./ws/WSServer');

const authHandler  = require('./handlers/auth');
const chatHandler  = require('./handlers/chat');
const gameHandler  = require('./handlers/game');
const adminHandler = require('./handlers/admin');

async function main() {
  // ── Shared state ──────────────────────────────────────────
  const clients = new Map();  // ws → { username, room, isAdmin, ip, joinedAt }

  // ── Services ──────────────────────────────────────────────
  const userSvc  = UserService;
  const chatSvc  = ChatService;
  const rankSvc  = RankingService;
  const adminSvc = AdminService;

  // ── Broadcast helpers (bound to clients map) ──────────────
  const bc = createBroadcast(clients);

  // ── Room manager ──────────────────────────────────────────
  const rooms = new RoomManager({ clients, broadcast: bc, rankingService: rankSvc, tickMs: TICK_MS });

  // ── Application context (injected into all handlers) ──────
  const ctx = { clients, bc, rooms, userSvc, chatSvc, rankSvc, adminSvc };

  // ── Message router ────────────────────────────────────────
  const router = new Router();
  authHandler.register(router, ctx);
  chatHandler.register(router, ctx);
  gameHandler.register(router, ctx);
  adminHandler.register(router, ctx);

  // ── WS server ─────────────────────────────────────────────
  const server = new WSServer({ port: PORT, router, clients, broadcast: bc });
  server.setContext(ctx);
  await server.listen();

  // ── Pub/Sub for Server Scale ──────────────────────────────
  const { sub } = require('./db/redis');
  sub.subscribe('chat_global', (err) => {
    if (err) console.error('[PubSub] Failed to subscribe', err);
  });
  sub.on('message', (channel, message) => {
    if (channel === 'chat_global') {
      const parsed = JSON.parse(message);
      // Broadcast this message locally to all connected clients in the same room.
      if (parsed.room === 'lobby') {
        bc.bcastLobby({ type: 'chat', ...parsed });
      } else {
        bc.bcastRoom(parsed.room, { type: 'chat', ...parsed });
      }
    }
  });

  console.log(`[App] ready  (TICK=${Math.round(1000 / TICK_MS)}fps)`);
}

main().catch(err => { console.error('[App] fatal:', err); process.exit(1); });
