const {MongoClient, ObjectId} = require('mongodb');
const http = require('http');

const ENROLLMENT_ID = '6a53338a8dfcf921ee48e9f4';
const PANDU_ID = '6a4b8c7e1e6b7a91c33fb27c';
const COURSE_ID = '6a53311b5b3a0f2ab44dc807';

async function run() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('vibe');

  // ── 1. Raw enrollment doc ─────────────────────────────────────────────
  console.log('═══════════════════════════════════════');
  console.log('1. RAW ENROLLMENT DOC');
  console.log('═══════════════════════════════════════');
  const enr = await db.collection('enrollments').findOne({_id: new ObjectId(ENROLLMENT_ID)});
  if (!enr) { console.log('NOT FOUND'); return; }
  // Show every field with its JS type
  for (const [k, v] of Object.entries(enr)) {
    console.log(`  ${k}: ${JSON.stringify(v)} (${typeof v}${v?.constructor?.name !== undefined && v?.constructor?.name !== 'Object' ? ' / ' + v.constructor.name : ''})`);
  }

  // ── 2. Pandu user doc ────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('2. PANDU USER DOC');
  console.log('═══════════════════════════════════════');
  const user = await db.collection('users').findOne({_id: new ObjectId(PANDU_ID)});
  if (!user) { console.log('NOT FOUND'); return; }
  console.log('  _id:', user._id, '(type:', user._id.constructor.name, ')');
  console.log('  email:', user.email);

  // ── 3. Match check ───────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('3. USERID MATCH CHECK');
  console.log('═══════════════════════════════════════');
  const match = enr.userId.toString() === user._id.toString();
  console.log('  enrollment.userId === user._id ?', match);
  console.log('  enrollment.userId (raw):', enr.userId);
  console.log('  user._id (raw):', user._id);

  // ── 4. Exact dashboard query (ObjectId userId) ───────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('4. DASHBOARD QUERY (ObjectId userId)');
  console.log('═══════════════════════════════════════');
  const pipeline = [
    {$match: {
      userId: new ObjectId(PANDU_ID),
      role: 'STUDENT',
      status: 'ACTIVE',
      isDeleted: {$ne: true}
    }},
    {$sort: {enrollmentDate: -1}},
    {$lookup: {from: 'newCourse', localField: 'courseId', foreignField: '_id', as: 'course'}},
    {$unwind: {path: '$course', preserveNullAndEmptyArrays: true}},
    {$lookup: {from: 'newCourseVersion', localField: 'courseVersionId', foreignField: '_id', as: 'courseVersion'}},
    {$unwind: {path: '$courseVersion', preserveNullAndEmptyArrays: true}}
  ];
  const objectIdResults = await db.collection('enrollments').aggregate(pipeline).toArray();
  console.log('  Count:', objectIdResults.length);
  if (objectIdResults.length > 0) {
    console.log('  _id:', objectIdResults[0]._id, '| course.name:', objectIdResults[0].course?.name);
  } else {
    console.log('  EMPTY — this is why dashboard shows nothing');
  }

  // ── 5. Exact dashboard query (string userId — the bug) ───────────────
  console.log('\n═══════════════════════════════════════');
  console.log('5. DASHBOARD QUERY (STRING userId — THE BUG)');
  console.log('═══════════════════════════════════════');
  const stringPipeline = [
    {$match: {
      userId: PANDU_ID,  // STRING — no ObjectId wrapper
      role: 'STUDENT',
      status: 'ACTIVE',
      isDeleted: {$ne: true}
    }}
  ];
  const stringResults = await db.collection('enrollments').aggregate(stringPipeline).toArray();
  console.log('  Count:', stringResults.length);
  if (stringResults.length === 0) {
    console.log('  EMPTY — if API passes string userId, enrollment is NOT found');
    console.log('  MongoDB is type-strict: string "6a4b8c7e..." !== ObjectId("6a4b8c7e...")');
  }

  // ── 6. HTTP call to real API endpoint ────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('6. HTTP CALL TO /api/users/enrollments?tab=active');
  console.log('═══════════════════════════════════════');
  console.log('  NOTE: To test the real API, you need pandu\'s auth token.');
  console.log('  Get it from: Browser DevTools → Network → /api/users/enrollments → Authorization header');
  console.log('  Then run: $env:PANDU_TOKEN="<token>"; node backend/scripts/_full-diagnostic.cjs');
  console.log('  Currently showing Mongo-side analysis only.');

  await client.close();

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log('  Enrollment exists in MongoDB?', !!enr);
  console.log('  Enrollment userId type:', enr.userId.constructor.name);
  console.log('  Pandu _id type:', user._id.constructor.name);
  console.log('  userId match?', match);
  console.log('  ObjectId query finds enrollment?', objectIdResults.length > 0);
  console.log('  String userId query finds enrollment?', stringResults.length > 0);
  console.log('');
  if (stringResults.length === 0 && objectIdResults.length > 0) {
    console.log('  DIAGNOSIS: The API is passing userId as a STRING to MongoDB.');
    console.log('  This means @CurrentUser returns the user as a STRING (not ObjectId),');
    console.log('  or the EnrollmentService.getEnrollments() is calling new ObjectId(string)');
    console.log('  on a string that is somehow "true" or some other wrong value.');
  }
}

run().catch(err => { console.error('ERROR:', err.message, err.stack); process.exit(1); });