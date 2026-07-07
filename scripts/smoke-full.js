// scripts/smoke-full.js — broad end-to-end probe of every endpoint the
// AuthPage/Dashboard hits in the signup + first-login path. Exits non-zero
// on any failure. Reuses the saved smoke user if present.

const fs = require('fs');
const path = require('path');

const STATE = path.join(__dirname, '.smoke-state.json');
const BACKEND = 'http://127.0.0.1:3141';
const API = `${BACKEND}/api`;
const AUTH_EMU = 'http://127.0.0.1:9099';
const API_KEY = '***';

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const email = `full_${stamp}@example.com`;
const password = 'StrongP@ss123';

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return null; }
}
function saveState(s) { fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); }

async function http(url, init = {}) {
  const r = await fetch(url, init);
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch {}
  return { status: r.status, body: j, raw: t.slice(0, 600) };
}
function ok(label, cond, detail) {
  const icon = cond ? '✅' : '❌';
  console.log(`${icon} ${label}${detail ? ' — ' + detail : ''}`);
  if (!cond) process.exitCode = 1;
}

(async () => {
  console.log(`Backend: ${API}\n`);

  let st = loadState();
  let idToken;

  if (st && st.idToken) {
    console.log('→ Reusing saved smoke user');
    idToken = st.idToken;
  } else {
    console.log('→ 1. Firebase Auth emulator signup…');
    const su = await http(`${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=***`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    ok('Firebase signUp 200', su.status === 200);
    if (su.status !== 200) return console.log(su.raw);
    idToken = su.body.idToken;

    console.log('\n→ 2. POST /api/auth/signup (now with fix)…');
    const reg = await http(`${API}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ email, password, firstName: 'Full', lastName: 'Smoke', recaptchaToken: '***' }),
    });
    ok('POST /api/auth/signup 201', reg.status === 201, `got ${reg.status}`);
    if (reg.status === 201) ok('userId present', typeof reg.body.userId === 'string');

    saveState({ email, password, idToken, userId: reg.body.userId, createdAt: new Date().toISOString() });
  }

  const auth = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };

  console.log('\n→ 3. GET /api/auth/me (current user)…');
  const me = await http(`${API}/auth/me`, { headers: auth });
  console.log('   ', me.status, JSON.stringify(me.body)?.slice(0, 120));
  ok('GET /api/auth/me 200|401|404 (any non-500)', me.status < 500, `got ${me.status}`);

  console.log('\n→ 4. GET /api/companion/me (no pick yet)…');
  const c0 = await http(`${API}/companion/me`, { headers: auth });
  ok('GET /api/companion/me 200|204', c0.status === 200 || c0.status === 204, `got ${c0.status}`);

  console.log('\n→ 5. POST /api/companion/me { animal: "fox" }…');
  const c1 = await http(`${API}/companion/me`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ animal: 'fox' }),
  });
  ok('POST /api/companion/me 200', c1.status === 200, `got ${c0.status}`);
  ok('animal=fox', c1.body?.animal === 'fox');

  console.log('\n→ 6. GET /api/companion/me (after pick)…');
  const c2 = await http(`${API}/companion/me`, { headers: auth });
  ok('GET /api/companion/me 200', c2.status === 200);
  ok('animal=fox persisted', c2.body?.animal === 'fox');

  console.log('\n→ 7. POST /api/companion/me { animal: "dinosaur" } (bad animal → 400)…');
  const cBad = await http(`${API}/companion/me`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ animal: 'dinosaur' }),
  });
  ok('POST bad animal 400', cBad.status === 400);

  console.log('\n→ 8. Auth with bogus token → 401…');
  const bogus = await http(`${API}/companion/me`, {
    headers: { Authorization: 'Bearer not-a-real-token' },
  });
  ok('GET /api/companion/me with bogus token 401', bogus.status === 401, `got ${bogus.status}`);

  console.log('\n→ 9. Auth with no token → 401…');
  const noTok = await http(`${API}/companion/me`);
  ok('GET /api/companion/me no token 401', noTok.status === 401, `got ${noTok.status}`);

  console.log('\nDone.');
})().catch(e => { console.error('crash:', e); process.exit(1); });