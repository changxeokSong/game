import { esc } from '../utils.js';

export class Chat {
  constructor(msgsId, inpId, ws) {
    this._msgs = document.getElementById(msgsId);
    this._inp  = document.getElementById(inpId);
    this._ws   = ws;

    if (this._inp) {
      this._inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') this.send();
      });
      // Also look for a button
      const btn = this._inp.parentElement.querySelector('button');
      if (btn) btn.onclick = () => this.send();
    }
  }

  append(m) {
    if (!this._msgs) return;
    const div = document.createElement('div');
    div.className = 'chat-entry' + (m.system ? ' system' : '');
    const who = m.system ? 'SYSTEM' : m.username;
    div.innerHTML = `<span class="who">${esc(who)}</span>${esc(m.msg)}`;
    this._msgs.appendChild(div);
    this._msgs.scrollTop = this._msgs.scrollHeight;
  }

  appendHistory(list) {
    if (!list) return;
    list.forEach(m => this.append(m));
  }

  clear() {
    if (this._msgs) this._msgs.innerHTML = '';
  }

  send() {
    const msg = this._inp.value.trim();
    if (!msg) return;
    this._ws.send({ type: 'chat', msg });
    this._inp.value = '';
  }
}
