import { esc } from '/js/utils.js';

/** Renders a rankings table + game-select tabs. */
export class Rankings {
  constructor(tbodyEl, tabsEl) {
    this._tbody = tbodyEl;
    this._tabs  = tabsEl;
    this._data  = {};
    this._games = [];
    this._cur   = '';
  }

  /** Feed new data + games list, re-render. */
  update(data, games) {
    this._data  = data;
    this._games = games;
    if (!this._cur && games.length) this._cur = games[0].id;
    this._renderTabs();
    this._renderTable(this._cur);
  }

  /** Switch to a specific game's tab. */
  show(gameId) {
    this._cur = gameId;
    this._renderTabs();
    this._renderTable(gameId);
  }

  _renderTabs() {
    if (!this._tabs) return;
    this._tabs.innerHTML = '';
    for (const g of this._games) {
      const b = document.createElement('button');
      b.className = 'rank-tab' + (g.id === this._cur ? ' active' : '');
      b.textContent = g.name;
      b.onclick = () => this.show(g.id);
      this._tabs.appendChild(b);
    }
  }

  _renderTable(gid) {
    if (!this._tbody) return;
    const rows = this._data[gid] || [];
    if (!rows.length) {
      this._tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--sub);padding:10px;font-size:.72rem;">기록 없음</td></tr>';
      return;
    }
    const medals = ['gold', 'silver', 'bronze'];
    this._tbody.innerHTML = rows.map((r, i) => `
      <tr class="${medals[i] || ''}">
        <td class="dim">${i + 1}</td>
        <td>${esc(r.name)}</td>
        <td class="win">${r.wins}</td>
        <td class="loss">${r.losses}</td>
        <td>${r.rate}%</td>
      </tr>`).join('');
  }
}
