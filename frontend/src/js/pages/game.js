import '/js/viewport.js';
import { WSClient } from '../ws.js';
import { session } from '../utils.js';
import { Chat } from '../components/Chat.js';

const username = session.get('username');
if (!username) location.replace('/');

const params = new URLSearchParams(location.search);
const gameId = params.get('id') || session.get('gameId') || 'air-hockey';
const roomId = params.get('roomId');

const ws   = new WSClient();
const chat = new Chat('chat-msgs', 'chat-inp', ws);

// ── Canvas setup ──────────────────────────────────────────
// Fixed logical resolution — NEVER changes regardless of window size.
const GAME_W = 272;
const GAME_H = 480;

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

canvas.width  = GAME_W;
canvas.height = GAME_H;

// CSS makes the canvas display at a fixed pixel size; JS coords always use GAME_W/H.
// No _scale needed for input — we use getBoundingClientRect to map screen → game coords.

// ── State ─────────────────────────────────────────────────
let playerIdx   = -1;
let state       = null;
let gamePhase   = 'connecting';  // 'connecting' | 'waiting' | 'playing' | 'goal' | 'finished'
let playerNames = ['P1', 'P2'];

// Constants mirroring backend (for rendering only)
const AH  = { PR: 14, PAR: 28, GW: 120, GX: (272 - 120) / 2 };
const PG  = { BR: 10, PW: 72, PH: 12 };

// ── DOM refs ──────────────────────────────────────────────
const badgeEl = document.getElementById('status-badge');
const ovEl    = document.getElementById('overlay');
const ovTitle = document.getElementById('ov-title');
const ovSub   = document.getElementById('ov-sub');
const ovBtn   = document.getElementById('ov-btn');

// ── WebSocket init ────────────────────────────────────────
async function init() {
  try {
    await ws.connect();

    ws.on('login_ok', () => {
      ws.send({ type: 'join_game', gameId: roomId ? { roomId } : gameId });
    });

    ws.on('game_init', m => {
      playerIdx   = m.playerIdx;
      const isSpectator = !!m.isSpectator;
      state       = m.state;
      gamePhase   = 'waiting';
      badgeEl.textContent = isSpectator ? 'WATCHING' : 'WAITING';

      if (m.playerNames) {
        m.playerNames.forEach((n, i) => setPlayerName(i, n));
      } else if (!isSpectator) {
        setPlayerName(playerIdx, username);
      }
    });

    ws.on('game_start', m => {
      state     = m.state;
      gamePhase = 'playing';
      hideOverlay();
      badgeEl.textContent = playerIdx === -1 ? 'WATCHING' : 'PLAYING';
      // Server may now send playerNames on game_start too
      if (m.playerNames) m.playerNames.forEach((n, i) => setPlayerName(i, n));
    });

    ws.on('game_state', m => {
      if (state) Object.assign(state, m.state);
    });

    ws.on('game_goal', m => {
      if (state) state.scores = m.scores;
      updateScore();
      gamePhase = 'goal';

      if (m.tie) {
        showOverlay('🤝 TIE!', '동시에 충돌!', 'var(--sub)', false);
      } else {
        const iMine = m.scorer === playerIdx;
        showOverlay(
          iMine ? '⚡ GOAL!' : '😬 GOAL!',
          iMine ? '득점!'   : '실점…',
          iMine ? 'var(--red)' : 'var(--teal)',
          false,
        );
      }
    });

    ws.on('game_resume', m => {
      if (state) Object.assign(state, m.state);
      gamePhase = 'playing';
      hideOverlay();
    });

    ws.on('game_finished', m => {
      if (state) state.scores = m.scores;
      updateScore();
      gamePhase = 'finished';
      const won = m.winner === playerIdx;
      showOverlay(
        won ? '🏆 WIN!' : '💔 LOSE',
        `Score: ${m.scores[0]} : ${m.scores[1]}`,
        won ? 'var(--gold)' : 'var(--sub)',
        true,
      );
      badgeEl.textContent = won ? 'VICTORY' : 'DEFEAT';
    });

    ws.on('opponent_left', () => {
      gamePhase = 'waiting';
      state     = null;
      badgeEl.textContent = 'WAITING';
      showOverlay('😢 LEFT', '상대방이 나갔습니다', 'var(--sub)', false);
    });

    ws.on('left_game', () => {
      location.href = '/lobby';
    });

    ws.on('chat', m => chat.append(m));

    ws.on('user_list', m => {
      // Update the opponent's display name when we see them in the user list
      if (playerIdx === -1) return; // spectators skip this
      m.users.forEach(u => {
        if (u.username !== username) {
          setPlayerName(1 - playerIdx, u.username);
        }
      });
    });

    const fromGame = session.get('fromGame');
    session.del('fromGame');
    ws.send({
      type: 'login', username,
      context: 'game', gameId, fromGame,
      silent: !!session.get('adminToken'),
    });

  } catch (err) {
    console.error('WS Error:', err);
  }
}

