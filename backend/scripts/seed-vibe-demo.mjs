#!/usr/bin/env node
/**
 * Minimal local demo seed.
 *
 * Inserts one test course (1 version -> 1 module -> 5 sections -> 5 VIDEO items)
 * into the backend's local MongoDB (in-memory replSet on port 27017 when
 * USE_MEMORY_DB=true) and enrolls the given student so there is something to
 * click through in the student UI, generating `watchTime` rows for the streak.
 *
 * Safe to run repeatedly (idempotent): it deletes the fixed demo ids first.
 *
 * Usage (from backend/):
 *   node scripts/seed-vibe-demo.mjs                # enrolls test1000@test.com
 *   EMAIL='other@test.com' node scripts/seed-vibe-demo.mjs
 */
import {MongoClient, ObjectId} from 'mongodb';

const MONGODB_URI =
  process.env.MONGODB_URI ||
  `mongodb://127.0.0.1:${process.env.MEMORY_MONGO_PORT || 27017}`;
const DB_NAME = process.env.DB_NAME || 'vibe';
const EMAIL = process.env.EMAIL || 'test1000@test.com';

// Deterministic ids so the seed is re-runnable / removable.
const COURSE_ID = '64c000000000000000000001';
const VERSION_ID = '64c000000000000000000002';
const MODULE_ID = '64c000000000000000000003';
const SECTION_ID = '64c000000000000000000004';
const GROUP_ID = '64c000000000000000000005';
const VIDEO_ID = '64c000000000000000000006';
const SECTION_ID_2 = '64c000000000000000000007';
const GROUP_ID_2 = '64c000000000000000000008';
const VIDEO_ID_2 = '64c000000000000000000009';
const SECTION_ID_3 = '64c00000000000000000000a';
const GROUP_ID_3 = '64c00000000000000000000b';
const VIDEO_ID_3 = '64c00000000000000000000c';
const SECTION_ID_4 = '64c00000000000000000000d';
const GROUP_ID_4 = '64c00000000000000000000e';
const VIDEO_ID_4 = '64c00000000000000000000f';
const SECTION_ID_5 = '64c000000000000000000010';
const GROUP_ID_5 = '64c000000000000000000011';
const VIDEO_ID_5 = '64c000000000000000000012';
const COURSE_NAME = 'Seed Demo Course';

const client = new MongoClient(MONGODB_URI, {directConnection: true});

function logOK(label) {
  console.log(`  \u2713 ${label}`);
}

