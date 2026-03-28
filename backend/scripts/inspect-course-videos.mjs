import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const courseId = process.argv.find(arg => arg.startsWith('--course-id='))?.split('=')[1];

if (!courseId) {
  console.error('Usage: node scripts/inspect-course-videos.mjs --course-id=<COURSE_ID>');
  process.exit(1);
}

if (!ObjectId.isValid(courseId)) {
  console.error(`Invalid course id: ${courseId}`);
  process.exit(1);
}

const uri = process.env.DB_URL;
const dbName = process.env.DB_NAME || 'vibe';

if (!uri) {
  console.error('DB_URL missing');
  process.exit(1);
}

const client = new MongoClient(uri);

try {
  await client.connect();

  const db = client.db(dbName);
  const versions = await db
    .collection('newCourseVersion')
    .find({
      courseId: new ObjectId(courseId),
      isDeleted: { $ne: true },
    })
    .toArray();

  const itemGroups = db.collection('itemsGroup');
  const videos = db.collection('videos');
  const rows = [];

  for (const version of versions) {
    for (const module of version.modules || []) {
      for (const section of module.sections || []) {
        const group = await itemGroups.findOne({
          _id: new ObjectId(section.itemsGroupId),
        });

        for (const item of group?.items || []) {
          if (item.type !== 'VIDEO') {
            continue;
          }

          const video = await videos.findOne(
            {
              _id: new ObjectId(item._id),
              isDeleted: { $ne: true },
            },
            {
              projection: {
                name: 1,
                description: 1,
                'details.URL': 1,
                'details.startTime': 1,
                'details.endTime': 1,
              },
            },
          );

          rows.push({
            videoId: String(item._id),
            name: video?.name || null,
            description: video?.description || null,
            url: video?.details?.URL || null,
            startTime: video?.details?.startTime || null,
            endTime: video?.details?.endTime || null,
          });
        }
      }
    }
  }

  console.log(JSON.stringify(rows, null, 2));
} finally {
  await client.close();
}