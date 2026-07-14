// scripts/probe-public-courses.cjs
const fetch = global.fetch;
const AUTH_EMU = 'http://127.0.0.1:9099';
const email = 'sahasra2069@gmail.com';
const password = 'StrongP@ss123';

(async () => {
  const si = await fetch(
    `${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=***`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, password, returnSecureToken: true}),
    },
  );
  const siBody = await si.json();
  console.log('firebase signin:', si.status);
  if (!siBody.idToken) { console.log('signin body:', JSON.stringify(siBody)); return; }
  const token = siBody.idToken;

  const pub = await fetch('http://127.0.0.1:3141/api/courses/public', {
    headers: {Authorization: `Bearer ${token}`},
  });
  const pubBody = await pub.text();
  console.log('GET /api/courses/public:', pub.status);
  console.log(pubBody);
})();
