// Call the backend enrollment API directly and show raw response
// Simulates what the dashboard's useUserEnrollments hook actually receives

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3141,
  path: '/api/users/enrollments?tab=active&page=1&limit=10',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    // The auth token for pandu's session — paste from browser DevTools Network tab
    // (Authorization: Bearer <token>)
    // If you don't have a token, use: 'x-user-id: 6a4b8c7e1e6b7a91c33fb27c' as a fallback header
  }
};

// First: prompt for token, then call the API
console.log('IMPORTANT: For this script to work, you need pandu\'s Firebase auth token.');
console.log('1. Open browser DevTools (F12) → Network tab');
console.log('2. Refresh the dashboard page');
console.log('3. Find the request to /api/users/enrollments');
console.log('4. Copy the Authorization header value (the full Bearer token)');
console.log('');
console.log('Alternatively, add the x-user-id header. But best: use the Bearer token.');
console.log('');
console.log('If you want to skip auth (e.g. backend allows unauthenticated for dev),');
console.log('the script will still run and show what the server returns.');
console.log('');

// Try without auth first to see if backend allows it
function makeRequest(authToken) {
  const reqOptions = {...options};
  if (authToken) {
    reqOptions.headers['Authorization'] = `Bearer ${authToken}`;
  }
  // Remove auth header if not provided (undefined)
  if (!authToken) {
    delete reqOptions.headers['Authorization'];
  }

  return new Promise((resolve, reject) => {
    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({statusCode: res.statusCode, body: JSON.parse(data)});
        } catch {
          resolve({statusCode: res.statusCode, body: data});
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

// If token is provided as env var, use it
const token = process.env.PANDU_AUTH_TOKEN;
if (token) {
  console.log('Using token from PANDU_AUTH_TOKEN env var...');
  makeRequest(token).then(r => {
    console.log('Status:', r.statusCode);
    console.log('Response:', JSON.stringify(r.body, null, 2));
    process.exit(0);
  }).catch(e => { console.error(e.message); process.exit(1); });
} else {
  console.log('No PANDU_AUTH_TOKEN env var set.');
  console.log('Run with: $env:PANDU_AUTH_TOKEN="<token>"; node backend/scripts/_check-api-response.cjs');
  console.log('');
  console.log('Trying without auth token (to see error message)...');
  makeRequest(null).then(r => {
    console.log('Status:', r.statusCode);
    console.log('Response:', JSON.stringify(r.body, null, 2));
    process.exit(0);
  }).catch(e => { console.error(e.message); process.exit(1); });
}