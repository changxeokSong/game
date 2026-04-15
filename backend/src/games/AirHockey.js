'use strict';
const { clamp } = require('../utils/helpers');

/** Air Hockey — 480 × 272 landscape */
const C = Object.freeze({
  W: 480, H: 272,
  PR: 14,    // puck radius
  PAR: 28,   // paddle radius
  MAXSPD: 14,
  FRIC: 0.99,
  GH: 120,   // goal height
  WIN: 7,
  get GY() { return (this.H - this.GH) / 2; },
});

function createState() {
  return {
    puck:    { x: C.W/2, y: C.H/2, vx: 0, vy: 0 },
    paddles: [
      { x: 60,      y: C.H/2, vx: 0, vy: 0 },  // left  (P0 red)
      { x: C.W-60,  y: C.H/2, vx: 0, vy: 0 },  // right (P1 blue)
    ],
    scores: [0, 0], phase: 'waiting', winner: null,
  };
}

function launch(state) {
  const a = (Math.random() * 40 - 20) * Math.PI / 180;
  const d = Math.random() < 0.5 ? 1 : -1;
  Object.assign(state.puck, { x: C.W/2, y: C.H/2,
    vx: d * Math.cos(a) * 5, vy: Math.sin(a) * 5 });
}

/**
 * Advance one physics frame.
 * @returns {0|1|null}  scorer index if goal, else null
 */
function tick(state) {
  if (state.phase !== 'playing') return null;
  const p = state.puck;
  p.x += p.vx;  p.y += p.vy;
  p.vx *= C.FRIC;  p.vy *= C.FRIC;

  // Top / bottom walls
  if (p.y - C.PR < 0)     { p.y = C.PR;       p.vy =  Math.abs(p.vy); }
  if (p.y + C.PR > C.H)   { p.y = C.H - C.PR; p.vy = -Math.abs(p.vy); }

  // Left wall / goal
  if (p.x - C.PR < 0) {
    if (p.y >= C.GY && p.y <= C.GY + C.GH) return 1;  // P1 scores
    p.x = C.PR;  p.vx = Math.abs(p.vx);
  }
  // Right wall / goal
  if (p.x + C.PR > C.W) {
    if (p.y >= C.GY && p.y <= C.GY + C.GH) return 0;  // P0 scores
    p.x = C.W - C.PR;  p.vx = -Math.abs(p.vx);
  }

  // Paddle collisions
  for (const pad of state.paddles) {
    const dx = p.x - pad.x, dy = p.y - pad.y;
    const d2 = dx*dx + dy*dy, md = C.PR + C.PAR;
    if (d2 < md*md && d2 > 0) {
      const d = Math.sqrt(d2), nx = dx/d, ny = dy/d;
      p.x = pad.x + nx*md;  p.y = pad.y + ny*md;
      const dot = p.vx*nx + p.vy*ny;
      p.vx = p.vx - 2*dot*nx + pad.vx*0.4;
      p.vy = p.vy - 2*dot*ny + pad.vy*0.4;
      const sp = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
      if (sp > C.MAXSPD) { p.vx = p.vx/sp*C.MAXSPD; p.vy = p.vy/sp*C.MAXSPD; }
    }
  }

  // Constrain paddles to their halves
  const [p0, p1] = state.paddles;
  p0.x = clamp(p0.x, C.PAR,          C.W/2 - C.PAR);
  p0.y = clamp(p0.y, C.PAR,          C.H   - C.PAR);
  p1.x = clamp(p1.x, C.W/2 + C.PAR, C.W   - C.PAR);
  p1.y = clamp(p1.y, C.PAR,          C.H   - C.PAR);

  return null;
}

function move(state, idx, x, y) {
  const pad = state.paddles[idx], px = pad.x, py = pad.y;
  pad.x = x;  pad.y = y;
  pad.vx = pad.x - px;  pad.vy = pad.y - py;
}

module.exports = { C, createState, launch, tick, move };
