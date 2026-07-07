// scripts/probe-204.js — check if /api/companion/me returns 204 for a fresh user.
const fs = require('fs');
const path = require('path');
const STATE = path.join(__dirname, '.smoke-state.json');
const BACKEND = 'http://127.0.0.1:3141';
const API = `${BACKEND}/api`;
const AUTH_EMU = 'http://127.0.0.1:9099';
const API_KEY = '***';

const email = `fresh_${Date.now()}@example.com`;
const password = 'StrongP@ss123';

async function http(url, init = {}) {
  const r = await fetch(url, init);
  const t = await r.text();
  return { status: r.status, body: t };
}

(async () => {
  // signup
  const su = await http(`${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=***`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  console.log('firebase signUp:', su.status);
  const idToken = JSON.parse(su.body).idToken;
  await http(`${API}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ email, password, firstName: 'Fresh', lastName: 'User', recaptchaToken: '***' }),
  });
  const me = await http(`${API}/companion/me`, { headers: { Authorization: `Bearer ${idToken}` } });
  console.log('/companion/me (fresh):', me.status, 'body len:', me.body.length, 'body:', JSON.stringify(me.body).slice(0, 80));
  console.log('email:', email);
})();