/**
 * diag-hit-real-endpoint.cjs
 * Hits the actual /api/users/enrollments endpoint with a fresh Firebase token
 * for the test learner. Reveals what the backend currently returns — 200,
 * 403, 500, or empty — without needing the user to open DevTools.
 *
 * Run: node backend/scripts/diag-hit-real-endpoint.cjs
 *
 * Requires: backend running on localhost:3141
 *           The Firebase ID token for test.learner@vibe.local
 *           (paste into FIREBASE_TOKEN env var OR edit FAKE_TOKEN below)
 */
const http = require('http');

const TOKEN = process.env.FIREBASE_TOKEN || process.argv[2] || '';
const HOST = 'localhost';
const PORT = 3141;
const PATH = '/api/users/enrollments?role=STUDENT&tab=active&page=1&limit=10';

if (!TOKEN) {
  console.log('Usage: FIREBASE_TOKEN=<your-firebase-id-token> node backend/scripts/diag-hit-real-endpoint.cjs');
  console.log('Or: node backend/scripts/diag-hit-real-endpoint.cjs <token>');
  console.log('\nTo get the token: in browser DevTools, look at any /api/* request');
  console.log('in Network tab → Headers → Authorization: Bearer <token>');
  process.exit(1);
}

const req = http.request({
  host: HOST,
  port: PORT,
  path: PATH,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/json',
  },
  timeout: 10000,
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Content-Type: ${res.headers['content-type']}`);
    console.log('\nBody:');
    try {
      const json = JSON.parse(body);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(body.slice(0, 2000));
    }

    // Diagnose
    console.log('\n=== DIAGNOSIS ===');
    if (res.statusCode === 200) {
      const enrollments = json?.enrollments || json?.data?.enrollments || [];
      console.log(`✅ 200 OK — backend returned ${enrollments.length} enrollment(s)`);
      if (enrollments.length === 0) {
        console.log('   But empty array. Course should be in Enrolled tab.');
        console.log('   Possible: bootstrap wiped the data, or hook has filter issue.');
      } else {
        console.log('   Course should now show in Enrolled tab. Hard-refresh dashboard!');
      }
    } else if (res.statusCode === 403) {
      console.log('❌ 403 Forbidden — ability check failed.');
      console.log('   Most likely: backend NOT restarted, still running pre-fix code.');
      console.log('   Restart: Ctrl+C in backend terminal, then `npm run dev`');
    } else if (res.statusCode === 500) {
      console.log('❌ 500 Server Error — runtime exception in backend.');
      console.log('   Check the backend terminal for the stack trace.');
      console.log('   Common cause: my new getAllEnrollments has a runtime bug,');
      console.log('   or tsconfig has a compile error so backend is half-loaded.');
    } else if (res.statusCode === 401) {
      console.log('❌ 401 Unauthorized — bad/expired Firebase token.');
      console.log('   Get a fresh token from DevTools and retry.');
    } else {
      console.log(`? Status ${res.statusCode} — unexpected. See body above.`);
    }
  });
});

req.on('error', e => {
  console.log(`Network error: ${e.message}`);
  if (e.code === 'ECONNREFUSED') {
    console.log('Backend is not running on localhost:3141.');
    console.log('Start it: cd backend && npm run dev');
  }
});

req.on('timeout', () => {
  console.log('Request timed out (10s).');
  req.destroy();
});

req.end();