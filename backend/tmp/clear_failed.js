const { MongoClient } = require('mongodb'); 
async function run() { 
  const client = new MongoClient('mongodb://jaindurva2005_db_user:Dpsind11022005@ac-6cmzvxb-shard-00-00.21ms67c.mongodb.net:27017,ac-6cmzvxb-shard-00-01.21ms67c.mongodb.net:27017,ac-6cmzvxb-shard-00-02.21ms67c.mongodb.net:27017/?ssl=true&replicaSet=atlas-f8eiui-shard-0&authSource=admin&appName=Cluster0'); 
  await client.connect(); 
  await client.db('vibe').collection('coding_submissions').deleteMany({ status: { $ne: 'Accepted' } }); 
  console.log('Cleared failed submissions'); 
  await client.close(); 
} 
run();
