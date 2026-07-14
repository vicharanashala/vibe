// diag-list-dbs.cjs — find which DB has the test course data
const { MongoClient } = require('mongodb');

(async () => {
  const c = new MongoClient('mongodb://localhost:27017', { directConnection: true });
  await c.connect();
  const admin = c.db().admin();
  const dbs = await admin.listDatabases();
  console.log('All databases on local MongoDB:');
  for (const d of dbs) {
    console.log('  ' + d.name + ' (' + (d.sizeOnDisk || '?') + ' bytes)');
  }

  // Try common DB names
  for (const name of ['vibe', 'ViBe', 'vibe_dev', 'vibedev', 'test', 'vibe-backend', 'Vibe']) {
    try {
      const db = c.db(name);
      const cols = await db.listCollections().toArray();
      if (cols.length) {
        console.log('\n--- DB: ' + name + ' (' + cols.length + ' collections) ---');
        for (const col of cols) {
          const count = await db.collection(col.name).countDocuments();
          console.log('  ' + col.name + ' (' + count + ' docs)');
        }
      }
    } catch (e) { /* skip */ }
  }
  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); process.exit(1); });