/** HTML-escape a string */
export const esc = s =>
  String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/** Format ISO timestamp to locale time string */
export const fmtTime = iso => {
  try { return new Date(iso).toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit', second:'2-digit' }); }
  catch { return String(iso ?? ''); }
};

/** Clamp a value between lo and hi */
export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

/** Get / set localStorage with JSON */
export const session = {
  get: key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
  del: key => localStorage.removeItem(key),
};
