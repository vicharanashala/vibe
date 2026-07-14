// scripts/fixup-itemref-shape-2026-07-09.cjs
// The itemsGroup docs in the DB have items as { itemId, type, order, name }
// but the ItemRef transformer expects { _id, type, order, isHidden?, name }.
// `@Expose` drops fields it doesn't know about, so the ItemRef returned by
// `class-transformer` has all fields undefined -> controllers see nothing.
//
// This script rewrites each ItemRef to:
//   - add `_id` = (itemId value)
//   - convert `order` to a string (sortable lex order like "0|hzzzzz:")
//   - leave `type`, `name` as is
//
// Idempotent: if `_id` already exists, leaves it alone.

const {MongoClient, ObjectId} = require('mongodb');
const MONGO_URL = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  const groups = await db.collection('itemsGroup').find({}).toArray();
  console.log(`Found ${groups.length} itemsGroup(s) to fix up`);

  for (const g of groups) {
    const items = g.items || [];
    let touched = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      // Convert itemId -> _id (the field the transformer expects)
      if (it.itemId && !it._id) {
        it._id = typeof it.itemId === 'string' ? new ObjectId(it.itemId) : it.itemId;
        touched++;
      }
      // Coerce order to string. Use a sensible lex-orderable default.
      if (typeof it.order !== 'string') {
        const idx = typeof it.order === 'number' ? it.order : (i + 1);
        it.order = `0|hzzzzz:${String(idx).padStart(6, '0')}`;
        touched++;
      }
      // Ensure isHidden exists (optional but safer)
      if (typeof it.isHidden !== 'boolean') {
        it.isHidden = false;
        touched++;
      }
    }
    if (touched > 0) {
      await db.collection('itemsGroup').updateOne(
        {_id: g._id},
        {$set: {items: g.items, updatedAt: new Date()}},
      );
      console.log(`  ${g._id}: rewrote ${touched} field(s) across ${items.length} item(s)`);
    } else {
      console.log(`  ${g._id}: no changes needed`);
    }
  }

  console.log('');
  console.log('=== After fixup ===');
  const after = await db.collection('itemsGroup').find({}).toArray();
  for (const g of after) {
    console.log(`_id=${g._id}`);
    console.log(JSON.stringify(g.items, null, 2));
  }

  await client.close();
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});