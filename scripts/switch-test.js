const KEY = 'fake-api-key';
const FB_AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const BACKEND = 'http://127.0.0.1:3141/api';

async function main() {
  const email = 'all_' + Date.now() + '@example.com';
  const password = 'Test123!';

  const signupRes = await fetch(FB_AUTH + '/accounts:signUp?key=' + KEY, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password, returnSecureToken: true}),
  });
  const signup = await signupRes.json();
  if (!signup.idToken) {
    console.log('signup error:', JSON.stringify(signup));
    return;
  }
  const idToken = signup.idToken;
  console.log('user:', email);

  for (const animal of ['panda', 'fox', 'penguin', 'dog', 'cat', 'panda', 'fox']) {
    const res = await fetch(BACKEND + '/companion/me', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken},
      body: JSON.stringify({animal}),
    });
    const body = await res.text();
    const parsed = JSON.parse(body);
    console.log(`POST ${animal}: status=${res.status}, animal=${parsed.animal ?? 'MISSING'}, lastActive=${parsed.lastActiveAt}`);
  }

  // Invalid animal
  const badRes = await fetch(BACKEND + '/companion/me', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken},
    body: JSON.stringify({animal: 'unicorn'}),
  });
  const badBody = await badRes.text();
  console.log(`\nPOST unicorn: status=${badRes.status}, body=${badBody.slice(0, 200)}`);

  // Missing animal
  const noRes = await fetch(BACKEND + '/companion/me', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken},
    body: JSON.stringify({}),
  });
  const noBody = await noRes.text();
  console.log(`\nPOST {}: status=${noRes.status}, body=${noBody.slice(0, 200)}`);
}

main().catch(e => console.error('ERR:', e));