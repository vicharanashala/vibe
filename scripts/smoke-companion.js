// scripts/smoke-companion.js
// Live smoke test: signup → /companion/me → select animal → /companion/me again.
// Exits 0 on success, 1 on failure. Reads/writes scripts/.smoke-state.json
// so the user can rerun and pick up where they left off.

const fs = require('fs');
const path = require('path');

const STATE = path.join(__dirname, '.smoke-state.json');
const BACKEND = 'http://127.0.0.1:3141';
const API = `${BACKEND}/api`;
const AUTH = 'http://127.0.0.1:9099';
const API_KEY = 'fake-api-key';

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const email = `smoke_${stamp}@example.com`;
const password = 'StrongP@ss123';
const fullName = 'Smoke Test';

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return null; }
}
function saveState(s) { fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); }

async function http(url, init = {}) {
  const r = await fetch(url, init);
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch { /* leave j=null */ }
  return { status: r.status, body: j, raw: t };
}

function ok(label, cond, detail) {
  const icon = cond ? '✅' : '❌';
  console.log(`${icon} ${label}${detail ? ' — ' + detail : ''}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  console.log(`Backend: ${BACKEND}\n`);

  // 0. Reachability probe (no auth required)
  const unreachable = await http(`${BACKEND}/companion/me`).catch(e => ({status: 0, body: null, raw: e.message}));
  ok('Backend responds', unreachable.status !== 0, `status=${unreachable.status}`);

  let st = loadState();
  let idToken;

  if (st && st.idToken) {
    console.log('\n→ Reusing saved smoke user from', STATE);
    idToken = st.idToken;
  } else {
    // 1. Sign up with the Firebase Auth emulator
    console.log('\n→ Signing up smoke user with Firebase Auth emulator…');
    const signUp = await http(
      `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    ok('Firebase signUp 200', signUp.status === 200, `status=${signUp.status}`);
    if (signUp.status !== 200) {
      console.log(signUp.raw);
      process.exit(1);
    }
    idToken = signUp.body.idToken;

    // 2. Create the backend user via the app's /auth/signup flow so it
    //    exists in our MongoDB. The /companion/me endpoint requires the
    //    caller to be a known user.
    console.log('\n→ Registering smoke user in backend (POST /auth/signup)…');
    const reg = await http(`${API}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ email, password, firstName: 'Smoke', lastName: 'Test', recaptchaToken: '***' }),
    });
    // 200|201 = created, 409 = already exists (also fine for smoke),
    // 500 with EMAIL_EXISTS = Firebase already has the user (also fine — token still valid)
    const regOk =
      reg.status === 200 || reg.status === 201 || reg.status === 409 ||
      (reg.status === 500 && reg.body && /already in use/i.test(reg.body.message || ''));
    ok(`Backend signup 200|201|409 (got ${reg.status})`, regOk);
    if (!regOk) console.log(reg.raw);

    saveState({ email, password, idToken, createdAt: new Date().toISOString() });
  }

  const auth = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };

  // 3. GET /companion/me — should return 204/null body (no companion yet)
  console.log('\n→ GET /companion/me (expect 204/200 + null body, hasSelected=false)…');
  const initial = await http(`${API}/companion/me`, { headers: auth });
  ok(`GET /companion/me 200|204 (got ${initial.status})`, initial.status === 200 || initial.status === 204);
  ok('Response body is null/empty (no companion picked yet)', initial.body === null || initial.body === undefined, `body=${JSON.stringify(initial.body)}`);

  // 4. POST /companion/me { animal: "panda" }
  console.log('\n→ POST /companion/me with animal=panda…');
  const pick = await http(`${API}/companion/me`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ animal: 'panda' }),
  });
  ok(`POST /companion/me 200 (got ${pick.status})`, pick.status === 200);
  ok('animal=panda in response', pick.body && pick.body.animal === 'panda', `body=${JSON.stringify(pick.body)}`);

  // 5. GET /companion/me — should now return the picked companion
  console.log('\n→ GET /companion/me (expect picked companion)…');
  const again = await http(`${API}/companion/me`, { headers: auth });
  ok(`GET /companion/me 200 (got ${again.status})`, again.status === 200);
  ok('Response body is non-null', again.body !== null, `body=${JSON.stringify(again.body)}`);
  ok('animal=panda persisted', again.body && again.body.animal === 'panda');

  // 6. Bad animal — should 400
  console.log('\n→ POST /companion/me with animal=dinosaur (expect 400)…');
  const bad = await http(`${API}/companion/me`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ animal: 'dinosaur' }),
  });
  ok(`POST bad animal 400 (got ${bad.status})`, bad.status === 400);

  console.log('\nDone. Smoke state at', STATE);
}

main().catch(e => { console.error('Smoke crashed:', e); process.exit(1); });