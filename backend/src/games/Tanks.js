'use strict';
const { clamp } = require('../utils/helpers');

const C = Object.freeze({
  W: 272, H: 480,
  TR: 18,     // tank radius
  BR: 4,      // bullet radius
  SPD: 3,
  BSPD: 6,    // bullet speed
  RELOAD: 800, // reload ms
  WIN: 3,
});

function createState() {
  return {
    tanks: [
      { x: C.W * 0.2, y: 80,       tx: C.W * 0.2, ty: 80,       hp: 3, lastFire: 0, color: '#ff6b6b' },
      { x: C.W * 0.8, y: C.H - 80, tx: C.W * 0.8, ty: C.H - 80, hp: 3, lastFire: 0, color: '#4ecdc4' },
    ],
    bullets: [],
    scores: [0, 0], phase: 'waiting', winner: null,
  };
}

function launch(state) {
  state.tanks[0].x = C.W / 2; state.tanks[0].y = 60;      state.tanks[0].hp = 3;
  state.tanks[1].x = C.W / 2; state.tanks[1].y = C.H - 60; state.tanks[1].hp = 3;
  state.bullets = [];
}

function tick(state) {
  if (state.phase !== 'playing') return null;

  // Move tanks (Smoothing)
  state.tanks.forEach(t => {
    const dx = t.tx - t.x, dy = t.ty - t.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxStep = 10;
    if (dist > maxStep) {
      t.x += (dx / dist) * maxStep;
      t.y += (dy / dist) * maxStep;
    } else {
      t.x = t.tx;
      t.y = t.ty;
    }
  });

  // Update Bullets
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx; b.y += b.vy;

    // Wall Ricochet
    if (b.x < C.BR || b.x > C.W - C.BR) { b.vx *= -1; b.bounces++; }
    // Only bounce off top/bottom if they don't count as goals?
    // Actually, bullets should disappear at goals.
    if (b.y < -50 || b.y > C.H + 50) {
      state.bullets.splice(i, 1);
      continue;
    }

    if (b.bounces > 2) {
      state.bullets.splice(i, 1);
      continue;
    }

    // Hit Detection
    for (let j = 0; j < 2; j++) {
      if (b.owner === j) continue;
      const t = state.tanks[j];
      const dist = Math.sqrt((b.x - t.x)**2 + (b.y - t.y)**2);
      if (dist < C.TR + C.BR) {
        t.hp--;
        state.bullets.splice(i, 1);
        if (t.hp <= 0) return 1 - j; // Opponent wins
        break;
      }
    }
  }

  return null;
}

function move(state, idx, x, y) {
  const t = state.tanks[idx];
  const isTop = idx === 0;

  // Set target position (constrained to half)
  t.tx = clamp(x, C.TR, C.W - C.TR);
  if (isTop) t.ty = clamp(y, C.TR, C.H / 2 - 20);
  else       t.ty = clamp(y, C.H / 2 + 20, C.H - C.TR);

  // Fire if tapping own goal area / far side
  const shouldFire = (isTop && y > C.H/2 - 20) || (!isTop && y < C.H/2 + 20);
  const now = Date.now();
  if (shouldFire && now - t.lastFire > C.RELOAD) {
    t.lastFire = now;
    state.bullets.push({
      x: t.x,
      y: isTop ? t.y + C.TR + 10 : t.y - C.TR - 10,
      vx: (Math.random() - 0.5), // slight inaccuracy
      vy: isTop ? C.BSPD : -C.BSPD,
      owner: idx,
      bounces: 0
    });
  }
}

module.exports = { C, createState, launch, tick, move };
