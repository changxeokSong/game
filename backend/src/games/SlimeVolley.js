'use strict';
const { clamp } = require('../utils/helpers');

const C = Object.freeze({
  W: 272, H: 480,
  BR: 12,     // ball radius
  SR: 30,     // slime radius
  G: 0.25,    // gravity (downward = positive y)
  JUMP: 7,    // jump speed magnitude (applied upward = -vy)
  MAXSPD: 10,
  WIN: 7,
  NET_W: 40,  // half-width of net at center
  NET_X: 272 / 2, // net center x
});

function createState() {
  return {
    ball: { x: C.W / 2, y: C.H - 150, vx: 0, vy: 0 },
    slimes: [
      // P0 = top half (y increases downward), rests near y=0 ceiling
      { x: C.W / 2, y: C.SR,        vx: 0, vy: 0, tx: C.W / 2, color: '#ff6b6b', onGround: true },
      // P1 = bottom half, rests near y=H floor
      { x: C.W / 2, y: C.H - C.SR,  vx: 0, vy: 0, tx: C.W / 2, color: '#4ecdc4', onGround: true },
    ],
    scores: [0, 0], phase: 'waiting', winner: null,
  };
}

function launch(state) {
  // Launch toward the bottom half (P1 side) or top half randomly
  const side = Math.random() < 0.5 ? 1 : 0;
  const targetY = side === 0 ? C.H * 0.3 : C.H * 0.7;
  state.ball = {
    x: C.W / 2,
    y: targetY,
    vx: (Math.random() - 0.5) * 4,
    vy: 0,
  };
  // Reset slimes to rest positions
  state.slimes[0].vy = 0; state.slimes[0].y = C.SR; state.slimes[0].onGround = true;
  state.slimes[1].vy = 0; state.slimes[1].y = C.H - C.SR; state.slimes[1].onGround = true;
}

function tick(state) {
  if (state.phase !== 'playing') return null;

  const b = state.ball;

  // ── Ball physics ──────────────────────────────────────────
  b.vy += C.G;
  b.x  += b.vx;
  b.y  += b.vy;

  // Wall collisions
  if (b.x < C.BR)           { b.x = C.BR;          b.vx *= -0.85; }
  if (b.x > C.W - C.BR)     { b.x = C.W - C.BR;    b.vx *= -0.85; }

  // Goal check (ball exits top or bottom)
  if (b.y < -C.BR)           return 1; // P1 (bottom) scores — ball went past top
  if (b.y > C.H + C.BR)      return 0; // P0 (top)    scores — ball went past bottom

  // ── Net collision (line at y = H/2) ───────────────────────
  // Net occupies x: [C.NET_X - C.NET_W, C.NET_X + C.NET_W]
  const netTop = C.H / 2 - 2;
  const netBot = C.H / 2 + 2;
  if (b.y + C.BR > netTop && b.y - C.BR < netBot &&
      b.x > C.NET_X - C.NET_W && b.x < C.NET_X + C.NET_W) {
    if (b.vy > 0) {
      b.vy = -Math.abs(b.vy) * 0.9;
      b.y  = netTop - C.BR;
    } else {
      b.vy =  Math.abs(b.vy) * 0.9;
      b.y  = netBot + C.BR;
    }
  }

  // ── Slime physics ─────────────────────────────────────────
  state.slimes.forEach((s, idx) => {
    const isTop = idx === 0;

    // Smooth horizontal movement
    const txDiff = s.tx - s.x;
    const maxStep = 12;
    const oldX = s.x;
    if (Math.abs(txDiff) > maxStep) s.x += Math.sign(txDiff) * maxStep;
    else s.x = s.tx;
    s.vx = s.x - oldX;

    // Clamp X to own half (keep away from net too)
    s.x = clamp(s.x, C.SR, C.W - C.SR);

    // Apply gravity
    s.vy += C.G;
    s.y  += s.vy;

    // Ground/Ceiling constraints
    if (isTop) {
      // P0 lives in top half — ceiling is y=C.SR (rests here), floor is y=H/2 - C.SR
      const ceiling = C.SR;
      const floor   = C.H / 2 - C.SR;
      if (s.y <= ceiling) {
        s.y = ceiling;
        s.vy = 0;
        s.onGround = true;
      } else if (s.y >= floor) {
        s.y = floor;
        s.vy = 0;
        s.onGround = false; // can't jump while at center boundary
      } else {
        s.onGround = false;
      }
    } else {
      // P1 lives in bottom half — floor is y=H - C.SR (rests here), ceiling is y=H/2 + C.SR
      const ceiling = C.H / 2 + C.SR;
      const floor   = C.H - C.SR;
      if (s.y >= floor) {
        s.y = floor;
        s.vy = 0;
        s.onGround = true;
      } else if (s.y <= ceiling) {
        s.y = ceiling;
        s.vy = 0;
        s.onGround = false;
      } else {
        s.onGround = false;
      }
    }

    // ── Ball-Slime collision ──────────────────────────────────
    const dx   = b.x - s.x;
    const dy   = b.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minD = C.BR + C.SR;
    if (dist < minD && dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      // Resolve overlap
      b.x = s.x + nx * minD;
      b.y = s.y + ny * minD;
      // Impulse-based bounce
      const relVx = b.vx - s.vx;
      const relVy = b.vy - s.vy;
      const dot   = relVx * nx + relVy * ny;
      const restitution = 1.3;
      b.vx -= restitution * dot * nx;
      b.vy -= restitution * dot * ny;
      // Speed cap
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp > C.MAXSPD) { b.vx = b.vx / sp * C.MAXSPD; b.vy = b.vy / sp * C.MAXSPD; }
    }
  });

  return null;
}

/**
 * move(state, idx, x, y)
 * x  → target horizontal position (already in global game coords)
 * y  → used to detect jump intent
 *
 * Jump detection:
 *   P0 (top slime)    — tapping the bottom portion of the screen (y > H/2) → jump DOWN toward center
 *   P1 (bottom slime) — tapping the top portion of the screen    (y < H/2) → jump UP   toward center
 *
 * The client sends coordinates already flipped by the view transform,
 * so we treat them as-is in global coordinates.
 */
function move(state, idx, x, y) {
  const s    = state.slimes[idx];
  const isTop = idx === 0;

  // Horizontal target — constrain to own half
  s.tx = clamp(x, C.SR, C.W - C.SR);

  // Jump detection
  // After client coordinate flip P0 sees flipped coords: their "tap top" = global bottom half (y > H/2)
  // So for P0: jump when y > H/2, for P1: jump when y < H/2
  const jumpIntent = isTop ? (y > C.H / 2) : (y < C.H / 2);

  if (jumpIntent && s.onGround) {
    if (isTop) {
      // P0 rests at ceiling (y=SR), jumps downward (positive vy) toward net
      s.vy = +C.JUMP;
    } else {
      // P1 rests at floor (y=H-SR), jumps upward (negative vy) toward net
      s.vy = -C.JUMP;
    }
    s.onGround = false;
  }
}

module.exports = { C, createState, launch, tick, move };
