import { MongoClient } from 'mongodb';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Set Firebase Emulator Host explicitly for this process
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'vibe-5b35a';

async function main() {
  // Initialize firebase-admin
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'vibe-5b35a',
    });
  }

  const email = 'instructor@vibe.com';
  const password = 'Khushi@123';
  const displayName = 'Instructor User';

  let firebaseUid = '';

  try {
    // Check if user already exists in Firebase
    const fbUser = await admin.auth().getUserByEmail(email);
    console.log(`User already exists in Firebase with UID: ${fbUser.uid}`);
    firebaseUid = fbUser.uid;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log('Creating user in Firebase emulator...');
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
        emailVerified: true,
      });
      console.log(`Created Firebase user with UID: ${userRecord.uid}`);
      firebaseUid = userRecord.uid;
    } else {
      throw err;
    }
  }

  // Sync with MongoDB
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');

  const userDoc = {
    firebaseUID: firebaseUid,
    email: email,
    firstName: 'Instructor',
    lastName: 'User',
    roles: 'teacher', // Set as teacher for instructor view!
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const updateResult = await db.collection('users').updateOne(
    { email },
    { $set: userDoc },
    { upsert: true }
  );

  console.log(`MongoDB sync complete. Upserted: ${updateResult.upsertedCount || updateResult.modifiedCount}`);
  console.log(`\n🎉 Success! You can now log in with the following credentials:`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role: Instructor / Teacher`);

  await client.close();
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
