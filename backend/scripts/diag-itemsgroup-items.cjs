#!/usr/bin/env node
// diag-itemsgroup-items.cjs — dump itemsGroup.items embedded shape

const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const client = new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true');
  await client.connect();
  const db = client.db('vibe');
  const igs = await db.collection('itemsGroup').find({}).toArray();
  console.log(`Total itemsGroups: ${igs.length}`);
  for (const ig of igs) {
    console.log('---');
    console.log(`ID: ${ig._id}`);
    console.log(`sectionId: ${ig.sectionId}`);
    console.log(`items (${ig.items?.length || 0}):`);
    for (const it of ig.items || []) {
      console.log('  ', JSON.stringify(it));
    }
  }
  await client.close();
})().catch(e => { console.error(e); process.exit(1); });