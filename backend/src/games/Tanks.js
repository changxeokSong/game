'use strict';
const { clamp } = require('../utils/helpers');

const C = Object.freeze({
  W: 272, H: 480,
  TR: 18,       // tank radius
  BR: 4,        // bullet radius
  SPD: 6.4,
  BSPD: 15,     // bullet speed
  RELOAD: 2000, // auto-fire interval ms (2 seconds)
  BOUNCES: 3,   // max bounces before bullet disappears
  WIN: 3,
});

function createState() {
  return {
    tanks: [
      { x: C.W / 2, y: 80,       tx: C.W / 2, ty: 80,       hp: 3, lastFire: 0, color: '#ff6b6b' },
      { x: C.W / 2, y: C.H - 80, tx: C.W / 2, ty: C.H - 80, hp: 3, lastFire: 0, color: '#4ecdc4' },
    ],
    bullets: [],
    scores: [0, 0], phase: 'waiting', winner: null,
  };
}

function launch(state) {
  // Reset tanks to start positions — keep tx/ty in sync
  const starts = [
    { x: C.W / 2, y: 80 },
    { x: C.W / 2, y: C.H - 80 },
  ];
  state.tanks.forEach((t, i) => {
    t.x = t.tx = starts[i].x;
    t.y = t.ty = starts[i].y;
    t.hp = 3;
    t.lastFire = 0;
  });
  state.bullets = [];
}

function tick(state) {
  if (state.phase !== 'playing') return null;

  const now = Date.now();

  // ── Move tanks toward target (smooth) ────────────────────
  state.tanks.forEach((t, idx) => {
    const dx   = t.tx - t.x;
    const dy   = t.ty - t.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > C.SPD) {
      t.x += (dx / dist) * C.SPD;
      t.y += (dy / dist) * C.SPD;
    } else {
      t.x = t.tx;
      t.y = t.ty;
    }

    // Hard-clamp to own half
    t.x = clamp(t.x, C.TR, C.W - C.TR);
    if (idx === 0) t.y = clamp(t.y, C.TR, C.H / 2 - C.TR);
    else           t.y = clamp(t.y, C.H / 2 + C.TR, C.H - C.TR);

    // ── Auto-fire every RELOAD ms ──────────────────────────
    if (now - t.lastFire > C.RELOAD) {
      t.lastFire = now;
      const isTop   = idx === 0;
      const targetY = isTop ? C.H * 0.75 : C.H * 0.25;
      const dx2     = C.W / 2 - t.x;
      const dy2     = targetY - t.y;
      const d2      = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
      state.bullets.push({
        x:       t.x,
        y:       t.y + (isTop ? C.TR + 2 : -(C.TR + 2)),
        vx:      (dx2 / d2) * C.BSPD + (Math.random() - 0.5) * 2, // slight spread
        vy:      (dy2 / d2) * C.BSPD,
        owner:   idx,
        bounces: 0,
      });
    }
  });

  // ── Update bullets ────────────────────────────────────────
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bull = state.bullets[i];
    bull.x += bull.vx;
    bull.y += bull.vy;

    let removed = false;

    // Wall ricochet — max 1 bounce count per tick (corner bug fix)
    let bouncedThisTick = false;
    if (bull.x < C.BR)       { bull.x = C.BR;       bull.vx =  Math.abs(bull.vx); bull.bounces++; bouncedThisTick = true; }
    if (bull.x > C.W - C.BR) { bull.x = C.W - C.BR; bull.vx = -Math.abs(bull.vx); if (!bouncedThisTick) { bull.bounces++; bouncedThisTick = true; } }
    if (bull.y < C.BR)       { bull.y = C.BR;        bull.vy =  Math.abs(bull.vy); if (!bouncedThisTick) { bull.bounces++; bouncedThisTick = true; } }
    if (bull.y > C.H - C.BR) { bull.y = C.H - C.BR;  bull.vy = -Math.abs(bull.vy); if (!bouncedThisTick) { bull.bounces++; } }

    if (bull.bounces >= C.BOUNCES) {
      state.bullets.splice(i, 1);
      continue;
    }

    // Hit detection (skip owner's own tank)
    for (let j = 0; j < 2; j++) {
      if (bull.owner === j) continue;
      const t    = state.tanks[j];
      const dx   = bull.x - t.x;
      const dy   = bull.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < C.TR + C.BR) {
        t.hp--;
        state.bullets.splice(i, 1);
        removed = true;
        if (t.hp <= 0) return 1 - j; // the other player wins
        break;
      }
    }
    if (removed) continue;
  }

  return null;
}

/**
 * move(state, idx, x, y)
 * Drag/WASD controls tank position within own half.
 * Firing is now automatic — no manual fire trigger.
 */
function move(state, idx, x, y) {
  const t     = state.tanks[idx];
  const isTop = idx === 0;

  // Constrain target to own half
  t.tx = clamp(x, C.TR, C.W - C.TR);
  t.ty = isTop
    ? clamp(y, C.TR, C.H / 2 - C.TR)
    : clamp(y, C.H / 2 + C.TR, C.H - C.TR);
}

module.exports = { C, createState, launch, tick, move };
