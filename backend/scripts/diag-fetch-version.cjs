#!/usr/bin/env node
// diag-fetch-version.cjs — Hit the live backend API and print what it returns for
// the test course version. Reads token from TOKEN env var.
//
// Usage:
//   $env:FIREBASE_TOKEN = "<paste-token-here>"
//   node backend/scripts/diag-fetch-version.cjs

const http = require('http');

const TOKEN = process.env.FIREBASE_TOKEN || process.env.TOKEN || '';
const HOST = process.env.API_HOST || '127.0.0.1';
const PORT = parseInt(process.env.API_PORT || '4000', 10);
const VERSION_ID = '6a50cb21b59da603242f22ac';

function fetchJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('\n┌──────────────────────────────────────────────────────────────┐');
  console.log(`│  LIVE API: /api/courses/versions/${VERSION_ID}`);
  console.log('└──────────────────────────────────────────────────────────────┘\n');

  if (!TOKEN) {
    console.log('❌ No FIREBASE_TOKEN env var set.');
    console.log('\nGet token from browser: F12 → Console → ');
    console.log('   localStorage.getItem("firebase-auth-token")\n');
    console.log('Then run:');
    console.log('   $env:FIREBASE_TOKEN = "<paste-token-here>"');
    console.log('   node backend/scripts/diag-fetch-version.cjs');
    return;
  }

  const r = await fetchJson(`/api/courses/versions/${VERSION_ID}`);
  console.log(`Status: ${r.status}\n`);

  if (r.status !== 200) {
    console.log('Full body:');
    console.log(JSON.stringify(r.body, null, 2).slice(0, 2000));
    return;
  }

  const v = r.body;
  console.log(`courseId: ${v.courseId}`);
  console.log(`version: ${v.version}`);
  console.log(`versionStatus: ${v.versionStatus}`);
  console.log(`name: ${v.name}`);
  console.log(`\nmodules.length: ${v.modules?.length ?? 0}`);

  if (v.modules?.length) {
    for (const m of v.modules) {
      console.log(`\n  Module: ${m.name}`);
      console.log(`    moduleId: ${m.moduleId}`);
      console.log(`    isHidden: ${m.isHidden}`);
      console.log(`    isDeleted: ${m.isDeleted}`);
      console.log(`    sections.length: ${m.sections?.length ?? 0}`);
      for (const s of m.sections || []) {
        console.log(`      Section: order=${s.order} sectionId=${s.sectionId}`);
        console.log(`        itemsGroupId=${s.itemsGroupId}`);
        console.log(`        isHidden=${s.isHidden} isDeleted=${s.isDeleted}`);
        console.log(`        items.length=${s.items?.length ?? 0}`);
      }
    }
  }

  console.log('\n--- Raw JSON (modules only) ---');
  console.log(JSON.stringify(v.modules, null, 2).slice(0, 3000));
})();