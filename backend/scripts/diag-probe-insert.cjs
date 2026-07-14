// diag-probe-insert.cjs — insert + read back a test doc, see exactly what happens
const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const c = new MongoClient('mongodb://127.0.0.1:27017');  // note: 127.0.0.1, same as seed
  await c.connect();
  const db = c.db('vibe');

  console.log('Connected to: ' + c.options?.url || 'unknown');
  console.log('Target DB: ' + db.databaseName);

  // Insert a test doc
  const id = new ObjectId();
  console.log('Inserting testNewCourse with _id=' + id);
  try {
    const r = await db.collection('testNewCourse').insertOne({ _id: id, name: 'PROBE', ts: new Date() });
    console.log('Inserted: acknowledged=' + r.acknowledged + ' insertedId=' + r.insertedId);
  } catch (e) {
    console.log('Insert ERROR: ' + e.message);
  }

  // Count
  const count = await db.collection('testNewCourse').countDocuments({});
  console.log('Total testNewCourse docs: ' + count);

  // List all collections — both via listCollections() and via direct
  const cols = await db.listCollections().toArray();
  console.log('listCollections() returned ' + cols.length + ' cols');
  for (const col of cols) console.log('  ' + col.name);

  // Check via command
  const stats = await db.command({ listCollections: 1, nameOnly: true });
  console.log('\ncommand({listCollections:1, nameOnly:1}): ' + (stats.cursor?.firstBatch?.length || 0) + ' cols');
  for (const c of stats.cursor?.firstBatch || []) console.log('  ' + c.name);

  await c.close();
})().catch(e => { console.error('ERR: ' + e.message); process.exit(1); });