import { MongoClient, ObjectId } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');

  const instructorEmail = 'instructor@vibe.com';
  const instructor = await db.collection('users').findOne({ email: instructorEmail });

  if (!instructor) {
    console.error(`Could not find user with email: ${instructorEmail}`);
    await client.close();
    process.exit(1);
  }

  const userId = instructor._id;
  console.log(`Instructor found with ID: ${userId}`);

  // Course 1: Full Stack Web Development BootCamp
  const enrollment1 = {
    userId: userId,
    courseId: new ObjectId('6a648c026ca3d62633bff21c'),
    courseVersionId: new ObjectId('6a648c026ca3d62633bff21d'),
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    cohortId: new ObjectId('6a648c026ca3d62633bff21e'),
    enrollmentDate: new Date(),
    percentCompleted: 0,
    completedItemsCount: 0,
    hpPoints: 100
  };

  // Course 2: Artificial Intelligence & Agentic Systems
  const enrollment2 = {
    userId: userId,
    courseId: new ObjectId('6a648c026ca3d62633bff220'),
    courseVersionId: new ObjectId('6a648c026ca3d62633bff221'),
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    cohortId: new ObjectId('6a648c026ca3d62633bff222'),
    enrollmentDate: new Date(),
    percentCompleted: 0,
    completedItemsCount: 0,
    hpPoints: 100
  };

  // Clear existing enrollments for this instructor user to prevent duplicates
  await db.collection('enrollment').deleteMany({ userId: userId });

  // Insert new enrollments
  const result1 = await db.collection('enrollment').insertOne(enrollment1);
  const result2 = await db.collection('enrollment').insertOne(enrollment2);

  console.log(`Successfully enrolled instructor in course 1 (ID: ${result1.insertedId})`);
  console.log(`Successfully enrolled instructor in course 2 (ID: ${result2.insertedId})`);

  await client.close();
  process.exit(0);
}

main().catch(console.error);
