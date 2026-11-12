import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');
  
  const newCourses = await db.collection('newCourse').find({}).toArray();
  console.log('newCourse count:', newCourses.length);
  for (const c of newCourses) {
    console.log(`- Course Name: "${c.name}", ID: "${c._id}"`);
  }
  
  const videos = await db.collection('videos').find({}).toArray();
  console.log('Videos count:', videos.length);
  for (const v of videos) {
    console.log(`- Video ID: "${v._id}", URL: "${v.url || v.URL || ''}"`);
  }
  
  await client.close();
}

main().catch(console.error);
