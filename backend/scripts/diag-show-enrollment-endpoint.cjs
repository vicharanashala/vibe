// diag-show-enrollment-endpoint.cjs
// Reads the live /api/users/enrollments endpoint with the user's Firebase token
// and prints the JSON response. Lets us see EXACTLY what the dashboard would see.
//
// Usage:
//   PowerShell:
//     $env:FIREBASE_TOKEN = "<paste-token>"
//     node backend/scripts/diag-show-enrollment-endpoint.cjs
//
// Or paste token when prompted interactively.

const http = require('http');

function getToken() {
  // 1. env var
  if (process.env.FIREBASE_TOKEN) return process.env.FIREBASE_TOKEN.trim();

  // 2. CLI arg
  const cliArg = process.argv[2];
  if (cliArg) return cliArg.trim();

  // 3. interactive prompt
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    readline.question('\n🔑 Paste Firebase token from DevTools Network:\n   (Application tab → Local Storage → firebase-auth-token)\n\n> ', (answer) => {
      readline.close();
      resolve(answer.trim());
    });
  });
}

(async () => {
  const token = await getToken();
  if (!token || token.length < 20) {
    console.error('No token provided.');
    process.exit(1);
  }

  const url = '/api/users/enrollments?page=1&limit=100&role=STUDENT&tab=active';

  console.log(`\n→ GET http://localhost:3141${url}\n`);

  const req = http.request({
    hostname: 'localhost',
    port: 3141,
    path: url,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log(`\n← Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`← Content-Type: ${res.headers['content-type']}`);
      console.log(`← Cache-Control: ${res.headers['cache-control']}`);
      console.log(`← ETag: ${res.headers['etag']}\n`);

      try {
        const parsed = JSON.parse(body);
        console.log('Parsed JSON:');
        console.log(JSON.stringify(parsed, null, 2));

        // Summary
        const list = parsed.enrollments || [];
        console.log('\n=== Summary ===');
        console.log(`Total documents: ${parsed.totalDocuments}`);
        console.log(`Total pages: ${parsed.totalPages}`);
        console.log(`Enrollments in response: ${list.length}`);
        console.log(`Active count: ${parsed.activeCount}`);
        console.log(`Archived count: ${parsed.archivedCount}`);

        if (list.length > 0) {
          console.log('\nEnrollments:');
          list.forEach((e, i) => {
            console.log(`  [${i}] _id=${e._id}`);
            console.log(`      courseId=${e.courseId}`);
            console.log(`      courseVersionId=${e.courseVersionId}`);
            console.log(`      role=${e.role} status=${e.status}`);
            console.log(`      percentCompleted=${e.percentCompleted}`);
          });
        } else {
          console.log('\n⚠️  NO ENROLLMENTS RETURNED!');
          console.log('The backend is returning an empty array despite the DB having the enrollment.');
          console.log('Likely culprits:');
          console.log('  1. The "role" filter does not match (should be "STUDENT")');
          console.log('  2. The "status" filter excludes "ACTIVE" (check case sensitivity)');
          console.log('  3. The "isDeleted" filter excludes this enrollment');
          console.log('  4. _withTransaction is failing silently on standalone Mongo');
        }
      } catch (err) {
        console.log('Raw body (not valid JSON):');
        console.log(body);
      }
    });
  });

  req.on('error', err => console.error('Request failed:', err.message));
  req.end();
})();
