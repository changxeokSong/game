import '/js/viewport.js';
import { WSClient } from '../ws.js';
import { session } from '../utils.js';
import { Chat } from '../components/Chat.js';

const username = session.get('username');
if (!username) location.replace('/');

const params = new URLSearchParams(location.search);
const gameId = params.get('id') || session.get('gameId') || 'air-hockey';
const roomId = params.get('roomId');

const ws = new WSClient();
const chat = new Chat('chat-msgs', 'chat-inp', ws);

// ── Canvas setup ──────────────────────────────────────────
let GAME_W = 272, GAME_H = 480;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let _scale = 1;

canvas.width = GAME_W;
canvas.height = GAME_H;

function resize() {
  const container = document.getElementById('canvas-wrap');
  const rect = container.getBoundingClientRect();
  const scale = rect.width / GAME_W;
  _scale = scale;
}
window.addEventListener('resize', resize);
resize();

// ── State ─────────────────────────────────────────────────
let playerIdx = -1;
let state = null;
let gamePhase = 'connecting';
let playerNames = ['P1', 'P2'];

const AH = { PR: 14, PAR: 28, GW: 120, GX: (272 - 120) / 2 };
const PG = { BR: 10, PW: 72, PH: 12 };

// ── DOM Refs ──────────────────────────────────────────────
const badgeEl = document.getElementById('status-badge');
const ovEl = document.getElementById('overlay');
const ovTitle = document.getElementById('ov-title');
const ovSub = document.getElementById('ov-sub');
const ovBtn = document.getElementById('ov-btn');

async function init() {
  try {
    await ws.connect();

    ws.on('login_ok', () => {
      ws.send({ type: 'join_game', gameId: roomId ? { roomId } : gameId });
    });

    ws.on('game_init', m => {
      playerIdx = m.playerIdx;
      const isSpectator = !!m.isSpectator;
      state = m.state;
      gamePhase = 'waiting';
      badgeEl.textContent = isSpectator ? 'WATCHING' : 'WAITING';
      
      // Strict Fixed Resolution: 272x480
      canvas.width = GAME_W; 
      canvas.height = GAME_H; 
      
      resize(); // Update _scale based on screen

      if (isSpectator) {
        if (m.playerNames) {
          setPlayerName(0, m.playerNames[0]);
          setPlayerName(1, m.playerNames[1]);
        }
      } else {
        setPlayerName(playerIdx, username);
      }
    });

    ws.on('game_start', m => {
      state = m.state;
      gamePhase = 'playing';
      hideOverlay();
      badgeEl.textContent = playerIdx === -1 ? 'WATCHING' : 'PLAYING';
    });

    ws.on('game_state', m => {
      if (state) {
        // Sync everything instead of just puck/paddles
        Object.assign(state, m.state);
      }
    });

    ws.on('game_goal', m => {
      if (state) state.scores = m.scores;
      updateScore();
      const iMine = m.scorer === playerIdx;
      showOverlay(iMine ? '⚡ GOAL!' : '😬 GOAL!',
        iMine ? '득점!' : '실점…',
        iMine ? 'var(--red)' : 'var(--teal)', false);
    });

    ws.on('game_resume', m => {
      if (state) Object.assign(state, m.state);
      gamePhase = 'playing';
      hideOverlay();
    });

    ws.on('game_finished', m => {
      state.scores = m.scores;
      updateScore();
      gamePhase = 'finished';
      const won = m.winner === playerIdx;
      showOverlay(won ? '🏆 WIN!' : '💔 LOSE',
        `Score: ${m.scores[0]} : ${m.scores[1]}`,
        won ? 'var(--gold)' : 'var(--sub)', true);
      badgeEl.textContent = won ? 'VICTORY' : 'DEFEAT';
    });

    ws.on('opponent_left', () => {
      gamePhase = 'waiting';
      state = null;
      badgeEl.textContent = 'WAITING';
      showOverlay('😢 LEFT', '상대방이 나갔습니다', 'var(--sub)', false);
    });

    ws.on('left_game', () => {
      location.href = '/lobby';
    });

    ws.on('chat', m => {
      chat.append(m);
    });

    ws.on('user_list', m => {
      m.users.forEach(u => {
        if (playerIdx === -1) {
          // As spectator, update any named room slot
          if (u.room === roomId) {
            // Need a way to know which slot u is in. 
            // Better: use room_list for more precise name mapping globally?
            // For now, let's just let the server send player names in game_init or similar.
          }
        } else if (u.username !== username) {
          setPlayerName(1 - playerIdx, u.username);
        }
      });
    });

    const fromGame = session.get('fromGame');
    session.del('fromGame'); // Reset flag
    ws.send({ type: 'login', username, context: 'game', gameId, fromGame, silent: !!session.get('adminToken') });

  } catch (err) {
    console.error('WS Error:', err);
  }
}

function setPlayerName(idx, name) {
  if (idx < 0) return;
  playerNames[idx] = name;
  const el = document.getElementById(`name${idx}`);
  if (el) el.textContent = name;
}

