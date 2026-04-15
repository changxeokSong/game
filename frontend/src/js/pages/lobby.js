import { WSClient } from '../ws.js';
import { session } from '../utils.js';
import { Chat } from '../components/Chat.js';
import { setupEasterEgg } from '../easter-egg.js';

const username = session.get('username');
if (!username) location.replace('/');

const ws = new WSClient();
const chat = new Chat('chat-msgs', 'chat-inp', ws);

let rankings = {};
let games = [];
let curRankGame = '';

async function init() {
  try {
    await ws.connect();

    ws.on('login_ok', m => {
      games = m.games;
      rankings = m.rankings;
      renderGames();
      renderRankTabs();
      chat.appendHistory(m.chatHistory);
    });

    ws.on('login_error', () => {
      sessionStorage.removeItem('username');
      location.replace('/');
    });

    ws.on('user_list', m => {
      renderUsers(m.users);
    });

    ws.on('chat', m => {
      chat.append(m);
    });

    ws.on('rankings_all', m => {
      rankings = m.data;
      renderRankings(curRankGame);
    });

    ws.on('kicked', m => {
      alert('Kicked: ' + m.reason);
      sessionStorage.clear();
      location.replace('/');
    });

    ws.on('admin_granted', m => {
      session.set('adminToken', m.token);
      location.href = '/admin.html';
    });

    ws.on('admin_denied', () => {
      alert('Admin access denied');
    });

    ws.send({ type: 'login', username });

  } catch (err) {
    console.error('WS Error:', err);
  }
}

function renderGames() {
  const el = document.getElementById('game-list');
  el.innerHTML = '';
  games.forEach(g => {
    const div = document.createElement('div');
    div.className = 'game-item card clickable';
    div.innerHTML = `
      <div class="game-icon">${g.icon}</div>
      <div class="game-info">
        <div class="game-name">${g.name}</div>
        <div class="game-desc">${g.desc}</div>
      </div>
      <div class="game-arrow">›</div>
    `;
    div.onclick = () => {
      ws.close();
      sessionStorage.setItem('gameId', g.id);
      location.href = `/game?id=${g.id}`;
    };
    el.appendChild(div);
  });
}

function renderRankTabs() {
  const el = document.getElementById('rank-tabs');
  el.innerHTML = '';
  Object.keys(rankings).forEach(gid => {
    const btn = document.createElement('button');
    btn.className = 'rank-tab' + (gid === curRankGame ? ' active' : '');
    btn.textContent = games.find(g => g.id === gid)?.name || gid;
    btn.onclick = () => {
      curRankGame = gid;
      renderRankings(gid);
      renderRankTabs();
    };
    if (!curRankGame) curRankGame = gid;
    el.appendChild(btn);
  });
  renderRankings(curRankGame);
}

function renderRankings(gid) {
  const tbody = document.getElementById('rank-tbody');
  const data = rankings[gid] || [];
  tbody.innerHTML = '';
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">기록 없음</td></tr>';
    return;
  }
  data.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === 0) tr.className = 'gold';
    else if (i === 1) tr.className = 'silver';
    else if (i === 2) tr.className = 'bronze';
    tr.innerHTML = `
      <td class="rank-num">${i + 1}</td>
      <td class="rank-name">${esc(r.name)}</td>
      <td class="rank-win">${r.wins}</td>
      <td class="rank-loss">${r.losses}</td>
      <td class="rank-rate">${r.rate}%</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderUsers(users) {
  document.getElementById('online-count').textContent = `● ${users.length} online`;
  const el = document.getElementById('user-list');
  el.innerHTML = '';
  users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'user-badge';
    const inGame = u.room !== 'lobby';
    div.innerHTML = `
      <span class="user-dot ${inGame ? 'ingame' : ''}"></span>
      <span class="user-name">${esc(u.username)}</span>
    `;
    el.appendChild(div);
  });
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.logout = () => {
  session.del('username');
  session.del('adminToken');
  ws.close();
  location.replace('/');
};

setupEasterEgg(() => {
  ws.send({ type: 'admin_auth', code: 'anggimotti' });
});

init();
