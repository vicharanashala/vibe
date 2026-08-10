const { MongoClient } = require('mongodb');

async function run() {
  console.log('Starting script...');
  const uri = 'mongodb://jaindurva2005_db_user:Dpsind11022005@ac-6cmzvxb-shard-00-00.21ms67c.mongodb.net:27017,ac-6cmzvxb-shard-00-01.21ms67c.mongodb.net:27017,ac-6cmzvxb-shard-00-02.21ms67c.mongodb.net:27017/?ssl=true&replicaSet=atlas-f8eiui-shard-0&authSource=admin&appName=Cluster0';
  const client = new MongoClient(uri);

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Connected.');
    
    const db = client.db('vibe');
    
    console.log('Fetching students...');
    const users = await db.collection('students').find({ email: { $regex: 'jaindurva2005', $options: 'i' } }).toArray();
    console.log('Found users:', users.length);
    
    if (users.length === 0) {
      console.log('User not found. Will just delete all exact duplicate coding submissions anyway.');
    }
    
    console.log('Fetching submissions...');
    const submissions = await db.collection('coding_submissions').find({}).sort({ createdAt: -1 }).toArray();
    console.log(`Found ${submissions.length} total submissions in DB.`);
    
    const groups = {};
    for (const sub of submissions) {
      const key = sub.studentId + '_' + sub.problemId + '_' + sub.language + '_' + sub.code;
      if (!groups[key]) groups[key] = [];
      groups[key].push(sub);
    }
    
    let totalDeleted = 0;
    for (const key in groups) {
      const subs = groups[key];
      if (subs.length > 1) {
        const idsToDelete = subs.slice(1).map(s => s._id);
        const result = await db.collection('coding_submissions').deleteMany({ _id: { $in: idsToDelete } });
        totalDeleted += result.deletedCount;
      }
    }
    console.log(`Deleted ${totalDeleted} exact duplicate submissions from the database.`);
    
  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    console.log('Closing client...');
    await client.close();
    console.log('Done.');
  }
}

run();
