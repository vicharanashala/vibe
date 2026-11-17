import {ObjectId} from 'mongodb';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {AnalyticsRepository} from '../repositories/AnalyticsRepository.js';
import {AnalyticsSourceReader} from '../repositories/AnalyticsSourceReader.js';
import {AnalyticsProjector} from '../services/AnalyticsProjector.js';
import {AnalyticsQueryService} from '../services/AnalyticsQueryService.js';

export async function analyticsTestDb() {
  const db = new MongoDatabase(
    process.env.DB_URL!,
    `analytics_${new ObjectId().toHexString()}`,
  );
  await db.connect();
  const repo = new AnalyticsRepository(db);
  const source = new AnalyticsSourceReader(db);
  const projector = new AnalyticsProjector(repo, source);
  const query = new AnalyticsQueryService(repo);
  return {db, repo, source, projector, query, raw: db.database!};
}

export const ist = (s: string) => new Date(`${s}+05:30`);

/**
 * A course with two modules: m1 = [video v1, quiz q1], m2 = [video v2] plus a
 * hidden video in m2. Returns ids as hex strings.
 */
export async function seedCourse(raw: any) {
  const id = () => new ObjectId();
  const courseId = id();
  const versionId = id();
  const m1 = id();
  const m2 = id();
  const s1 = id();
  const s2 = id();
  const g1 = id();
  const g2 = id();
  const v1 = id();
  const q1 = id();
  const v2 = id();
  const hidden = id();
  const qa = id();
  const qb = id();
  await raw.collection('newCourseVersion').insertOne({
    _id: versionId,
    courseId,
    modules: [
      {
        moduleId: m2,
        name: 'Module 2',
        order: 'b',
        isHidden: false,
        sections: [
          {
            sectionId: s2,
            name: 'S2',
            order: 'a',
            isHidden: false,
            itemsGroupId: g2,
          },
        ],
      },
      {
        moduleId: m1,
        name: 'Module 1',
        order: 'a',
        isHidden: false,
        sections: [
          {
            sectionId: s1,
            name: 'S1',
            order: 'a',
            isHidden: false,
            itemsGroupId: g1,
          },
        ],
      },
    ],
  });
  await raw.collection('itemsGroup').insertMany([
    {
      _id: g1,
      items: [
        {_id: q1, type: 'QUIZ', order: 'b'},
        {_id: v1, type: 'VIDEO', order: 'a'},
      ],
    },
    {
      _id: g2,
      items: [
        {_id: v2, type: 'VIDEO', order: 'a'},
        {_id: hidden, type: 'VIDEO', order: 'b', isHidden: true},
      ],
    },
  ]);
  await raw.collection('videos').insertMany([
    {
      _id: v1,
      name: 'Intro video',
      details: {startTime: '00:00:00', endTime: '00:10:00'},
    },
    {
      _id: v2,
      name: 'Second video',
      details: {startTime: '00:00:00', endTime: '00:10:00'},
    },
    {
      _id: hidden,
      name: 'Hidden',
      details: {startTime: '00:00:00', endTime: '00:10:00'},
    },
  ]);
  await raw.collection('quizzes').insertOne({_id: q1, name: 'Checkpoint quiz'});
  await raw.collection('questions').insertMany([
    {_id: qa, text: 'Easy question'},
    {_id: qb, text: 'Hard question'},
  ]);
  const hex = (o: ObjectId) => o.toHexString();
  return {
    courseId: hex(courseId),
    versionId: hex(versionId),
    m1: hex(m1),
    m2: hex(m2),
    v1: hex(v1),
    q1: hex(q1),
    v2: hex(v2),
    hidden: hex(hidden),
    qa: hex(qa),
    qb: hex(qb),
  };
}

export async function addStudent(
  raw: any,
  c: Awaited<ReturnType<typeof seedCourse>>,
  opts: {
    role?: string;
    percent?: number;
    currentItem?: string;
    enrolledAt?: Date;
    guest?: boolean;
    quickShare?: boolean;
    email?: string;
    completed?: boolean;
    completedAt?: Date;
  } = {},
) {
  const userId = new ObjectId();
  await raw.collection('users').insertOne({
    _id: userId,
    firstName: 'Student',
    lastName: userId.toHexString().slice(-4),
    email: opts.email ?? `${userId.toHexString()}@example.com`,
  });
  await raw.collection('enrollment').insertOne({
    userId,
    courseId: new ObjectId(c.courseId),
    courseVersionId: new ObjectId(c.versionId),
    role: opts.role ?? 'STUDENT',
    status: 'ACTIVE',
    enrollmentDate: opts.enrolledAt ?? ist('2026-11-01T10:00:00'),
    percentCompleted: opts.percent ?? 0,
    ...(opts.guest ? {isShareLinkGuest: true} : {}),
    ...(opts.quickShare ? {isQuickShareContainer: true} : {}),
  });
  await raw.collection('progress').insertOne({
    userId,
    courseId: new ObjectId(c.courseId),
    courseVersionId: new ObjectId(c.versionId),
    currentItem: new ObjectId(opts.currentItem ?? c.v1),
    completed: opts.completed ?? false,
    ...(opts.completedAt ? {completedAt: opts.completedAt} : {}),
  });
  return userId.toHexString();
}

export async function watch(
  raw: any,
  c: Awaited<ReturnType<typeof seedCourse>>,
  userId: string,
  itemId: string,
  start: Date,
  end?: Date,
) {
  await raw.collection('watchTime').insertOne({
    userId: new ObjectId(userId),
    courseId: new ObjectId(c.courseId),
    courseVersionId: new ObjectId(c.versionId),
    itemId: new ObjectId(itemId),
    startTime: start,
    ...(end ? {endTime: end} : {}),
  });
}

export async function submit(
  raw: any,
  c: Awaited<ReturnType<typeof seedCourse>>,
  userId: string,
  at: Date,
  status: 'PASSED' | 'FAILED',
  score: number,
  feedback: {questionId: string; status: string}[] = [],
) {
  await raw.collection('quiz_submission_results').insertOne({
    quizId: new ObjectId(c.q1),
    userId: new ObjectId(userId),
    attemptId: new ObjectId(),
    submittedAt: at,
    gradingResult: {
      totalScore: score,
      totalMaxScore: 10,
      gradingStatus: status,
      overallFeedback: feedback.map(f => ({
        questionId: new ObjectId(f.questionId),
        status: f.status,
        score: 0,
      })),
    },
  });
}
