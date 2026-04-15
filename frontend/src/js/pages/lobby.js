import '/js/viewport.js';
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
      renderRoomList(m.roomList || []);
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

    ws.on('room_list', m => {
      renderRoomList(m.rooms);
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

    const fromGame = session.get('fromGame');
  session.del('fromGame'); // Reset flag
  ws.send({ type: 'login', username, context: 'lobby', fromGame, silent: !!session.get('adminToken') });

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
      <div class="info-btn" title="How to play">i</div>
      <div class="game-arrow">›</div>
    `;
    div.onclick = (e) => {
      if (e.target.classList.contains('info-btn')) return;
      ws.close();
      sessionStorage.setItem('gameId', g.id);
      location.href = `/game?id=${g.id}`;
    };
    div.querySelector('.info-btn').onclick = (e) => {
      e.stopPropagation();
      openGuide(g.id);
    };
    el.appendChild(div);
  });
}

function renderRoomList(rooms) {
  const el = document.getElementById('room-list');
  if (!el) return;
  el.innerHTML = ''; // Clear
  if (!rooms.length) {
    el.innerHTML = '<div class="empty-msg card">현재 진행 중인 경기가 없습니다.</div>';
    return;
  }
  rooms.forEach(r => {
    const div = document.createElement('div');
    div.className = 'room-card card';
    const isFull = r.players >= 2;
    const p1 = r.playerNames[0] || '...';
    const p2 = r.playerNames[1] || '...';
    
    div.innerHTML = `
      <div class="room-info">
        <div class="room-game">${esc(r.gameId.toUpperCase())}</div>
        <div class="room-matchup">
          <span class="p-name">${esc(p1)}</span>
          <span class="vs">vs</span>
          <span class="p-name">${esc(p2)}</span>
        </div>
        <div class="room-stats">${r.scores[0]} : ${r.scores[1]} (${r.spectators} watching)</div>
      </div>
      <button class="btn ${isFull ? 'sub' : 'primary'} sm">
        ${isFull ? 'SPECTATE' : 'JOIN'}
      </button>
    `;
    div.querySelector('button').onclick = () => {
      ws.close();
      session.set('gameId', r.gameId);
      location.href = `/game?id=${r.gameId}&roomId=${r.id}`;
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

const GUIDES = {
  'air-hockey': {
    goal: '7점을 먼저 득점하면 승리합니다.',
    pc: '<span class="key-box">Mouse</span> 이동으로 퍽을 칩니다.',
    mobile: '드래그하여 퍽을 칩니다.'
  },
  'pong': {
    goal: '공을 받아치고 상대가 놓치게 하여 7점을 득점하세요.',
    pc: '<span class="key-box">Mouse</span> 위아래 이동으로 패들을 조작합니다.',
    mobile: '드래그하여 패들을 조작합니다.'
  },
  'tron': {
    goal: '자신의 꼬리나 벽에 부딪히지 않고 끝까지 살아남으세요.',
    pc: '<span class="key-box">A</span> <span class="key-box">D</span> 또는 방향키로 90도 회전.',
    mobile: '화면 왼쪽/오른쪽을 탭하여 회전.'
  },
  'tanks': {
    goal: '상대 탱크를 3번 맞춰 파괴하세요. 포탄은 벽에 튕깁니다.',
    pc: '<span class="key-box">WASD</span> 이동, <span class="key-box">Space</span> 발사.',
    mobile: '하단 드래그 이동, 상단 탭 발사.'
  },
  'volley': {
    goal: '공이 자신의 진영 바닥에 닿지 않게 하세요. 7점 선승.',
    pc: '<span class="key-box">A</span> <span class="key-box">D</span> 이동, <span class="key-box">W</span> 또는 <span class="key-box">Space</span> 점프.',
    mobile: '드래그 이동, 상단 탭 점프.'
  },
  'breakers': {
    goal: '중앙의 블록을 깨서 점수를 얻으세요. 고득점 승리.',
    pc: '<span class="key-box">Mouse</span> 이동으로 패들을 조작합니다.',
    mobile: '드래그하여 패들을 조작합니다.'
  }
};

function openGuide(id) {
  const g = games.find(x => x.id === id);
  const info = GUIDES[id];
  if (!g || !info) return;

  document.getElementById('guide-title').textContent = `${g.icon} ${g.name} GUIDE`;
  document.getElementById('guide-body').innerHTML = `
    <div class="guide-item">
      <div class="guide-label">Mission</div>
      <div class="guide-val">${info.goal}</div>
    </div>
    <div class="guide-item">
      <div class="guide-label">PC Controls</div>
      <div class="guide-val">${info.pc}</div>
    </div>
    <div class="guide-item">
      <div class="guide-label">Mobile Controls</div>
      <div class="guide-val">${info.mobile}</div>
    </div>
  `;
  document.getElementById('guide-modal').classList.add('show');
}

window.closeGuide = () => {
  document.getElementById('guide-modal').classList.remove('show');
};

init();
