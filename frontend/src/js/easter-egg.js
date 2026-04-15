/**
 * Detects the "anggimotti" key sequence on any page and triggers
 * the provided callback.  Ignores keystrokes that land in input fields.
 */
export function setupEasterEgg(onDetected) {
  const CODE = 'anggimotti';
  let buf    = '';

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    buf += e.key.toLowerCase();
    if (buf.length > CODE.length) buf = buf.slice(-CODE.length);
    if (buf === CODE) { buf = ''; onDetected(); }
  });
}
