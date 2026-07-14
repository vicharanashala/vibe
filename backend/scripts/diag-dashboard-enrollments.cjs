// diag-dashboard-enrollments-simple.cjs
// Minimal version: just paste your token (no env vars, no escaping).

const http = require('http');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Paste your Firebase token (eyJ...): ', (token) => {
  rl.close();
  token = token.trim();
  if (!token || !token.startsWith('eyJ')) {
    console.error('Token does not look like a JWT. Expected to start with "eyJ".');
    process.exit(1);
  }

  const options = {
    hostname: 'localhost',
    port: 3141,
    path: '/api/users/enrollments?page=1&limit=100&role=STUDENT&tab=active',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
  };

  console.log('Hitting:', `http://localhost:3141${options.path}`);

  const req = http.request(options, (res) => {
    console.log(`\nStatus: ${res.statusCode}`);
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.log(`\nBody length: ${body.length} bytes`);
      try {
        const parsed = JSON.parse(body);
        console.log('\nJSON:');
        console.log(JSON.stringify(parsed, null, 2));
        if (Array.isArray(parsed?.enrollments)) {
          console.log(`\n>>> Found ${parsed.enrollments.length} enrollment(s) <<<`);
          parsed.enrollments.forEach((e, i) => {
            console.log(`  [${i}] courseId=${e.courseId} versionId=${e.courseVersionId} role=${e.role} status=${e.status} percentCompleted=${e.percentCompleted}`);
          });
        }
      } catch (e) {
        console.log('Raw body (first 500 chars):', body.substring(0, 500));
      }
    });
  });
  req.on('error', (e) => console.error('Request error:', e.message));
  req.end();
});
