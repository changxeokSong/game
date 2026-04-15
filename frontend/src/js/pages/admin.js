import { WSClient } from '../ws.js';
import { session } from '../utils.js';

const username = session.get('username');
const adminToken = session.get('adminToken');
if (!username || !adminToken) location.replace('/');

const ws = new WSClient();
let data = null;

async function init() {
  try {
    await ws.connect();

    ws.on('login_ok', () => {
      ws.send({ type: 'admin_auth_token', token: adminToken });
    });

    ws.on('admin_ok', m => {
      data = m.data;
      renderAll();
    });

    ws.on('admin_denied', () => {
      alert('Access Denied');
      session.del('adminToken');
      location.replace('/lobby');
    });

    ws.on('rankings_all', m => {
      if (data) { data.rankings = m.data; renderRankings(); }
    });

    ws.send({ type: 'login', username });

  } catch (err) {
    console.error('Admin WS Error:', err);
  }
}

function renderAll() {
  renderOverview();
  renderUsers();
  renderRankings();
  renderChatLog();
  renderLogs();
}

function renderOverview() {
  const d = data;
  const stats = [
    { label: 'ONLINE', value: d.onlineUsers.filter(u => u.username).length },
    { label: 'ROOMS', value: d.rooms.length },
    { label: 'USERS', value: d.dbUsers },
    { label: 'CHATS', value: d.chatHistory.length }
  ];
  const grid = document.getElementById('stat-grid');
  grid.innerHTML = stats.map(s => `
    <div class="stat-card card clickable">
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');

  const tbody = document.getElementById('rooms-tbody');
  tbody.innerHTML = d.rooms.map(r => `
    <tr>
      <td>${esc(r.id.slice(0, 8))}</td>
      <td>${esc(r.gameId)}</td>
      <td>${r.players}/2</td>
      <td><span class="badge ${r.phase === 'playing' ? 'playing' : ''}">${r.phase}</span></td>
      <td>${r.scores[0]} : ${r.scores[1]}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="empty">No active rooms</td></tr>';
}

function renderUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = data.onlineUsers.filter(u => u.username).map(u => `
    <tr>
      <td><strong>${esc(u.username)}</strong>${u.isAdmin ? ' <span class="tag admin">ADM</span>' : ''}</td>
      <td>${esc(u.room)}</td>
      <td class="dim">${fmtTime(u.joinedAt)}</td>
      <td><button class="btn red sm" onclick="kickUser('${esc(u.username)}')">KICK</button></td>
    </tr>
  `).join('');
}

function renderRankings() {
  const wrap = document.getElementById('rankings-wrap');
  wrap.innerHTML = Object.entries(data.rankings).map(([gid, rows]) => `
    <div class="admin-section">
      <div class="section-header">
        <h3 class="section-label">${esc(gid)}</h3>
        <button class="btn red sm" onclick="resetRankings('${esc(gid)}')">RESET</button>
      </div>
      <table class="rank-table card">
        <thead><tr><th>#</th><th>USER</th><th>W</th><th>L</th><th>%</th></tr></thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${esc(r.name)}</td>
              <td class="win">${r.wins}</td>
              <td class="loss">${r.losses}</td>
              <td>${r.rate}%</td>
            </tr>
          `).join('') || '<tr><td colspan="5" class="empty">No records</td></tr>'}
        </tbody>
      </table>
    </div>
  `).join('');
}

function renderChatLog() {
  const el = document.getElementById('chat-log');
  el.innerHTML = data.chatHistory.map(m => `
    <div class="log-entry chat">
      <span class="log-ts">${fmtTime(m.ts)}</span>
      <span class="log-who">${esc(m.username)}</span>
      <span class="log-room">[${esc(m.room)}]</span>
      <span class="log-msg">${esc(m.msg)}</span>
    </div>
  `).join('');
  el.scrollTop = el.scrollHeight;
}

function renderLogs() {
  const el = document.getElementById('admin-logs');
  el.innerHTML = [...data.adminLogs].reverse().map(l => `
    <div class="log-entry admin">
      <span class="log-ts">${fmtTime(l.ts)}</span>
      <span class="log-act">${esc(l.action)}</span>
      ${l.by ? `by <strong>${esc(l.by)}</strong>` : ''}
      ${l.target ? ` → <span class="target">${esc(l.target)}</span>` : ''}
    </div>
  `).join('');
}

window.switchTab = (id) => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${id}`));
};

window.kickUser = (name) => {
  const reason = prompt(`Reason to kick ${name}:`);
  if (reason !== null) ws.send({ type: 'admin_kick', username: name, reason: reason || 'Kicked by admin' });
};

window.clearChat = () => {
  if (confirm('Clear all chat history?')) ws.send({ type: 'admin_clear_chat' });
};

window.resetRankings = (gid) => {
  if (confirm(`Reset rankings for ${gid || 'ALL'}?`)) ws.send({ type: 'admin_reset_rankings', gameId: gid });
};

window.sendBroadcast = () => {
  const inp = document.getElementById('bc-inp');
  const msg = inp.value.trim();
  if (!msg) return;
  ws.send({ type: 'admin_broadcast', msg });
  inp.value = '';
};

window.refresh = () => ws.send({ type: 'admin_refresh' });
window.goBack = () => { ws.close(); location.href = '/lobby'; };

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return iso || ''; }
}

init();
