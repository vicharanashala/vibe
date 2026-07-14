// Run with: $env:PANDU_TOKEN="<Bearer token from DevTools>"; node backend/scripts/_http-enrollment-test.cjs
// Tests the actual HTTP API call the dashboard makes

const http = require('http');

const token = process.env.PANDU_TOKEN;
if (!token) {
  console.log('ERROR: No PANDU_TOKEN env var set.');
  console.log('');
  console.log('How to get the token:');
  console.log('1. Open http://127.0.0.1:5173 in browser');
  console.log('2. Open DevTools (F12) → Network tab');
  console.log('3. Refresh the page');
  console.log('4. Find request to /api/users/enrollments');
  console.log('5. Click it → Headers → copy full Authorization header value');
  console.log('6. Run: $env:PANDU_TOKEN="<that token>"; node backend/scripts/_http-enrollment-test.cjs');
  process.exit(1);
}

console.log('Using token:', token.substring(0, 20) + '...');

const options = {
  hostname: 'localhost',
  port: 3141,
  path: '/api/users/enrollments?tab=active&page=1&limit=10',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    console.log('Response:', JSON.stringify(JSON.parse(data), null, 2));
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.setTimeout(10000, () => {
  console.error('Request timed out');
  req.destroy();
  process.exit(1);
});

req.end();