function setPlayerName(idx, name) {
  if (idx < 0 || !name) return;
  playerNames[idx] = name;
  const el = document.getElementById(`name${idx}`);
  if (el) el.textContent = name;
}

// ── Score display ─────────────────────────────────────────
// The HTML always shows name0/sc0 on the LEFT and name1/sc1 on the RIGHT.
// The server always uses scores[0] = P0's score, scores[1] = P1's score.
// We just display them directly — no flipping needed.
function updateScore() {
  if (!state) return;
  const s0El = document.getElementById('sc0');
  const s1El = document.getElementById('sc1');
  if (s0El) s0El.textContent = state.scores[0];
  if (s1El) s1El.textContent = state.scores[1];
}

function showOverlay(title, sub, color, withBtn) {
  ovTitle.textContent    = title;
  ovTitle.style.color    = color;
  ovSub.textContent      = sub;
  ovBtn.style.display    = withBtn ? 'inline-flex' : 'none';
  ovEl.classList.add('show');
}
function hideOverlay() { ovEl.classList.remove('show'); }

window.requestRestart = () => ws.send({ type: 'game_restart' });
window.goLobby = () => {
  session.set('fromGame', true);
  ws.send({ type: 'leave_game' });
};

// ── Input — map screen coords to game coords ───────────────
/**
 * Convert a screen coordinate (clientX, clientY) to the game's logical
 * coordinate space (0..GAME_W, 0..GAME_H), then apply perspective flip
 * for P0 who sees the board rotated 180°.
 */
function screenToGame(clientX, clientY) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = GAME_W / rect.width;
  const scaleY = GAME_H / rect.height;
  let x = (clientX - rect.left)  * scaleX;
  let y = (clientY - rect.top)   * scaleY;

  // P0 sees a 180°-rotated view → flip inputs back to global coords
  if (playerIdx === 0) {
    x = GAME_W - x;
    y = GAME_H - y;
  }
  return { x, y };
}

function sendMove(clientX, clientY) {
  if (gamePhase !== 'playing') return;
  if (playerIdx === -1) return; // spectators can't move
  const { x, y } = screenToGame(clientX, clientY);
  ws.send({ type: 'game_move', x, y });
}

// Mouse — used by all games except Tron (which only uses taps/clicks)
canvas.addEventListener('mousemove', e => {
  if (gameId === 'tron') return;
  sendMove(e.clientX, e.clientY);
});

canvas.addEventListener('mousedown', e => {
  // Tron: direction change on click
  if (gameId === 'tron') sendMove(e.clientX, e.clientY);
});

// Touch — primary input on mobile
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (gameId === 'tron') return; // Tron only uses touchstart
  sendMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  // All games respond to initial touch press
  sendMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

