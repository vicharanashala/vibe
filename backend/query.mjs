import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibecode');
  const submission = await db.collection('codingsubmissions').find({language: 'javascript'}).sort({_id: -1}).limit(1).toArray();
  console.log(JSON.stringify(submission, null, 2));
  await client.close();
}
main();
