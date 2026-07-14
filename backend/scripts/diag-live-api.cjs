#!/usr/bin/env node
// diag-live-api.cjs — Test the live backend API at port 4000 to see what it returns

const http = require('http');

const TOKEN = process.env.TEST_TOKEN;
const URL = process.env.TEST_URL || '/api/courses/versions/6a50cb21b59da603242f22ac';

function fetchJson(path, method = 'GET', body = null, token = TOKEN) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  console.log('\n┌──────────────────────────────────────────────────────────────┐');
  console.log(`│  LIVE API: ${URL.padEnd(48)}│`);
  console.log('└──────────────────────────────────────────────────────────────┘\n');

  // Try without token (might work in dev)
  console.log('--- Without token ---');
  const r1 = await fetchJson(URL, 'GET', null, null);
  console.log(`Status: ${r1.status}`);
  console.log(JSON.stringify(r1.body, null, 2).slice(0, 3000));

  // Now also try /items?sectionId= for each section
  console.log('\n\n--- /api/items?sectionId=... ---');
  for (const sid of ['6a50cb21b59da603242f22ad', '6a50cb21b59da603242f22ae']) {
    const r = await fetchJson(`/api/items?sectionId=${sid}`, 'GET', null, null);
    console.log(`\nsectionId=${sid}: status=${r.status}`);
    console.log(JSON.stringify(r.body).slice(0, 1000));
  }

  console.log('\n--- /api/items?itemsGroupId=... ---');
  for (const gid of ['6a50cb21b59da603242f22af', '6a50cb21b59da603242f22b0']) {
    const r = await fetchJson(`/api/items?itemsGroupId=${gid}`, 'GET', null, null);
    console.log(`\nitemsGroupId=${gid}: status=${r.status}`);
    console.log(JSON.stringify(r.body).slice(0, 1000));
  }
})();