// ── Keyboard (desktop convenience) ───────────────────────
const _keyCurrent = { x: GAME_W / 2, y: GAME_H / 2 };
window.addEventListener('keydown', e => {
  if (gamePhase !== 'playing' || playerIdx === -1) return;
  const key = e.key.toLowerCase();

  // Horizontal
  if (key === 'arrowleft'  || key === 'a') _keyCurrent.x  = GAME_W * 0.1;
  if (key === 'arrowright' || key === 'd') _keyCurrent.x  = GAME_W * 0.9;

  // Action key — trigger jump / fire toward opponent side
  if (key === ' ' || key === 'arrowup' || key === 'w') {
    // We want to send a coordinate in the opponent's half to trigger jump/fire.
    // In global coords: opponent of P0 is at y≈H*0.75, opponent of P1 is at y≈H*0.25
    // But we send from this player's perspective and let sendMove do the flip.
    // After flip: for P0 (isFlipped), we want global y>H/2 → local y<H/2 → tap local top → y=0
    //             for P1 (not flipped), we want global y<H/2 → local y<H/2 → y=0
    _keyCurrent.y = 0; // tapping "top" in local view = opponent's side after flip for P0, and directly for P1
  }
  if (key === 'arrowdown' || key === 's') {
    _keyCurrent.y = GAME_H; // move to bottom in local view
  }

  // Convert from game coords (already in local player perspective) to screen coords
  // We'll skip the flip here — instead, directly build global coords before sending.
  let globalX = _keyCurrent.x;
  let globalY = _keyCurrent.y;
  if (playerIdx === 0) {
    globalX = GAME_W - _keyCurrent.x;
    globalY = GAME_H - _keyCurrent.y;
  }
  ws.send({ type: 'game_move', x: globalX, y: globalY });
});

window.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a' || key === 'arrowright' || key === 'd') {
    _keyCurrent.x = GAME_W / 2;
  }
  if (key === ' ' || key === 'arrowup' || key === 'w' || key === 'arrowdown' || key === 's') {
    _keyCurrent.y = GAME_H / 2;
  }
});

// ── Rendering ─────────────────────────────────────────────
const RENDERERS = {
  'air-hockey':  drawAirHockey,
  'pong':        drawPong,
  'tron':        drawTron,
  'tanks':       drawTanks,
  'volley':      drawSlimeVolley,
  'breakers':    drawBreakers,
};

function draw() {
  requestAnimationFrame(draw);

  const isFlipped = playerIdx === 0;
  const isActive  = state && (gamePhase === 'playing' || gamePhase === 'goal' || gamePhase === 'finished');

  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  if (!isActive) { drawWaiting(); return; }

  ctx.save();
  if (isFlipped) {
    ctx.translate(GAME_W, GAME_H);
    ctx.rotate(Math.PI);
  }

  const render = RENDERERS[gameId] || drawPong;
  render(state);

  ctx.restore();
}

// ── Per-game renderers ────────────────────────────────────

function drawAirHockey(s) {
  const W = GAME_W, H = GAME_H;
  // Center line
  ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
  // Goals
  ctx.strokeStyle = '#ff5555'; ctx.lineWidth = 3; ctx.strokeRect(AH.GX, 0,     AH.GW, 6);
  ctx.strokeStyle = '#44ddcc';                    ctx.strokeRect(AH.GX, H - 6, AH.GW, 6);
  // Paddles
  drawCircle(s.paddles[0].x, s.paddles[0].y, AH.PAR, '#ff5555', true);
  drawCircle(s.paddles[1].x, s.paddles[1].y, AH.PAR, '#44ddcc', true);
  // Puck
  drawCircle(s.puck.x, s.puck.y, AH.PR, '#fff', true);
}

function drawPong(s) {
  const W = GAME_W, H = GAME_H;
  ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
  drawRect(s.paddles[0].x - PG.PW / 2, s.paddles[0].y - PG.PH / 2, PG.PW, PG.PH, '#ff5555', true);
  drawRect(s.paddles[1].x - PG.PW / 2, s.paddles[1].y - PG.PH / 2, PG.PW, PG.PH, '#44ddcc', true);
  drawCircle(s.puck.x, s.puck.y, PG.BR, '#fff', true);
}

