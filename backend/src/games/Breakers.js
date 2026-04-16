'use strict';
const { clamp } = require('../utils/helpers');

const C = Object.freeze({
  W: 272, H: 480,
  BR: 8,        // ball radius
  PW: 72, PH: 12,
  BW: 38, BH: 13,  // brick width/height
  MAXSPD: 25.5,
  WIN: 10,      // first to destroy 10 bricks wins (score-based)
  ROWS: 4, COLS: 6,
});

function _buildBricks() {
  const bricks = [];
  const totalW = C.COLS * C.BW;
  const startX = (C.W - totalW) / 2;
  const startY = C.H / 2 - (C.ROWS * C.BH) / 2;

  for (let r = 0; r < C.ROWS; r++) {
    for (let c = 0; c < C.COLS; c++) {
      bricks.push({
        id:     `b${r}-${c}`,
        x:       startX + c * C.BW,
        y:       startY + r * C.BH,
        active:  true,
        color:   r % 2 === 0 ? '#ff6b6b' : '#4ecdc4',
      });
    }
  }
  return bricks;
}

function createState() {
  return {
    puck: { x: C.W / 2, y: C.H / 2 + 50, vx: 0, vy: 0, lastHit: -1 },
    paddles: [
      { x: C.W / 2, y: 30,       tx: C.W / 2 },
      { x: C.W / 2, y: C.H - 30, tx: C.W / 2 },
    ],
    bricks: _buildBricks(),
    scores: [0, 0], phase: 'waiting', winner: null,
  };
}

function launch(state) {
  // Reset all bricks
  state.bricks = _buildBricks();
  state.scores  = [0, 0];

  const a = (Math.random() * 30 - 15) * Math.PI / 180;
  const d = Math.random() < 0.5 ? 1 : -1;
  Object.assign(state.puck, {
    x: C.W / 2, y: C.H / 2 + 50 * d,
    vx: Math.sin(a) * 8.5, vy: d * Math.cos(a) * 8.5,
    lastHit: -1,
  });
}

function tick(state) {
  if (state.phase !== 'playing') return null;
  const b = state.puck;

  // ── Paddle smoothing ──────────────────────────────────────
  state.paddles.forEach(p => {
    const dx = p.tx - p.x;
    const maxStep = 38;
    if (Math.abs(dx) > maxStep) p.x += Math.sign(dx) * maxStep;
    else p.x = p.tx;
  });

  b.x += b.vx;
  b.y += b.vy;

  // ── Wall collisions ───────────────────────────────────────
  if (b.x - C.BR < 0)    { b.x = C.BR;       b.vx =  Math.abs(b.vx); }
  if (b.x + C.BR > C.W)  { b.x = C.W - C.BR; b.vx = -Math.abs(b.vx); }

  // ── Goal check ───────────────────────────────────────────
  if (b.y < 0)    return 1; // P1 scores (ball exited top)
  if (b.y > C.H)  return 0; // P0 scores (ball exited bottom)

  // ── Paddle collisions ─────────────────────────────────────
  const hh = C.PH / 2, hw = C.PW / 2;
  state.paddles.forEach((p, idx) => {
    const isTop = idx === 0;
    // Check if ball is approaching from the paddle's open side
    const approaching = isTop ? (b.vy < 0) : (b.vy > 0);
    if (!approaching) return;

    const withinX = b.x >= p.x - hw - C.BR && b.x <= p.x + hw + C.BR;
    const withinY = isTop
      ? (b.y - C.BR < p.y + hh && b.y > p.y - hh)
      : (b.y + C.BR > p.y - hh && b.y < p.y + hh);

    if (withinX && withinY) {
      b.y = isTop ? p.y + hh + C.BR : p.y - hh - C.BR;
      const sp    = Math.min(Math.sqrt(b.vx ** 2 + b.vy ** 2) + 0.4, C.MAXSPD);
      const angle = (b.x - p.x) / hw * 60 * Math.PI / 180;
      b.vx  = Math.sin(angle) * sp;
      b.vy  = (isTop ? 1 : -1) * Math.cos(angle) * sp;
      b.lastHit = idx;
    }
  });

  // ── Brick collisions ──────────────────────────────────────
  for (const brick of state.bricks) {
    if (!brick.active) continue;

    const bLeft  = brick.x;
    const bRight = brick.x + C.BW;
    const bTop   = brick.y;
    const bBot   = brick.y + C.BH;

    if (b.x + C.BR > bLeft && b.x - C.BR < bRight &&
        b.y + C.BR > bTop  && b.y - C.BR < bBot) {

      brick.active = false;

      // Determine which axis has less penetration → bounce on that axis
      const overlapLeft  = (b.x + C.BR) - bLeft;
      const overlapRight = bRight - (b.x - C.BR);
      const overlapTop   = (b.y + C.BR) - bTop;
      const overlapBot   = bBot - (b.y - C.BR);

      const minOverlapX = Math.min(overlapLeft, overlapRight);
      const minOverlapY = Math.min(overlapTop,  overlapBot);

      if (minOverlapX < minOverlapY) {
        // Horizontal hit — bounce vx
        if (overlapLeft < overlapRight) {
          b.vx = -Math.abs(b.vx);
          b.x  = bLeft - C.BR;
        } else {
          b.vx =  Math.abs(b.vx);
          b.x  = bRight + C.BR;
        }
      } else {
        // Vertical hit — bounce vy
        if (overlapTop < overlapBot) {
          b.vy = -Math.abs(b.vy);
          b.y  = bTop - C.BR;
        } else {
          b.vy =  Math.abs(b.vy);
          b.y  = bBot + C.BR;
        }
      }

      // Award score to last-hitter
      if (b.lastHit !== -1) {
        state.scores[b.lastHit] += 20;
      }

      // Check win condition
      const allGone = state.bricks.every(bk => !bk.active);
      if (allGone) {
        // Winner is whoever has more score
        return state.scores[0] >= state.scores[1] ? 0 : 1;
      }

      break; // one brick per tick for stability
    }
  }

  return null;
}

function move(state, idx, x, _y) {
  state.paddles[idx].tx = clamp(x, C.PW / 2, C.W - C.PW / 2);
}

module.exports = { C, createState, launch, tick, move };
