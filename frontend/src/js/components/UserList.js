import { esc } from '/js/utils.js';

/** Renders online users as small badges into the given element. */
export class UserList {
  constructor(el) { this._el = el; }

  render(users) {
    if (!this._el) return;
    this._el.innerHTML = '';
    for (const u of users) {
      const d = document.createElement('span');
      d.className = 'user-badge';
      d.innerHTML = `<span class="user-dot${u.room !== 'lobby' ? ' ingame' : ''}"></span>${esc(u.username)}`;
      this._el.appendChild(d);
    }
  }
}