async function main() {
  await client.connect();
  const db = client.db(DB_NAME);

  const user = await db.collection('users').findOne({
    $or: [{email: EMAIL}, {firebaseUID: EMAIL}],
  });
  if (!user) {
    console.error(
      `\u2717 User not found in 'users' with email '${EMAIL}'. ` +
        'Log in as that user once so the backend auto-creates the DB user, then rerun.',
    );
    process.exitCode = 1;
    return;
  }
  const userId = user._id;
  console.log(`Seeding demo content for user ${EMAIL} (id: ${userId})`);

  // --- clean previous demo rows -------------------------------------------------
  await db.collection('enrollment').deleteMany({
    userId,
    courseId: new ObjectId(COURSE_ID),
    courseVersionId: new ObjectId(VERSION_ID),
  });
  await db.collection('progress').deleteMany({
    userId,
    courseId: new ObjectId(COURSE_ID),
    courseVersionId: new ObjectId(VERSION_ID),
  });
  await Promise.all([
    db.collection('videos').deleteMany({
      _id: {
        $in: [
          new ObjectId(VIDEO_ID), new ObjectId(VIDEO_ID_2), new ObjectId(VIDEO_ID_3),
          new ObjectId(VIDEO_ID_4), new ObjectId(VIDEO_ID_5),
        ],
      },
    }),
    db.collection('itemsGroup').deleteMany({
      _id: {
        $in: [
          new ObjectId(GROUP_ID), new ObjectId(GROUP_ID_2), new ObjectId(GROUP_ID_3),
          new ObjectId(GROUP_ID_4), new ObjectId(GROUP_ID_5),
        ],
      },
    }),
    db.collection('newCourseVersion').deleteMany({_id: new ObjectId(VERSION_ID)}),
    db.collection('newCourse').deleteMany({_id: new ObjectId(COURSE_ID)}),
  ]);
  logOK('cleared previous demo rows');

  const now = new Date();

  // 1) Course
  await db.collection('newCourse').insertOne({
    _id: new ObjectId(COURSE_ID),
    name: COURSE_NAME,
    description: 'Minimal seed course for streak/play testing.',
    versions: [new ObjectId(VERSION_ID)],
    instructors: [],
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });
  logOK('course created');

  // 2) Version with one module -> one section (points at the itemsGroup)
  await db.collection('newCourseVersion').insertOne({
    _id: new ObjectId(VERSION_ID),
    courseId: new ObjectId(COURSE_ID),
    version: 'v1',
    description: 'Version 1 of the seed demo course.',
    versionStatus: 'active',
    totalItems: 5,
    itemCounts: {VIDEO: 5},
    modules: [
      {
        moduleId: new ObjectId(MODULE_ID),
        name: 'Module 1',
        description: 'First demo module.',
        order: '0',
        isHidden: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        sections: [
          {
            sectionId: new ObjectId(SECTION_ID),
            name: 'Section 1',
            description: 'First demo section.',
            order: '0',
            isHidden: false,
            isDeleted: false,
            itemsGroupId: new ObjectId(GROUP_ID),
            createdAt: now,
            updatedAt: now,
          },
          {
            sectionId: new ObjectId(SECTION_ID_2),
            name: 'Section 2',
            description: 'Second demo section.',
            order: '1',
            isHidden: false,
            isDeleted: false,
            itemsGroupId: new ObjectId(GROUP_ID_2),
            createdAt: now,
            updatedAt: now,
          },
          {
            sectionId: new ObjectId(SECTION_ID_3),
            name: 'Section 3',
            description: 'Third demo section.',
            order: '2',
            isHidden: false,
            isDeleted: false,
            itemsGroupId: new ObjectId(GROUP_ID_3),
            createdAt: now,
            updatedAt: now,
          },
          {
            sectionId: new ObjectId(SECTION_ID_4),
            name: 'Section 4',
            description: 'Fourth demo section.',
            order: '3',
            isHidden: false,
            isDeleted: false,
            itemsGroupId: new ObjectId(GROUP_ID_4),
            createdAt: now,
            updatedAt: now,
          },
          {
            sectionId: new ObjectId(SECTION_ID_5),
            name: 'Section 5',
            description: 'Fifth demo section.',
            order: '4',
            isHidden: false,
            isDeleted: false,
            itemsGroupId: new ObjectId(GROUP_ID_5),
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    ],
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });
  logOK('course version (module + section) created');

  // 3) Items group referencing the real video item
  await db.collection('itemsGroup').insertOne({
    _id: new ObjectId(GROUP_ID),
    sectionId: new ObjectId(SECTION_ID),
    isHidden: false,
    isDeleted: false,
    items: [
      {
        name: 'Big Buck Bunny (Lesson 1)',
        type: 'VIDEO',
        order: '0',
        isHidden: false,
        _id: new ObjectId(VIDEO_ID),
      },
    ],
  });
  logOK('items group created');

  await db.collection('itemsGroup').insertOne({
    _id: new ObjectId(GROUP_ID_2),
    sectionId: new ObjectId(SECTION_ID_2),
    isHidden: false,
    isDeleted: false,
    items: [
      {
        name: 'Elephants Dream (Lesson 2)',
        type: 'VIDEO',
        order: '0',
        isHidden: false,
        _id: new ObjectId(VIDEO_ID_2),
      },
    ],
  });
  logOK('second items group created');

  for (const [gid, sid, vid, name, label] of [
    [GROUP_ID_3, SECTION_ID_3, VIDEO_ID_3, 'Sintel (Lesson 3)', 'third'],
    [GROUP_ID_4, SECTION_ID_4, VIDEO_ID_4, 'Tears of Steel (Lesson 4)', 'fourth'],
    [GROUP_ID_5, SECTION_ID_5, VIDEO_ID_5, 'Big Buck Bunny 4K (Lesson 5)', 'fifth'],
  ]) {
    await db.collection('itemsGroup').insertOne({
      _id: new ObjectId(gid),
      sectionId: new ObjectId(sid),
      isHidden: false,
      isDeleted: false,
      items: [
        {
          name,
          type: 'VIDEO',
          order: '0',
          isHidden: false,
          _id: new ObjectId(vid),
        },
      ],
    });
    logOK(`${label} items group created`);
  }

  // 4) Actual VIDEO items (each _id must match its group item ref).
  //    The app's player is YouTube-native (getYouTubeId in video.tsx) and the
  //    backend stores `details.URL` as a YouTube watch URL (ItemService.ts).
  //    So lessons use real, embeddable Blender open-movie URLs (CC-BY).
  const videos = [
    {
      _id: VIDEO_ID,
      name: 'Big Buck Bunny (Lesson 1)',
      description: 'Lesson 1 — Big Buck Bunny (Blender Foundation, CC-BY). Already watched.',
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
    {
      _id: VIDEO_ID_2,
      name: 'Elephants Dream (Lesson 2)',
      description: 'Lesson 2 — Elephants Dream (Blender Foundation, CC-BY).',
      url: 'https://www.youtube.com/watch?v=TLkA0RELQ1g',
    },
    {
      _id: VIDEO_ID_3,
      name: 'Sintel (Lesson 3)',
      description: 'Lesson 3 — Sintel (Blender Foundation, CC-BY).',
      url: 'https://www.youtube.com/watch?v=eRsGyueVLvQ',
    },
    {
      _id: VIDEO_ID_4,
      name: 'Tears of Steel (Lesson 4)',
      description: 'Lesson 4 — Tears of Steel (Blender Foundation, CC-BY).',
      url: 'https://www.youtube.com/watch?v=R6MlUcmOul8',
    },
    {
      _id: VIDEO_ID_5,
      name: 'Big Buck Bunny 4K (Lesson 5)',
      description: 'Lesson 5 — Big Buck Bunny 4K 60fps (Blender Foundation, CC-BY).',
      url: 'https://www.youtube.com/watch?v=YE7VzlLtp-4',
    },
  ];
  for (const v of videos) {
    await db.collection('videos').insertOne({
      _id: new ObjectId(v._id),
      name: v.name,
      description: v.description,
      type: 'VIDEO',
      isOptional: false,
      isHidden: false,
      isDeleted: false,
      details: {
        URL: v.url,
        startTime: '00:00:00',
        endTime: '00:10:00',
        points: 5,
      },
    });
  }
  logOK(`${videos.length} video items created`);

  // 5) Enroll the student
  await db.collection('enrollment').insertOne({
    userId,
    courseId: new ObjectId(COURSE_ID),
    courseVersionId: new ObjectId(VERSION_ID),
    role: 'STUDENT',
    status: 'ACTIVE',
    enrollmentDate: now,
    percentCompleted: 0,
    isDeleted: false,
    isEjected: false,
  });
  logOK('student enrolled');

  // 6) Progress row (required by the start/stop watch-time endpoints).
  //    currentItem = Lesson 2 so it starts unlocked; Lesson 1 is already
  //    completed via its existing watchTime (endTime present), keeping the
  //    streak at 1 until Lesson 2 is played tomorrow.
  await db.collection('progress').insertOne({
    userId,
    courseId: new ObjectId(COURSE_ID),
    courseVersionId: new ObjectId(VERSION_ID),
    currentModule: new ObjectId(MODULE_ID),
    currentSection: new ObjectId(SECTION_ID_2),
    currentItem: new ObjectId(VIDEO_ID_2),
    completed: false,
  });
  logOK('progress initialized');

  console.log('\nDone. Demo course "' + COURSE_NAME + '" ready.\n');
  console.log('  CourseID   ', COURSE_ID);
  console.log('  VersionID  ', VERSION_ID);
  console.log('  ModuleID   ', MODULE_ID);
  console.log('  SectionID  ', SECTION_ID);
  console.log('  VideoID    ', VIDEO_ID);
  console.log('  SectionID2 ', SECTION_ID_2);
  console.log('  VideoID2   ', VIDEO_ID_2);
  console.log('  SectionID3 ', SECTION_ID_3);
  console.log('  VideoID3   ', VIDEO_ID_3);
  console.log('  SectionID4 ', SECTION_ID_4);
  console.log('  VideoID4   ', VIDEO_ID_4);
  console.log('  SectionID5 ', SECTION_ID_5);
  console.log('  VideoID5   ', VIDEO_ID_5);
  console.log(
    '\nLog in as ' + EMAIL + ' in the UI and open the course to play the video.\n',
  );
}

main()
  .catch((err) => {
    console.error('\nSeed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => client.close());