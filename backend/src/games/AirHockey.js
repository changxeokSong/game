'use strict';
const { clamp } = require('../utils/helpers');

/** Air Hockey — 272 × 480 portrait */
const C = Object.freeze({
  W: 272, H: 480,
  PR: 14,    // puck radius
  PAR: 28,   // paddle radius
  MAXSPD: 14,
  FRIC: 0.99,
  GW: 120,   // goal width
  WIN: 7,
  get GX() { return (this.W - this.GW) / 2; },
});

function createState() {
  return {
    puck:    { x: C.W/2, y: C.H/2, vx: 0, vy: 0 },
    paddles: [
      { x: C.W/2, y: 60,      vx: 0, vy: 0 },  // top   (P0 red)
      { x: C.W/2, y: C.H-60,  vx: 0, vy: 0 },  // bottom (P1 blue)
    ],
    scores: [0, 0], phase: 'waiting', winner: null,
  };
}

function launch(state) {
  const a = (Math.random() * 40 - 20) * Math.PI / 180;
  const d = Math.random() < 0.5 ? 1 : -1;
  Object.assign(state.puck, { x: C.W/2, y: C.H/2,
    vx: Math.sin(a) * 3, vy: d * Math.cos(a) * 3 });
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

  // Left / right walls
  if (p.x - C.PR < 0)     { p.x = C.PR;       p.vx =  Math.abs(p.vx); }
  if (p.x + C.PR > C.W)   { p.x = C.W - C.PR; p.vx = -Math.abs(p.vx); }

  // Top wall / goal
  if (p.y - C.PR < 0) {
    if (p.x >= C.GX && p.x <= C.GX + C.GW) return 1;  // P1 scores
    p.y = C.PR;  p.vy = Math.abs(p.vy);
  }
  // Bottom wall / goal
  if (p.y + C.PR > C.H) {
    if (p.x >= C.GX && p.x <= C.GX + C.GW) return 0;  // P0 scores
    p.y = C.H - C.PR;  p.vy = -Math.abs(p.vy);
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
  p0.x = clamp(p0.x, C.PAR, C.W - C.PAR);
  p0.y = clamp(p0.y, C.PAR, C.H/2 - C.PAR);
  p1.x = clamp(p1.x, C.PAR, C.W - C.PAR);
  p1.y = clamp(p1.y, C.H/2 + C.PAR, C.H - C.PAR);

  return null;
}

function move(state, idx, x, y) {
  const pad = state.paddles[idx], px = pad.x, py = pad.y;
  pad.x = x;  pad.y = y;
  pad.vx = pad.x - px;  pad.vy = pad.y - py;
}

module.exports = { C, createState, launch, tick, move };
