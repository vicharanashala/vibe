#!/usr/bin/env node
// diag-db-snapshot.cjs — Capture a complete snapshot of every collection we care about
// Helps identify whether data is being deleted or if it's a topology/routing issue.

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'vibe';

(async () => {
  const client = new MongoClient(MONGO_URL, {
    directConnection: true,
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log('\n┌──────────────────────────────────────────────────────────────┐');
    console.log('│  FULL DB SNAPSHOT                                             │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    // Get ALL collection names in this DB
    const allCollections = await db.listCollections().toArray();
    console.log(`📦 Total collections in "${DB_NAME}" DB: ${allCollections.length}`);
    for (const c of allCollections) {
      const count = await db.collection(c.name).countDocuments();
      console.log(`   • ${c.name}  (${count} docs)`);
    }

    console.log('\n📋 USERS — full dump:');
    const users = await db.collection('users').find({}).toArray();
    for (const u of users) {
      console.log(`  • _id=${u._id.toString()}  email=${u.email}  firebaseUid=${u.firebaseUid ?? u.uid ?? '?'}  roles=${JSON.stringify(u.roles)}`);
    }

    console.log('\n📋 ENROLLMENT — full count + first 5:');
    const enrCount = await db.collection('enrollment').countDocuments();
    console.log(`  total: ${enrCount}`);
    const enrs = await db.collection('enrollment').find({}).limit(5).toArray();
    for (const e of enrs) {
      console.log(`  • _id=${e._id.toString()}  userId=${e.userId?.toString?.() ?? e.userId}  role=${e.role}  status=${e.status}`);
    }

    console.log('\n📋 NEWCOURSE — full count + first 5:');
    const cCount = await db.collection('newCourse').countDocuments();
    console.log(`  total: ${cCount}`);
    const cs = await db.collection('newCourse').find({}).limit(5).toArray();
    for (const c of cs) {
      console.log(`  • _id=${c._id.toString()}  name=${c.name}`);
    }

    console.log('\n📋 NEWCOURSEVERSION — full count + first 5:');
    const vCount = await db.collection('newCourseVersion').countDocuments();
    console.log(`  total: ${vCount}`);
    const vs = await db.collection('newCourseVersion').find({}).limit(5).toArray();
    for (const v of vs) {
      console.log(`  • _id=${v._id.toString()}  versionStatus=${v.versionStatus}  autoApprove=${v.autoApprove}`);
    }

    console.log('\n📋 COURSE_REGISTRATIONS — full count + first 5:');
    const rCount = await db.collection('course_registrations').countDocuments();
    console.log(`  total: ${rCount}`);
    const rs = await db.collection('course_registrations').find({}).limit(5).toArray();
    for (const r of rs) {
      console.log(`  • _id=${r._id.toString()}  userId=${r.userId?.toString?.() ?? r.userId}  status=${r.status}`);
    }

    console.log('\n📋 COMPANIONS — full count + first 5:');
    const cpCount = await db.collection('companions').countDocuments();
    console.log(`  total: ${cpCount}`);
    const cps = await db.collection('companions').find({}).limit(5).toArray();
    for (const p of cps) {
      console.log(`  • _id=${p._id.toString()}  userId=${p.userId?.toString?.() ?? p.userId}  animal=${p.animal}  stage=${p.stage}`);
    }

    console.log('\n');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
})();