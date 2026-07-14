// Diag: check what 'readItem' returns for our test items
const { MongoClient, ObjectId } = require('mongodb');
const MONGO_URI = 'mongodb://127.0.0.1:27017/?directConnection=true';
const DB_NAME = 'vibe';

(async () => {
  const client = new MongoClient(MONGO_URI, { directConnection: true });
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    console.log('=== Connected to MongoDB (127.0.0.1) ===\n');

    const items = ['6a50cb21b59da603242f22b1', '6a50cb21b59da603242f22b2'];

    for (const itemId of items) {
      const objectId = new ObjectId(itemId);
      console.log(`\n========= Item ${itemId} =========`);

      // Check videos collection
      const video = await db.collection('videos').findOne({ _id: objectId });
      console.log(`\n[videos collection]:`, video ? `FOUND - keys: ${Object.keys(video).join(',')}` : 'NOT FOUND');

      // Check quizzes collection
      const quiz = await db.collection('quizzes').findOne({ _id: objectId });
      console.log(`[quizzes collection]:`, quiz ? `FOUND - keys: ${Object.keys(quiz).join(',')}` : 'NOT FOUND');

      // Check unified items collection
      const item = await db.collection('items').findOne({ _id: objectId });
      console.log(`[items collection]:`, item ? `FOUND - keys: ${Object.keys(item).join(',')}` : 'NOT FOUND');

      if (video) console.log('  video.type:', video.type, 'name:', video.name);
      if (quiz) console.log('  quiz.type:', quiz.type, 'name:', quiz.name);
      if (item) console.log('  item.type:', item.type, 'name:', item.name);
    }
  } finally {
    await client.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
