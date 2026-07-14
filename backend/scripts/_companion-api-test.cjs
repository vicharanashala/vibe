// Call GET /api/companion/me with a real Bearer token
// Replace PASTE_YOUR_TOKEN_HERE with the actual eyJ... value from DevTools
// DevTools → Network → any /api/companion/me request → Headers → Authorization → copy full value after "Bearer "
const TOKEN = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJuYW1lIjoicGFuZHUiLCJlbWFpbCI6InNhaGFzcmEyMDY5QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiYXV0aF90aW1lIjoxNzgzODM0NTQ2LCJ1c2VyX2lkIjoiMTE1NElwQkhzWVZxeDc1Sm01cU1RUURFdVJkciIsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsic2FoYXNyYTIwNjlAZ21haWwuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGFzc3dvcmQifSwiaWF0IjoxNzgzODQyMTExLCJleHAiOjE3ODM4NDU3MTEsImF1ZCI6ImRlbW8tdGVzdCIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9kZW1vLXRlc3QiLCJzdWIiOiIxMTU0SXBCSHNZVnF4NzVKbTVxTVFRREV1UmRyIn0.';
const url = 'http://localhost:3141/api/companion/me';

fetch(url, {
  headers: {
    'Authorization': 'Bearer ' + TOKEN,
  },
})
  .then(res => {
    console.log('HTTP status:', res.status);
    return res.json();
  })
  .then(data => {
    console.log('\nFull response:');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(err => {
    console.error('Network error:', err.message);
  });