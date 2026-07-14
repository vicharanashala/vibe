const {MongoClient, ObjectId} = require('mongodb');
(new MongoClient('mongodb://127.0.0.1:27017')).connect().then(async (c) => {
  const db = c.db('vibe');
  const docs = await db.collection('enrollments').find({userId: new ObjectId('6a4b9f85cc68bde40897fc16')}).toArray();
  docs.forEach((d) => console.log(JSON.stringify({p: d.percentCompleted, status: d.status})));
  await c.close();
});