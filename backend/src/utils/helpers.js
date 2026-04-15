'use strict';
const clamp    = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const sanitize = s => String(s || '').replace(/[<>&"']/g, '').slice(0, 200);
const genToken = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const now      = () => new Date().toISOString();

module.exports = { clamp, sanitize, genToken, now };