function drawSlimeVolley(s) {
  const W = GAME_W, H = GAME_H;
  // Net at center
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(W / 2 - 40, H / 2); ctx.lineTo(W / 2 + 40, H / 2); ctx.stroke();

  // Ball
  drawCircle(s.ball.x, s.ball.y, 12, '#fff', true);

  // Slimes
  s.slimes.forEach((sl, idx) => {
    ctx.save();
    ctx.fillStyle   = sl.color;
    ctx.shadowBlur  = 20;
    ctx.shadowColor = sl.color;
    ctx.beginPath();
    const isTop      = idx === 0;
    // P0 top slime: semicircle opening downward  (π → 0, anticlockwise = false)
    // P1 bot slime: semicircle opening upward    (0 → π, anticlockwise = false)
    if (isTop) {
      ctx.arc(sl.x, sl.y, 30, Math.PI, 0, false); // bottom semicircle
    } else {
      ctx.arc(sl.x, sl.y, 30, 0, Math.PI, false);  // top semicircle
    }
    ctx.closePath();
    ctx.fill();
    // Eye
    const eyeOffsetX = 10;
    const eyeOffsetY = isTop ?  8 : -8;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sl.x + eyeOffsetX, sl.y + eyeOffsetY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawBreakers(s) {
  const W = GAME_W, H = GAME_H;
  ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

  // Bricks
  s.bricks.forEach(b => {
    if (!b.active) return;
    drawRect(b.x + 2, b.y + 2, 36, 11, b.color, true);
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 2, b.y + 2, 36, 11);
  });

  // Paddles
  drawRect(s.paddles[0].x - 36, s.paddles[0].y - 6, 72, 12, '#ff5555', true);
  drawRect(s.paddles[1].x - 36, s.paddles[1].y - 6, 72, 12, '#44ddcc', true);
  // Ball
  drawCircle(s.puck.x, s.puck.y, 8, '#fff', true);
}

function drawTanks(s) {
  const W = GAME_W, H = GAME_H;
  ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

  // Bullets with trail
  s.bullets.forEach(b => {
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 3, b.y - b.vy * 3); ctx.stroke();
    drawCircle(b.x, b.y, 4, '#fff', true);
  });

  // Tanks
  s.tanks.forEach((t, idx) => {
    ctx.save();
    ctx.translate(t.x, t.y);
    const isTop = idx === 0;
    // Body
    drawRect(-18, -18, 36, 36, t.color, true);
    // Turret (points toward opponent's half)
    drawRect(-4, isTop ? 0 : -25, 8, 25, 'rgba(255,255,255,0.9)', false);
    // HP bar
    const hpFrac = t.hp / 3;
    const barY   = isTop ? -28 : 22;
    ctx.fillStyle = '#222'; ctx.fillRect(-16, barY, 32, 4);
    ctx.fillStyle = t.color; ctx.fillRect(-16, barY, 32 * hpFrac, 4);
    ctx.restore();
  });
}

function drawTron(s) {
  const W = GAME_W, H = GAME_H;
  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,.025)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  s.players.forEach(p => {
    if (p.trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth   = 3;
      ctx.shadowBlur  = 12;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.moveTo(p.trail[0].x, p.trail[0].y);
      for (let i = 1; i < p.trail.length; i++) {
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
      }
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
    }
    // Head
    drawCircle(p.x, p.y, 8, p.color, true);
    drawCircle(p.x, p.y, 4, '#fff',   false);
  });
}

// ── Shared drawing helpers ─────────────────────────────────
function drawCircle(x, y, r, color, glow = false) {
  ctx.save();
  if (glow) { ctx.shadowBlur = 18; ctx.shadowColor = color; }
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawRect(x, y, w, h, color, glow = false) {
  ctx.save();
  if (glow) { ctx.shadowBlur = 18; ctx.shadowColor = color; }
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

const HINTS = {
  'air-hockey': 'MOUSE / DRAG  TO HIT PUCK',
  'pong':       'MOUSE / DRAG  TO MOVE PADDLE',
  'tron':       'PC: CLICK SIDES  |  MOBILE: TAP SIDES',
  'tanks':      'PC: WASD + SPACE  |  MOBILE: DRAG + TAP FAR SIDE',
  'volley':     'PC: A D SPACE  |  MOBILE: DRAG + TAP FAR SIDE',
  'breakers':   'MOUSE / DRAG  TO BOUNCE BALL',
};

function drawWaiting() {
  ctx.fillStyle = '#333';
  ctx.font      = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('WAITING FOR OPPONENT…', GAME_W / 2, GAME_H / 2 - 14);

  const hint = HINTS[gameId] || '';
  if (hint) {
    ctx.fillStyle = 'rgba(0,212,255,0.4)';
    ctx.fillRect(10, GAME_H - 42, GAME_W - 20, 28);
    ctx.fillStyle = 'rgba(0,212,255,0.9)';
    ctx.font      = 'bold 9px monospace';
    ctx.fillText(hint, GAME_W / 2, GAME_H - 24);
  }
}

init();
draw();