function updateScore() {
  const isFlipped = playerIdx === 0;
  // If flipped, sc0 (me) is bottom, sc1 (opponent) is top
  document.getElementById(isFlipped ? 'sc1' : 'sc0').textContent = state.scores[0];
  document.getElementById(isFlipped ? 'sc0' : 'sc1').textContent = state.scores[1];
}

function showOverlay(title, sub, color, withBtn) {
  ovTitle.textContent = title;
  ovTitle.style.color = color;
  ovSub.textContent = sub;
  ovBtn.style.display = withBtn ? 'inline-flex' : 'none';
  ovEl.classList.add('show');
}
function hideOverlay() { ovEl.classList.remove('show'); }

window.requestRestart = () => {
  ws.send({ type: 'game_restart' });
};

window.goLobby = () => {
  session.set('fromGame', true);
  ws.send({ type: 'leave_game' });
};

// ── Input ─────────────────────────────────────────────────
function sendMove(cx, cy) {
  if (gamePhase !== 'playing') return;
  if (playerIdx === -1) return; // Spectators can't move
  const rect = canvas.getBoundingClientRect();
  let x = (cx - rect.left) / _scale;
  let y = (cy - rect.top) / _scale;

  // Universal relative view: If I am P0 (global Top), I am seeing a 180-deg rotated view
  // so I must flip my inputs back to the global top coordinates.
  if (playerIdx === 0) {
    x = GAME_W - x; 
    y = GAME_H - y;
  }

  ws.send({ type: 'game_move', x, y });
}

canvas.addEventListener('mousemove', e => {
  if (gameId === 'tron') return; // Tron only uses taps
  sendMove(e.clientX, e.clientY);
});
canvas.addEventListener('mousedown', e => {
  if (gameId === 'tron') sendMove(e.clientX, e.clientY);
});
canvas.addEventListener('touchmove', e => {
  if (gameId === 'tron') return; 
  e.preventDefault();
  sendMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
canvas.addEventListener('touchstart', e => {
  sendMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

// ── Keyboard Support (Desktop) ──────────────────────────
window.addEventListener('keydown', e => {
  if (gamePhase !== 'playing' || playerIdx === -1) return;
  const key = e.key.toLowerCase();
  
  // Current position simulation for keys
  let fakeX = GAME_W / 2;
  let fakeY = GAME_H / 2;
  
  // Left/Right movement simulations
  if (key === 'arrowleft' || key === 'a')  { fakeX = 0; }
  if (key === 'arrowright' || key === 'd') { fakeX = GAME_W; }
  
  // Action (Jump/Fire) simulations
  if (key === ' ' || key === 'arrowup' || key === 'w') {
    // For Slime Volley/Tanks, "tap" the far side relative to the player
    fakeY = (playerIdx === 0) ? GAME_H : 0; 
  }

  // Map to sendMove (which handles coordinate translation)
  // We use client coordinates simulation based on canvas position
  const rect = canvas.getBoundingClientRect();
  const screenX = rect.left + (fakeX * _scale);
  const screenY = rect.top + (fakeY * _scale);
  sendMove(screenX, screenY);
});

// ── Rendering ─────────────────────────────────────────────
const RENDERERS = {
  'air-hockey': drawAirHockey,
  'pong': drawPong,
  'tron': drawTron,
  'tanks': drawTanks,
  'volley': drawSlimeVolley,
  'breakers': drawBreakers,
};

function drawTanks(s) {
  const W = GAME_W, H = GAME_H;
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();

  // Bullets
  s.bullets.forEach(b => {
    drawCircle(b.x, b.y, 4, '#fff', true);
    // Bullet tail
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx*2, b.y - b.vy*2); ctx.stroke();
  });

  // Tanks
  s.tanks.forEach((t, idx) => {
    ctx.save();
    ctx.translate(t.x, t.y);
    const isTop = idx === 0;
    
    // Body
    drawRect(-18, -18, 36, 36, t.color, true);
    // Turret
    drawRect(-4, isTop ? 0 : -25, 8, 25, '#fff', true);
    
    // HP Bar
    const hpW = (t.hp / 3) * 30;
    ctx.fillStyle = '#333'; ctx.fillRect(-15, isTop ? -25 : 20, 30, 4);
    ctx.fillStyle = t.color; ctx.fillRect(-15, isTop ? -25 : 20, hpW, 4);
    
    ctx.restore();
  });
}

function drawSlimeVolley(s) {
  const W = GAME_W, H = GAME_H;
  // Net
  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(W/2 - 40, H/2); ctx.lineTo(W/2 + 40, H/2); ctx.stroke();

  // Ball
  drawCircle(s.ball.x, s.ball.y, 12, '#fff', true);

  // Slimes
  s.slimes.forEach((sl, idx) => {
    ctx.save();
    ctx.fillStyle = sl.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = sl.color;
    ctx.beginPath();
    // Semicircle (Slime)
    const isTop = idx === 0;
    const startAngle = isTop ? 0 : Math.PI;
    const endAngle = isTop ? Math.PI : 0;
    ctx.arc(sl.x, sl.y, 30, startAngle, endAngle, isTop);
    ctx.fill();
    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sl.x + (idx===0?1:-1)*10, sl.y + (idx===0?5:-5), 5, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });
}

function drawBreakers(s) {
  const W = GAME_W, H = GAME_H;
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();

  // Bricks
  s.bricks.forEach(b => {
    if (!b.active) return;
    drawRect(b.x + 2, b.y + 2, 36, 11, b.color, true);
    // Bevel effect
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 2, b.y + 2, 36, 11);
  });

  // Paddles
  drawRect(s.paddles[0].x - 36, s.paddles[0].y - 6, 72, 12, '#ff6b6b', true);
  drawRect(s.paddles[1].x - 36, s.paddles[1].y - 6, 72, 12, '#4ecdc4', true);
  // Ball
  drawCircle(s.puck.x, s.puck.y, 8, '#fff', true);
}

function drawTron(s) {
  const W = GAME_W, H = GAME_H;
  // Subtle Grid
  ctx.strokeStyle = 'rgba(255,255,255,.03)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  s.players.forEach(p => {
    // Draw Trail
    if (p.trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.moveTo(p.trail[0].x, p.trail[0].y);
      for (let i = 1; i < p.trail.length; i++) {
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
      }
      ctx.lineTo(p.x, p.y); // Connect to head
      ctx.stroke();
      ctx.restore();
    }
    // Draw Head
    drawCircle(p.x, p.y, 5, '#fff', true);
    drawCircle(p.x, p.y, 8, p.color, true);
  });
}

