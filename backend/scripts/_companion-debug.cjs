const {MongoClient} = require('mongodb');
(new MongoClient('mongodb://127.0.0.1:27017')).connect().then(async (c) => {
  const db = c.db('vibe');
  const doc = await db.collection('companions').findOne({userId: '6a4b9f85cc68bde40897fc16'});
  console.log('lastKnownProgress:', doc?.lastKnownProgress, '| newJourney:', doc?.newJourney);
  await c.close();
});