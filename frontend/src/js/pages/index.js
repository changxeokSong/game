import { WSClient }      from '/js/ws.js';
import { session }       from '/js/utils.js';
import { setupEasterEgg } from '/js/easter-egg.js';

// Already logged in → skip to lobby
if (session.get('username')) location.replace('/lobby.html');

const ws  = new WSClient();
const inp = document.getElementById('name-inp');
const btn = document.getElementById('enter-btn');
const err = document.getElementById('err');

async function login() {
  const name = inp.value.trim();
  if (!name) { err.textContent = '닉네임을 입력하세요.'; return; }
  btn.disabled = true; btn.textContent = '…';
  err.textContent = '';

  try {
    await ws.connect();
    ws.on('login_ok', m => {
      session.set('username', m.username);
      ws.close();
      location.href = '/lobby.html';
    });
    ws.on('login_error', m => {
      err.textContent = m.reason;
      btn.disabled = false; btn.textContent = '입장';
      ws.close();
    });
    ws.send({ type: 'login', username: name });
  } catch {
    err.textContent = '서버 연결 실패';
    btn.disabled = false; btn.textContent = '입장';
  }
}

btn.addEventListener('click', login);
inp.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

// Easter egg: requires login first
setupEasterEgg(() => { inp.value = ''; err.textContent = '먼저 입장하세요.'; });
