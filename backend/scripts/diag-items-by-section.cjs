#!/usr/bin/env node
// diag-items-by-section.cjs — Test what the /items?sectionId=... endpoint
// actually returns for each of our 4 sections.

const http = require('http');

const SECTION_IDS = [
  '6a4f774273de56bebbabd664',
  '6a4f774273de56bebbabd665',
  '6a50cb21b59da603242f22ad',
  '6a50cb21b59da603242f22ae',
];

async function fetchJson(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4000,
      path,
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('\n┌──────────────────────────────────────────────────────────────┐');
  console.log('│  TEST /items?sectionId=... FOR EACH SECTION                   │');
  console.log('└──────────────────────────────────────────────────────────────┘\n');

  // Try without token first (in case dev allows)
  for (const sid of SECTION_IDS) {
    console.log(`\n--- GET /items?sectionId=${sid} ---`);
    try {
      const res = await fetchJson(`/api/items?sectionId=${sid}`);
      console.log('response:', JSON.stringify(res).slice(0, 500));
    } catch (e) {
      console.log('error:', e.message);
    }
  }

  console.log('\n');
})();