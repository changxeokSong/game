'use strict';
const { clamp } = require('../utils/helpers');

/** Classic Pong — 272 × 480 portrait */
const C = Object.freeze({
  W: 272, H: 480,
  BR: 10,   // ball radius
  PW: 72,   // paddle width
  PH: 12,   // paddle height
  MAXSPD: 30,
  WIN: 7,
});

function createState() {
  return {
    puck:    { x: C.W/2, y: C.H/2, vx: 0, vy: 0 },
    paddles: [
      { x: C.W/2, y: 18,       tx: C.W/2 },  // top
      { x: C.W/2, y: C.H-18,   tx: C.W/2 },  // bottom
    ],
    scores: [0, 0], phase: 'waiting', winner: null,
  };
}

function launch(state) {
  const a = (Math.random() * 30 - 15) * Math.PI / 180;
  const d = Math.random() < 0.5 ? 1 : -1;
  Object.assign(state.puck, { x: C.W/2, y: C.H/2,
    vx: Math.sin(a) * 7.5, vy: d * Math.cos(a) * 7.5 });
}

function tick(state) {
  if (state.phase !== 'playing') return null;
  const b = state.puck;

  // Smooth Paddles
  state.paddles.forEach(p => {
    const dx = p.tx - p.x;
    const maxStep = 38;
    if (Math.abs(dx) > maxStep) p.x += Math.sign(dx) * maxStep;
    else p.x = p.tx;
  });

  b.x += b.vx;  b.y += b.vy;

  if (b.x - C.BR < 0)   { b.x = C.BR;       b.vx =  Math.abs(b.vx); }
  if (b.x + C.BR > C.W) { b.x = C.W - C.BR; b.vx = -Math.abs(b.vx); }
  if (b.y - C.BR < 0)  return 1;   // P1 scores
  if (b.y + C.BR > C.H) return 0;  // P0 scores

  const [p0, p1] = state.paddles;
  const hh = C.PH/2, hw = C.PW/2;

  // Top paddle
  if (b.vy < 0 && b.y - C.BR < p0.y + hh && b.y > p0.y - hh
      && b.x >= p0.x - hw - C.BR && b.x <= p0.x + hw + C.BR) {
    b.y = p0.y + hh + C.BR;
    const sp = Math.min(Math.sqrt(b.vx*b.vx + b.vy*b.vy) + 0.85, C.MAXSPD);
    const a2 = ((b.x - p0.x) / hw) * 60 * Math.PI / 180;
    b.vx = Math.sin(a2) * sp;  b.vy = Math.cos(a2) * sp;
  }
  // Bottom paddle
  if (b.vy > 0 && b.y + C.BR > p1.y - hh && b.y < p1.y + hh
      && b.x >= p1.x - hw - C.BR && b.x <= p1.x + hw + C.BR) {
    b.y = p1.y - hh - C.BR;
    const sp = Math.min(Math.sqrt(b.vx*b.vx + b.vy*b.vy) + 0.85, C.MAXSPD);
    const a2 = ((b.x - p1.x) / hw) * 60 * Math.PI / 180;
    b.vx = Math.sin(a2) * sp;  b.vy = -Math.cos(a2) * sp;
  }

  return null;
}

function move(state, idx, x, _y) {
  state.paddles[idx].tx = clamp(x, C.PW/2, C.W - C.PW/2);
}

module.exports = { C, createState, launch, tick, move };
