import { MongoClient } from 'mongodb';

const uri = "mongodb://jaindurva2005_db_user:Dpsind11022005@ac-6cmzvxb-shard-00-00.21ms67c.mongodb.net:27017,ac-6cmzvxb-shard-00-01.21ms67c.mongodb.net:27017,ac-6cmzvxb-shard-00-02.21ms67c.mongodb.net:27017/?ssl=true&replicaSet=atlas-f8eiui-shard-0&authSource=admin&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db('vibe');
    const collection = db.collection('coding_submissions');
    const result = await collection.deleteMany({});
    console.log(`Deleted ${result.deletedCount} submissions.`);
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
run();