function draw() {
  requestAnimationFrame(draw);

  if (state && (gamePhase === 'playing' || gamePhase === 'goal' || gamePhase === 'finished')) {
    const isFlipped = playerIdx === 0;
    
    // Clear background
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    ctx.save();
    if (isFlipped) {
      ctx.translate(GAME_W, GAME_H);
      ctx.rotate(Math.PI);
    }
    
    // Apply Global Glow for premium feel
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255,255,255,0.2)';

    const render = RENDERERS[gameId] || drawPong;
    render(state);

    ctx.restore();
  } else {
    drawWaiting();
  }
}

function drawAirHockey(s) {
  const W = GAME_W, H = GAME_H;
  // Middle line
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
  // Goals
  ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 2; ctx.strokeRect(AH.GX, 0, AH.GW, 5);
  ctx.strokeStyle = '#4ecdc4'; ctx.strokeRect(AH.GX, H - 5, AH.GW, 5);
  // Paddles
  drawCircle(s.paddles[0].x, s.paddles[0].y, AH.PAR, '#ff6b6b', true);
  drawCircle(s.paddles[1].x, s.paddles[1].y, AH.PAR, '#4ecdc4', true);
  // Puck
  drawCircle(s.puck.x, s.puck.y, AH.PR, '#fff', true);
}

function drawPong(s) {
  const W = GAME_W, H = GAME_H;
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
  // Paddles
  drawRect(s.paddles[0].x - PG.PW/2, s.paddles[0].y - PG.PH/2, PG.PW, PG.PH, '#ff6b6b', true);
  drawRect(s.paddles[1].x - PG.PW/2, s.paddles[1].y - PG.PH/2, PG.PW, PG.PH, '#4ecdc4', true);
  // Ball
  drawCircle(s.puck.x, s.puck.y, PG.BR, '#fff', true);
}

// ── Shared Drawing Helpers ─────────────────────────────────

function drawCircle(x, y, r, color, glow = false) {
  ctx.save();
  if (glow) { ctx.shadowBlur = 15; ctx.shadowColor = color; }
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawRect(x, y, w, h, color, glow = false) {
  ctx.save();
  if (glow) { ctx.shadowBlur = 15; ctx.shadowColor = color; }
  ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function drawPlaceholder(s, name) {
  ctx.fillStyle = '#fff'; ctx.font = '12px Courier'; ctx.textAlign = 'center';
  ctx.fillText(`[${name}] ENGINE SYNC...`, GAME_W/2, GAME_H/2);
}

const HINTS = {
  'air-hockey': 'MOUSE/DRAG TO HIT PUCK',
  'pong': 'MOUSE/DRAG TO MOVE PADDLE',
  'tron': 'PC: [A][D] | MOBILE: TAP SIDES',
  'tanks': 'PC: [WASD][SPACE] | MOBILE: DRAG/TAP TOP',
  'volley': 'PC: [A][D][SPACE] | MOBILE: DRAG/TAP TOP',
  'breakers': 'MOUSE/DRAG TO BOUNCE BALL',
};

function drawWaiting() {
  ctx.fillStyle = '#050510'; ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.fillStyle = '#445'; ctx.font = '700 14px monospace'; ctx.textAlign = 'center';
  ctx.fillText('INITIALIZING VECTOR...', GAME_W / 2, GAME_H / 2 - 10);
  
  // Quick Hint
  const hint = HINTS[gameId] || 'PREPARING...';
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(10, GAME_H - 40, GAME_W - 20, 30);
  ctx.fillStyle = 'var(--accent)';
  ctx.font = '800 10px monospace';
  ctx.fillText(hint, GAME_W / 2, GAME_H - 21);
}

init();
draw();
