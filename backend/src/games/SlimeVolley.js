'use strict';
const { clamp } = require('../utils/helpers');

const C = Object.freeze({
  W: 272, H: 480,
  BR: 12,     // ball radius
  SR: 30,     // slime radius
  G: 0.25,    // gravity
  JUMP: -7,   // jump strength
  MAXSPD: 10,
  WIN: 7,
});

function createState() {
  return {
    ball: { x: C.W / 2, y: 100, vx: 0, vy: 0 },
    slimes: [
      { x: C.W / 2, y: 50,      vx: 0, vy: 0, tx: C.W / 2, color: '#ff6b6b' },
      { x: C.W / 2, y: C.H - 50, vx: 0, vy: 0, tx: C.W / 2, color: '#4ecdc4' },
    ],
    scores: [0, 0], phase: 'waiting', winner: null,
  };
}

function launch(state) {
  const side = Math.random() < 0.5 ? 1 : 0;
  state.ball = { x: C.W / 2, y: side === 0 ? 150 : C.H - 150, vx: (Math.random()-0.5)*4, vy: 0 };
}

function tick(state) {
  if (state.phase !== 'playing') return null;

  const b = state.ball;
  b.vy += C.G;
  b.x += b.vx; b.y += b.vy;

  // Wall collisions
  if (b.x < C.BR) { b.x = C.BR; b.vx *= -0.8; }
  if (b.x > C.W - C.BR) { b.x = C.W - C.BR; b.vx *= -0.8; }

  // Goal Check (Ball touches floor/ceiling)
  if (b.y < -C.BR) return 1; // P1 scores
  if (b.y > C.H + C.BR) return 0; // P0 scores

  // Slime physics
  state.slimes.forEach((s, idx) => {
    const isTop = idx === 0;
    
    // Smooth Horizontal Movement
    const dx = s.tx - s.x;
    const maxStep = 12;
    const oldX = s.x;
    if (Math.abs(dx) > maxStep) s.x += Math.sign(dx) * maxStep;
    else s.x = s.tx;
    s.vx = s.x - oldX;

    // Apply gravity to slimes
    s.vy += C.G;
    s.y += s.vy;

    // Floor/Ceiling constraint for slimes
    if (isTop) {
      if (s.y > C.H/2 - 5) { s.y = C.H/2 - 5; s.vy = 0; }
      if (s.y < 0) { s.y = 0; s.vy = 0; }
    } else {
      if (s.y < C.H/2 + 5) { s.y = C.H/2 + 5; s.vy = 0; }
      if (s.y > C.H) { s.y = C.H; s.vy = 0; }
    }

    // Ball-Slime collision (Slime is a semicircle)
    const dx = b.x - s.x, dy = b.y - s.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < C.BR + C.SR) {
      // Normal vector
      const nx = dx / dist, ny = dy / dist;
      // Resolve overlap
      b.x = s.x + nx * (C.BR + C.SR);
      b.y = s.y + ny * (C.BR + C.SR);

      // Bounce
      const dot = (b.vx - s.vx) * nx + (b.vy - s.vy) * ny;
      b.vx = (b.vx - 1.5 * dot * nx) + s.vx;
      b.vy = (b.vy - 1.5 * dot * ny) + s.vy;
      
      // Keep speed in check
      const speed = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
      if (speed > C.MAXSPD) { b.vx = b.vx/speed*C.MAXSPD; b.vy = b.vy/speed*C.MAXSPD; }
    }
  });

  // Net collision (simple line at center)
  if (Math.abs(b.y - C.H/2) < C.BR) {
      if (Math.abs(b.x - C.W/2) < 40) { // Net width
         b.vy *= -1;
         b.y = (b.vy > 0) ? C.H/2 + C.BR : C.H/2 - C.BR;
      }
  }

  return null;
}

function move(state, idx, x, y) {
  const s = state.slimes[idx];
  const isTop = idx === 0;
  
  // Horizontal target
  s.tx = clamp(x, C.SR, C.W - C.SR);

  // Jump if tapping upper/lower area
  const shouldJump = isTop ? (y < 100) : (y > C.H - 100);
  if (shouldJump) {
    // Jump only if on the ground/ceiling (simple check)
    if (isTop && s.y >= C.H/2 - 10) s.vy = -C.JUMP; // actually jump is UP from middle
    if (!isTop && s.y >= C.H - 10) s.vy = C.JUMP; // jump is DOWN from bottom? No, UP.
    
    // Slime Volley vertical:
    // P1 (Bottom) jumps UP (-vy)
    // P0 (Top) jumps DOWN (+vy) relative to their goal? No, they jump TOWARDS the center.
    if (!isTop && s.y >= C.H - 1) s.vy = C.JUMP; 
    if (isTop && s.y <= 1) s.vy = -C.JUMP; // Jump down
  }
}

module.exports = { C, createState, launch, tick, move };
