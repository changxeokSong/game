import { WSClient } from '../ws.js';

const inp   = document.getElementById('name-inp');
const btn   = document.getElementById('enter-btn');
const errEl = document.getElementById('err');

// Auto-redirect if already logged in
if (sessionStorage.getItem('username')) location.replace('/lobby');

async function doLogin() {
  const name = inp.value.trim();
  if (!name) { errEl.textContent = '닉네임을 입력하세요.'; return; }

  btn.disabled    = true;
  btn.textContent = '연결 중…';
  errEl.textContent = '';

  const ws = new WSClient();
  try {
    await ws.connect();
    ws.on('login_ok', m => {
      sessionStorage.setItem('username', m.username);
      ws.close();
      location.href = '/lobby';
    });
    ws.on('login_error', m => {
      errEl.textContent = m.reason;
      btn.disabled    = false;
      btn.textContent = '입장하기';
      ws.close();
    });

    ws.send({ type: 'login', username: name });
  } catch (err) {
    errEl.textContent = '서버 연결 실패';
    btn.disabled    = false;
    btn.textContent = '입장하기';
  }
}

btn.addEventListener('click', doLogin);
inp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
