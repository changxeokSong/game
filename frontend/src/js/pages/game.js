import { WSClient } from '../ws.js';
import { session } from '../utils.js';
import { Chat } from '../components/Chat.js';

const username = session.get('username');
if (!username) location.replace('/');

const params = new URLSearchParams(location.search);
const gameId = params.get('id') || session.get('gameId') || 'air-hockey';

const ws = new WSClient();
const chat = new Chat('chat-msgs', 'chat-inp', ws);

// ── Canvas setup ──────────────────────────────────────────
const GAME_W = 272, GAME_H = 480;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
canvas.width = GAME_W;
canvas.height = GAME_H;

let _scale = 1;
function resize() {
  const container = document.getElementById('canvas-wrap');
  const maxW = container.clientWidth - 4; // padding
  const s = maxW / GAME_W;
  canvas.style.width = (GAME_W * s) + 'px';
  canvas.style.height = (GAME_H * s) + 'px';
  _scale = s;
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
      ws.send({ type: 'join_game', gameId });
    });

    ws.on('game_init', m => {
      playerIdx = m.playerIdx;
      state = m.state;
      gamePhase = 'waiting';
      badgeEl.textContent = 'WAITING';
      setPlayerName(playerIdx, username);
    });

    ws.on('game_start', m => {
      state = m.state;
      gamePhase = 'playing';
      hideOverlay();
      badgeEl.textContent = 'PLAYING';
    });

    ws.on('game_state', m => {
      if (state) {
        state.puck = m.state.puck;
        state.paddles = m.state.paddles;
      }
    });

    ws.on('game_goal', m => {
      state.scores = m.scores;
      updateScore();
      const iMine = m.scorer === playerIdx;
      showOverlay(iMine ? '⚡ GOAL!' : '😬 GOAL!',
        iMine ? '득점!' : '실점…',
        iMine ? 'var(--red)' : 'var(--teal)', false);
    });

    ws.on('game_resume', m => {
      state = m.state;
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
        if (u.username !== username) setPlayerName(1 - playerIdx, u.username);
      });
    });

    ws.send({ type: 'login', username });

  } catch (err) {
    console.error('WS Error:', err);
  }
}

function setPlayerName(idx, name) {
  playerNames[idx] = name;
  document.getElementById(`name${idx}`).textContent = name;
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
  ws.send({ type: 'leave_game' });
};

// ── Input ─────────────────────────────────────────────────
function sendMove(cx, cy) {
  if (gamePhase !== 'playing') return;
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

canvas.addEventListener('mousemove', e => sendMove(e.clientX, e.clientY));
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  sendMove(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

// ── Rendering ─────────────────────────────────────────────
function draw() {
  requestAnimationFrame(draw);

  // If local player is P0 (global TOP), rotate 180 deg to see self at BOTTOM
  const isFlipped = playerIdx === 0;
  if (isFlipped) {
    ctx.save();
    ctx.translate(GAME_W, GAME_H);
    ctx.rotate(Math.PI);
  }

  if (state && (gamePhase === 'playing' || gamePhase === 'goal' || gamePhase === 'finished')) {
    if (gameId === 'air-hockey') drawAirHockey(state);
    else drawPong(state);
  } else {
    drawWaiting();
  }

  if (isFlipped) ctx.restore();
}

function drawAirHockey(s) {
  const W = GAME_W, H = GAME_H;
  ctx.fillStyle = '#0b1a30'; ctx.fillRect(0, 0, W, H);

  // Goals
  ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 2; ctx.strokeRect(AH.GX, 0, AH.GW, 10);
  ctx.strokeStyle = '#4ecdc4'; ctx.strokeRect(AH.GX, H - 10, AH.GW, 10);

  // Middle
  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();

  // Paddles
  drawCircle(s.paddles[0].x, s.paddles[0].y, AH.PAR, '#ff6b6b');
  drawCircle(s.paddles[1].x, s.paddles[1].y, AH.PAR, '#4ecdc4');
  // Puck
  drawCircle(s.puck.x, s.puck.y, AH.PR, '#fff');
}

function drawPong(s) {
  const W = GAME_W, H = GAME_H;
  ctx.fillStyle = '#050510'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();

  // Paddles
  ctx.fillStyle = '#ff6b6b'; ctx.fillRect(s.paddles[0].x - PG.PW/2, s.paddles[0].y - PG.PH/2, PG.PW, PG.PH);
  ctx.fillStyle = '#4ecdc4'; ctx.fillRect(s.paddles[1].x - PG.PW/2, s.paddles[1].y - PG.PH/2, PG.PW, PG.PH);
  // Ball
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.puck.x, s.puck.y, PG.BR, 0, Math.PI * 2); ctx.fill();
}

function drawCircle(x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function drawWaiting() {
  ctx.fillStyle = '#09090f'; ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.fillStyle = '#667'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('WAITING...', GAME_W / 2, GAME_H / 2);
}

init();
draw();
