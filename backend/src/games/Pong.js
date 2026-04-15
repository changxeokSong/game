'use strict';
const { clamp } = require('../utils/helpers');

/** Classic Pong — 480 × 272 landscape */
const C = Object.freeze({
  W: 480, H: 272,
  BR: 10,   // ball radius
  PW: 12,   // paddle width
  PH: 72,   // paddle height
  MAXSPD: 14,
  WIN: 7,
});

function createState() {
  return {
    puck:    { x: C.W/2, y: C.H/2, vx: 0, vy: 0 },
    paddles: [
      { x: 18,      y: C.H/2 },  // left  (P0)
      { x: C.W-18,  y: C.H/2 },  // right (P1)
    ],
    scores: [0, 0], phase: 'waiting', winner: null,
  };
}

function launch(state) {
  const a = (Math.random() * 30 - 15) * Math.PI / 180;
  const d = Math.random() < 0.5 ? 1 : -1;
  Object.assign(state.puck, { x: C.W/2, y: C.H/2,
    vx: d * Math.cos(a) * 6, vy: Math.sin(a) * 6 });
}

function tick(state) {
  if (state.phase !== 'playing') return null;
  const b = state.puck;
  b.x += b.vx;  b.y += b.vy;

  if (b.y - C.BR < 0)   { b.y = C.BR;       b.vy =  Math.abs(b.vy); }
  if (b.y + C.BR > C.H) { b.y = C.H - C.BR; b.vy = -Math.abs(b.vy); }
  if (b.x - C.BR < 0)  return 1;   // P1 scores
  if (b.x + C.BR > C.W) return 0;  // P0 scores

  const [p0, p1] = state.paddles;
  const hh = C.PH/2, hw = C.PW/2;

  // Left paddle
  if (b.vx < 0 && b.x - C.BR < p0.x + hw && b.x > p0.x - hw
      && b.y >= p0.y - hh - C.BR && b.y <= p0.y + hh + C.BR) {
    b.x = p0.x + hw + C.BR;
    const sp = Math.min(Math.sqrt(b.vx*b.vx + b.vy*b.vy) + 0.4, C.MAXSPD);
    const a2 = ((b.y - p0.y) / hh) * 60 * Math.PI / 180;
    b.vx = Math.cos(a2) * sp;  b.vy = Math.sin(a2) * sp;
  }
  // Right paddle
  if (b.vx > 0 && b.x + C.BR > p1.x - hw && b.x < p1.x + hw
      && b.y >= p1.y - hh - C.BR && b.y <= p1.y + hh + C.BR) {
    b.x = p1.x - hw - C.BR;
    const sp = Math.min(Math.sqrt(b.vx*b.vx + b.vy*b.vy) + 0.4, C.MAXSPD);
    const a2 = ((b.y - p1.y) / hh) * 60 * Math.PI / 180;
    b.vx = -Math.cos(a2) * sp;  b.vy = Math.sin(a2) * sp;
  }

  return null;
}

function move(state, idx, _x, y) {
  state.paddles[idx].y = clamp(y, C.PH/2, C.H - C.PH/2);
}

module.exports = { C, createState, launch, tick, move };
