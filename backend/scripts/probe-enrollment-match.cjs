// scripts/probe-enrollment-match.cjs
// Simulates the exact match stage of getEnrollments to see why realProgress=0
const {MongoClient, ObjectId} = require('mongodb');

(async () => {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  const userObjectId = new ObjectId('6a4b9f85cc68bde40897fc16');
  const userId = '6a4b9f85cc68bde40897fc16';

  const pipeline = [
    {
      $match: {
        userId: {$in: [userObjectId, userId]},
        role: 'STUDENT',
        isDeleted: {$ne: true},
        status: 'ACTIVE',
      },
    },
  ];

  const result = await db.collection('enrollment').aggregate(pipeline).toArray();
  console.log('matched', result.length, 'docs');
  console.log(JSON.stringify(result, null, 2));

  await client.close();
})();