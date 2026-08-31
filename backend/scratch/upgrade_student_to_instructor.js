import { MongoClient, ObjectId } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');

  const email = 'khushidosi2006@gmail.com';
  const user = await db.collection('users').findOne({ email });

  if (!user) {
    console.error(`Could not find user: ${email}`);
    await client.close();
    process.exit(1);
  }

  const userId = user._id;
  console.log(`Upgrading user ${email} (ID: ${userId}) to roles: "teacher"...`);

  // Update user document roles to 'teacher' so they can login/access teacher routes
  await db.collection('users').updateOne(
    { _id: userId },
    { $set: { roles: 'teacher' } }
  );

  // Enroll in Course 1 (Full Stack Web Development BootCamp) as INSTRUCTOR
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

  // Enroll in Course 2 (Artificial Intelligence & Agentic Systems) as INSTRUCTOR
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

  // Delete any existing INSTRUCTOR enrollments for this user to avoid duplicates
  await db.collection('enrollment').deleteMany({ userId: userId, role: 'INSTRUCTOR' });

  // Insert the instructor enrollments
  await db.collection('enrollment').insertOne(enrollment1);
  await db.collection('enrollment').insertOne(enrollment2);

  console.log('🎉 Upgrade completed successfully! The student user now has teacher access to all seeded courses.');

  await client.close();
  process.exit(0);
}

main().catch(console.error);
