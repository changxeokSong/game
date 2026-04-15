'use strict';
const { clamp } = require('../utils/helpers');

/** Neon Tron — 272 × 480 portrait */
const C = Object.freeze({
  W: 272, H: 480,
  SPEED: 2.5,
  WIN: 3,
});

function createState() {
  return {
    players: [
      { x: C.W / 2, y: 80,       dir: 'down',  trail: [], color: '#ff6b6b' },
      { x: C.W / 2, y: C.H - 80, dir: 'up',    trail: [], color: '#4ecdc4' },
    ],
    scores: [0, 0], phase: 'waiting', winner: null,
  };
}

function launch(state) {
  state.players[0].x = C.W / 2; state.players[0].y = 80;       state.players[0].dir = 'down'; state.players[0].trail = [];
  state.players[1].x = C.W / 2; state.players[1].y = C.H - 80; state.players[1].dir = 'up';   state.players[1].trail = [];
}

function tick(state) {
  if (state.phase !== 'playing') return null;

  for (let i = 0; i < 2; i++) {
    const p = state.players[i];
    // Add current position to trail
    p.trail.push({ x: p.x, y: p.y });

    // Move
    if (p.dir === 'up')    p.y -= C.SPEED;
    if (p.dir === 'down')  p.y += C.SPEED;
    if (p.dir === 'left')  p.x -= C.SPEED;
    if (p.dir === 'right') p.x += C.SPEED;

    // Check Wall Collision
    if (p.x < 0 || p.x > C.W || p.y < 0 || p.y > C.H) return 1 - i; // Opponent scores
  }

  // Check Self/Opponent Trail Collision
  for (let i = 0; i < 2; i++) {
    const p = state.players[i];
    for (let j = 0; j < 2; j++) {
      const target = state.players[j];
      // Check collision with trail
      // To prevent colliding with the very last point added (ourselves):
      const limit = (i === j) ? target.trail.length - 10 : target.trail.length;
      for (let k = 0; k < limit; k += 2) { // Optimize: check every 2nd point
        const dot = target.trail[k];
        const dist2 = Math.pow(p.x - dot.x, 2) + Math.pow(p.y - dot.y, 2);
        if (dist2 < 20) return 1 - i; // Collision! Opponent scores
      }
    }
  }

  return null;
}

const DIRS = ['up', 'right', 'down', 'left'];
function move(state, idx, x, y) {
  const p = state.players[idx];
  // Controls: Tap left half to rotate CCW, right half to rotate CW
  let curIdx = DIRS.indexOf(p.dir);
  if (x < C.W / 2) {
    curIdx = (curIdx + 3) % 4; // CCW
  } else {
    curIdx = (curIdx + 1) % 4; // CW
  }
  p.dir = DIRS[curIdx];
}

module.exports = { C, createState, launch, tick, move };
