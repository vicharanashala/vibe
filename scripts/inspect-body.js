const FIREBASE_API_KEY = 'fake-api-key';
const FB_AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const BACKEND = 'http://127.0.0.1:3141/api';
const fs = require('fs');

async function main() {
  const email = 'inspect_' + Date.now() + '@example.com';
  const password = 'Test123!';

  const signupRes = await fetch(`${FB_AUTH}/accounts:signUp?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password, returnSecureToken: true}),
  });
  const signup = await signupRes.json();
  if (!signup.idToken) {
    console.log('signup error:', JSON.stringify(signup, null, 2));
    return;
  }
  const idToken = signup.idToken;
  console.log('user:', email);

  let res = await fetch(`${BACKEND}/companion/me`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`},
    body: JSON.stringify({animal: 'panda'}),
  });
  let body = await res.text();
  console.log('\nPOST status:', res.status);
  console.log('headers:', JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));
  console.log('body:', body);
}

main().catch(e => console.error('ERR:', e));