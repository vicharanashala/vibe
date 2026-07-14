// diag-list-dbs-v2.cjs — robust version
const { MongoClient } = require('mongodb');

(async () => {
  const c = new MongoClient('mongodb://localhost:27017', { directConnection: true });
  await c.connect();
  const admin = c.db().admin();

  // listDatabases returns { databases: [...] } — destructure properly
  const result = await admin.listDatabases();
  const dbs = result.databases || [];
  console.log('All databases (' + dbs.length + '):');
  for (const d of dbs) {
    console.log('  ' + d.name + ' (' + (d.sizeOnDisk || '?') + ' bytes)');
  }

  // Also enumerate databases via direct namespace probe
  console.log('\nProbing candidate database names:');
  for (const name of ['vibe', 'ViBe', 'vibe_dev', 'vibedev', 'test', 'vibe-backend', 'Vibe', 'viBe']) {
    try {
      const db = c.db(name);
      const cols = await db.listCollections().toArray();
      if (cols.length) {
        console.log('\n--- DB: ' + name + ' (' + cols.length + ' collections) ---');
        for (const col of cols) {
          const count = await db.collection(col.name).countDocuments();
          console.log('  ' + col.name + ' (' + count + ' docs)');
        }
      } else {
        console.log('  ' + name + ': empty or no collections');
      }
    } catch (e) {
      console.log('  ' + name + ': error ' + e.message);
    }
  }

  // Also probe the specific collection names in case they're in another DB
  console.log('\nProbing newCourse collection across all DBs:');
  for (const d of dbs) {
    try {
      const db = c.db(d.name);
      const cols = await db.listCollections().toArray();
      const courseCols = cols.filter(x => /course|newcourse|newcourse/i.test(x.name));
      if (courseCols.length) {
        console.log('  DB=' + d.name + ' has course-related cols: ' + courseCols.map(x => x.name).join(', '));
      }
    } catch (e) {}
  }

  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); process.exit(1); });