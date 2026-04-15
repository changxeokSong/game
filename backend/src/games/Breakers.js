'use strict';
const { clamp } = require('../utils/helpers');

const C = Object.freeze({
  W: 272, H: 480,
  BR: 8,      // ball radius
  PW: 72, PH: 12,
  BW: 40, BH: 15, // brick width/height
  MAXSPD: 12,
  WIN: 500,  // Score based win
});

function createState() {
  const bricks = [];
  const rows = 4, cols = 6;
  const startY = C.H / 2 - (rows * C.BH) / 2;
  const startX = (C.W - cols * C.BW) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      bricks.push({
        id: `b${r}-${c}`,
        x: startX + c * C.BW,
        y: startY + r * C.BH,
        active: true,
        color: r % 2 === 0 ? '#ff6b6b' : '#4ecdc4',
      });
    }
  }

  return {
    puck:    { x: C.W / 2, y: C.H / 2 + 50, vx: 0, vy: 0, lastHit: -1 },
    paddles: [
      { x: C.W / 2, y: 30,       tx: C.W / 2 },
      { x: C.W / 2, y: C.H - 30, tx: C.W / 2 },
    ],
    bricks,
    scores: [0, 0], phase: 'waiting', winner: null,
  };
}

function launch(state) {
  const a = (Math.random() * 30 - 15) * Math.PI / 180;
  const d = Math.random() < 0.5 ? 1 : -1;
  Object.assign(state.puck, { 
    x: C.W / 2, y: C.H / 2 + 50 * d,
    vx: Math.sin(a) * 4, vy: d * Math.cos(a) * 4,
    lastHit: -1 
  });
}

function tick(state) {
  if (state.phase !== 'playing') return null;
  const b = state.puck;
  b.x += b.vx; b.y += b.vy;
  
  // Smooth Paddles
  state.paddles.forEach(p => {
    const dx = p.tx - p.x;
    const maxStep = 18;
    if (Math.abs(dx) > maxStep) p.x += Math.sign(dx) * maxStep;
    else p.x = p.tx;
  });

  // Wall collisions
  if (b.x - C.BR < 0)   { b.x = C.BR;       b.vx =  Math.abs(b.vx); }
  if (b.x + C.BR > C.W) { b.x = C.W - C.BR; b.vx = -Math.abs(b.vx); }
  
  // Goal Check
  if (b.y < 0) return 1;
  if (b.y > C.H) return 0;

  // Paddle collisions
  const hh = C.PH / 2, hw = C.PW / 2;
  state.paddles.forEach((p, idx) => {
    const isTop = idx === 0;
    const hit = isTop 
      ? (b.vy < 0 && b.y - C.BR < p.y + hh && b.y > p.y - hh)
      : (b.vy > 0 && b.y + C.BR > p.y - hh && b.y < p.y + hh);
    
    if (hit && b.x >= p.x - hw - C.BR && b.x <= p.x + hw + C.BR) {
      b.y = isTop ? p.y + hh + C.BR : p.y - hh - C.BR;
      const sp = Math.min(Math.sqrt(b.vx ** 2 + b.vy ** 2) + 0.2, C.MAXSPD);
      const angle = (b.x - p.x) / hw * 60 * Math.PI / 180;
      b.vx = Math.sin(angle) * sp;
      b.vy = (isTop ? 1 : -1) * Math.cos(angle) * sp;
      b.lastHit = idx;
    }
  });

  // Brick collisions
  for (const brick of state.bricks) {
    if (!brick.active) continue;
    if (b.x + C.BR > brick.x && b.x - C.BR < brick.x + C.BW &&
        b.y + C.BR > brick.y && b.y - C.BR < brick.y + C.BH) {
      
      brick.active = false;
      
      // Determine bounce direction properly
      const distTop = Math.abs((b.y + C.BR) - brick.y);
      const distBot = Math.abs((b.y - C.BR) - (brick.y + C.BH));
      if (distTop < distBot) {
        b.vy = -Math.abs(b.vy);
        b.y = brick.y - C.BR;
      } else {
        b.vy = Math.abs(b.vy);
        b.y = brick.y + C.BH + C.BR;
      }

      if (b.lastHit !== -1) {
        state.scores[b.lastHit] += 20;
      }
      break; // Single brick hit per tick for maximum stability
    }
  }

  return null;
}

function move(state, idx, x, y) {
  state.paddles[idx].tx = clamp(x, C.PW/2, C.W - C.PW/2);
}

module.exports = { C, createState, launch, tick, move };
