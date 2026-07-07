// scripts/repro-signup.js — reproduce what the AuthPage form does
const API = 'http://127.0.0.1:3141/api';
const AUTH_EMU = 'http://127.0.0.1:9099';
const API_KEY = '***';

const email = `repro_${Date.now()}@example.com`;
const password = 'StrongP@ss123';

async function http(url, init = {}) {
  const r = await fetch(url, init);
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch {}
  return { status: r.status, body: j, raw: t.slice(0, 500) };
}

(async () => {
  console.log('1) Firebase Auth emulator signup (what AuthPage does first)…');
  const su = await http(`${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=***`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  console.log('   status', su.status, 'localId?', su.body?.localId);
  if (su.status !== 200) { console.log(su.raw); process.exit(1); }
  const idToken = su.body.idToken;

  console.log('\n2) POST /api/auth/signup (backend user creation)…');
  const reg = await http(`${API}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ email, password, firstName: 'Repro', lastName: 'User', recaptchaToken: '***' }),
  });
  console.log('   status', reg.status, 'body:', JSON.stringify(reg.body));
  if (reg.status >= 400) console.log('   raw:', reg.raw);

  console.log('\n3) GET /api/companion/me with the new idToken…');
  const me = await http(`${API}/companion/me`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  console.log('   status', me.status, 'body:', JSON.stringify(me.body));

  console.log('\nemail used:', email);
})();