/**
 * diag-check-process.cjs
 * Confirms whether a backend is running and if it can serve a basic health check.
 * If it can serve a 401 (token required), it's up. If it can't connect, it's down.
 *
 * Run: node backend/scripts/diag-check-process.cjs
 */
const http = require('http');

function probe(path) {
  return new Promise((resolve) => {
    const req = http.request({
      host: 'localhost',
      port: 3141,
      path,
      method: 'GET',
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({status: res.statusCode, body: body.slice(0, 500)}));
    });
    req.on('error', e => resolve({error: e.message, code: e.code}));
    req.on('timeout', () => { req.destroy(); resolve({error: 'timeout'}); });
    req.end();
  });
}

(async () => {
  console.log('=== Backend liveness probe ===\n');
  
  console.log('Probing GET /api/courses/public (no auth)...');
  const publicRes = await probe('/api/courses/public');
  console.log(JSON.stringify(publicRes, null, 2));
  console.log('');

  console.log('Probing GET /api/users/enrollments (no auth, should 401)...');
  const enrRes = await probe('/api/users/enrollments');
  console.log(JSON.stringify(enrRes, null, 2));
  console.log('');

  console.log('=== Diagnosis ===\n');
  if (publicRes.error === 'ECONNREFUSED' || enrRes.error === 'ECONNREFUSED') {
    console.log('❌ Backend is NOT running on localhost:3141.');
    console.log('   Start it: cd backend && npm run dev');
  } else if (publicRes.status && publicRes.status < 500) {
    console.log('✅ Backend is up and serving requests.');
    console.log('   /api/courses/public returns', publicRes.status, '(expected 200)');
    console.log('   /api/users/enrollments returns', enrRes.status, '(expected 401 without token)');
    console.log('');
    console.log('Now check: is the backend running OLD code or NEW code?');
    console.log('  - OLD code: getAllEnrollments does NOT exist → 403 with valid token');
    console.log('  - NEW code: getAllEnrollments works → 200 with enrollment data');
    console.log('');
    console.log('If you restarted the backend after my edits, it should be NEW.');
    console.log('If not, restart it: Ctrl+C in backend terminal, then `npm run dev`');
  } else {
    console.log('? Unexpected backend state. See responses above.');
  }
})();