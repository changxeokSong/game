'use strict';

/** Neon Tron — 272 × 480 portrait */
const C = Object.freeze({
  W: 272, H: 480,
  SPEED: 5.3,
  PLAYER_R: 5,    // head collision radius
  WIN: 3,
  GRACE_FRAMES: 15, // ignore own trail for this many recent points
});

function createState() {
  return {
    players: [
      { x: C.W * 0.3, y: 80,       dir: 'down',  trail: [], color: '#ff6b6b', alive: true },
      { x: C.W * 0.7, y: C.H - 80, dir: 'up',    trail: [], color: '#4ecdc4', alive: true },
    ],
    scores: [0, 0], phase: 'waiting', winner: null,
  };
}

function launch(state) {
  state.players[0].x = C.W * 0.3; state.players[0].y = 80;       state.players[0].dir = 'down';  state.players[0].trail = []; state.players[0].alive = true;
  state.players[1].x = C.W * 0.7; state.players[1].y = C.H - 80; state.players[1].dir = 'up';    state.players[1].trail = []; state.players[1].alive = true;
}

function tick(state) {
  if (state.phase !== 'playing') return null;

  // ── Move both players and record trail ───────────────────
  for (let i = 0; i < 2; i++) {
    const p = state.players[i];
    if (!p.alive) continue;

    // Record current head position into trail BEFORE moving
    p.trail.push({ x: p.x, y: p.y });

    // Cap trail length to avoid unbounded memory growth
    if (p.trail.length > 2000) p.trail.shift();

    // Move
    if (p.dir === 'up')    p.y -= C.SPEED;
    if (p.dir === 'down')  p.y += C.SPEED;
    if (p.dir === 'left')  p.x -= C.SPEED;
    if (p.dir === 'right') p.x += C.SPEED;

    // Wall collision
    if (p.x < 0 || p.x > C.W || p.y < 0 || p.y > C.H) {
      p.alive = false;
    }
  }

  // ── Trail collision detection ─────────────────────────────
  for (let i = 0; i < 2; i++) {
    const p = state.players[i];
    if (!p.alive) continue;

    for (let j = 0; j < 2; j++) {
      const target = state.players[j];
      // For self-collision, skip the most recent GRACE_FRAMES points
      const limit = (i === j)
        ? Math.max(0, target.trail.length - C.GRACE_FRAMES)
        : target.trail.length;

      for (let k = 0; k < limit; k++) {
        const dot = target.trail[k];
        const dx = p.x - dot.x;
        const dy = p.y - dot.y;
        if (dx * dx + dy * dy < C.PLAYER_R * C.PLAYER_R) {
          p.alive = false;
          break;
        }
      }
      if (!p.alive) break;
    }
  }

  // ── Determine result ──────────────────────────────────────
  const [a0, a1] = [state.players[0].alive, state.players[1].alive];

  if (!a0 && !a1) return -1; // tie — nobody scores (handle in RoomManager)
  if (!a0) return 1;  // P1 wins
  if (!a1) return 0;  // P0 wins

  return null;
}

const DIRS = ['up', 'right', 'down', 'left'];

function move(state, idx, x, _y) {
  const p = state.players[idx];

  // Anti-jitter: only turn if enough time has passed
  const now = Date.now();
  if (p.lastTurn && now - p.lastTurn < 120) return;

  const curIdx = DIRS.indexOf(p.dir);
  // P0's x is flipped by the frontend, so global x > W/2 means physical left tap
  const isPhysicalLeft = idx === 0 ? x >= C.W / 2 : x < C.W / 2;
  const newIdx = isPhysicalLeft
    ? (curIdx + 3) % 4  // CCW
    : (curIdx + 1) % 4; // CW

  // Prevent 180° reversal — use circular modular distance (wrap-around safe)
  if ((4 + newIdx - curIdx) % 4 === 2) return;

  p.dir = DIRS[newIdx];
  p.lastTurn = now;
}

module.exports = { C, createState, launch, tick, move };
