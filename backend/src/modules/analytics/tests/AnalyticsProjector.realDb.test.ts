import {describe, it, expect, beforeEach} from 'vitest';
import {ObjectId} from 'mongodb';
import {
  addStudent,
  analyticsTestDb,
  ist,
  seedCourse,
  submit,
  watch,
} from './fixtures.js';

const NOW = ist('2026-11-17T12:00:00');
const later = (min: number) => new Date(NOW.getTime() + min * 60 * 1000);

describe('AnalyticsRepository: lease and indexes (1.2, 1.3)', () => {
  it('gives exactly one winner to concurrent lease requests and lets an expired lease be retaken', async () => {
    const {repo} = await analyticsTestDb();
    const results = await Promise.all(
      Array.from({length: 5}, (_, i) =>
        repo.acquireLease('v1', 'c1', `owner-${i}`, NOW),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    // Still held a minute later…
    expect(await repo.acquireLease('v1', 'c1', 'late', later(1))).toBe(false);
    // …but free once it has expired.
    expect(await repo.acquireLease('v1', 'c1', 'late', later(60))).toBe(true);
  });

  it('creates the read-side source indexes on init', async () => {
    const {repo, raw} = await analyticsTestDb();
    await repo.init();
    const names = async (col: string) =>
      (await raw.collection(col).indexes()).map((i: any) => i.name);
    expect(await names('anomaly_records')).toContain(
      'analytics_versionId_createdAt',
    );
    expect(await names('user_activity_events')).toContain(
      'analytics_courseVersionId_updatedAt',
    );
    expect(await names('studyViews')).toContain(
      'analytics_courseVersionId_firstStudiedAt',
    );
  });
});

describe('AnalyticsProjector against a real database', () => {
  let t: Awaited<ReturnType<typeof analyticsTestDb>>;
  let c: Awaited<ReturnType<typeof seedCourse>>;

  beforeEach(async () => {
    t = await analyticsTestDb();
    c = await seedCourse(t.raw);
  });

  it('roster excludes staff, guests and quick-share holders, and drops unenrolled learners (2.1)', async () => {
    const student = await addStudent(t.raw, c);
    const removedLater = await addStudent(t.raw, c);
    await addStudent(t.raw, c, {role: 'INSTRUCTOR'});
    await addStudent(t.raw, c, {guest: true});
    await addStudent(t.raw, c, {quickShare: true});
    await t.projector.rebuildVersion(c.courseId, c.versionId, NOW);
    let rows = await t.repo.getLearners(c.versionId);
    expect(rows.map(r => r.userId).sort()).toEqual(
      [student, removedLater].sort(),
    );

    await t.raw
      .collection('enrollment')
      .updateOne(
        {userId: new ObjectId(removedLater)},
        {$set: {status: 'INACTIVE'}},
      );
    await t.projector.refreshVersion(c.courseId, c.versionId, later(10));
    rows = await t.repo.getLearners(c.versionId);
    expect(rows.map(r => r.userId)).toEqual([student]);
  });

  it('an instructor watching their own course changes no figure', async () => {
    const s = await addStudent(t.raw, c);
    await watch(
      t.raw,
      c,
      s,
      c.v1,
      ist('2026-11-16T10:00:00'),
      ist('2026-11-16T10:10:00'),
    );
    await t.projector.rebuildVersion(c.courseId, c.versionId, NOW);
    const before = await t.query.overview(c.versionId, 30, NOW);

    const instructor = await addStudent(t.raw, c, {role: 'INSTRUCTOR'});
    await watch(t.raw, c, instructor, c.v1, later(-30), later(-20));
    await t.projector.refreshVersion(c.courseId, c.versionId, later(10));
    const after = await t.query.overview(c.versionId, 30, later(10));
    expect({...after, updatedAt: null}).toEqual({...before, updatedAt: null});
  });

  it('new activity appears after a refresh; a quiet day is zero; one student twice a day counts once (3.1, 3.2)', async () => {
    const s = await addStudent(t.raw, c);
    await t.projector.rebuildVersion(c.courseId, c.versionId, NOW);
    let ov = await t.query.overview(c.versionId, 7, NOW);
    expect(ov.status).toBe('ready');
    expect(
      ov.daily!.every(d => d.learningHours === 0 && d.activeLearners === 0),
    ).toBe(true);

    // Two videos on the same day.
    await watch(t.raw, c, s, c.v1, later(1), later(11));
    await watch(t.raw, c, s, c.v2, later(12), later(22));
    await t.raw
      .collection('progress')
      .updateOne(
        {userId: new ObjectId(s)},
        {$set: {currentItem: new ObjectId(c.q1)}},
      );
    await t.projector.refreshVersion(c.courseId, c.versionId, later(30));
    ov = await t.query.overview(c.versionId, 7, later(30));
    const today = ov.daily!.at(-1)!;
    expect(today.activeLearners).toBe(1);
    expect(today.learningHours).toBeCloseTo(20 / 60, 2);
    expect(ov.daily!.slice(0, -1).every(d => d.activeLearners === 0)).toBe(
      true,
    );
    expect(ov.videos!.find(v => v.itemId === c.v1)).toMatchObject({
      started: 1,
      completed: 1,
    });
    expect(ov.whereNow![0]).toMatchObject({itemId: c.q1, students: 1});
  });

  it('a version with no new activity is skipped', async () => {
    await addStudent(t.raw, c);
    await t.projector.rebuildVersion(c.courseId, c.versionId, NOW);
    const r = await t.projector.refreshVersion(
      c.courseId,
      c.versionId,
      later(10),
    );
    expect(r.outcome).toBe('skipped');
    expect(r.learnersRecomputed).toBe(0);
    expect((await t.repo.getState(c.versionId))!.lastRefreshedAt).toEqual(
      later(10),
    );
  });

  it('a refresh that fails midway leaves the watermark, and a rerun gives the same figures with nothing double-counted (3.2)', async () => {
    const s = await addStudent(t.raw, c);
    await t.projector.rebuildVersion(c.courseId, c.versionId, NOW);
    const wm = (await t.repo.getState(c.versionId))!.watermark;

    await watch(t.raw, c, s, c.v1, later(1), later(11));
    t.projector.beforeAggregate = () => {
      throw new Error('boom');
    };
    await expect(
      t.projector.refreshVersion(c.courseId, c.versionId, later(30)),
    ).rejects.toThrow('boom');
    expect((await t.repo.getState(c.versionId))!.watermark).toEqual(wm);

    t.projector.beforeAggregate = undefined;
    await t.projector.refreshVersion(c.courseId, c.versionId, later(31));
    await t.projector.refreshVersion(c.courseId, c.versionId, later(32));
    const ov = await t.query.overview(c.versionId, 7, later(32));
    expect(ov.daily!.at(-1)!.learningHours).toBeCloseTo(10 / 60, 2);
    expect(ov.headline!.learningHours.current).toBeCloseTo(0.2, 1);
  });

  it('rebuild after incremental refreshes gives identical documents and corrects drift (3.3)', async () => {
    const a = await addStudent(t.raw, c);
    const b = await addStudent(t.raw, c);
    await t.projector.rebuildVersion(c.courseId, c.versionId, NOW);
    await watch(t.raw, c, a, c.v1, later(1), later(11));
    await submit(t.raw, c, b, later(2), 'FAILED', 3, [
      {questionId: c.qa, status: 'CORRECT'},
      {questionId: c.qb, status: 'INCORRECT'},
    ]);
    await submit(t.raw, c, b, later(4), 'PASSED', 9);
    await t.projector.refreshVersion(c.courseId, c.versionId, later(10));
    const incremental = await t.query.overview(c.versionId, 30, later(10));

    // Drift a stored figure, then rebuild.
    await t.raw
      .collection('ca_course_daily')
      .updateMany({versionId: c.versionId}, {$set: {learningSeconds: 999999}});
    await t.projector.rebuildVersion(c.courseId, c.versionId, later(10));
    const rebuilt = await t.query.overview(c.versionId, 30, later(10));
    expect(rebuilt).toEqual(incremental);

    const quiz = rebuilt.quizzes!.find(q => q.itemId === c.q1)!;
    expect(quiz).toMatchObject({
      attempted: 1,
      firstAttemptPassRate: 0,
      avgAttemptsToPass: 2,
    });
    expect(quiz.hardestQuestions[0]).toMatchObject({
      text: 'Hard question',
      correctRate: 0,
    });
    expect(quiz.scoreBands[3]).toBe(1);
  });

  it('first build pending reports building (backfill requirement)', async () => {
    await addStudent(t.raw, c);
    expect(await t.query.overview(c.versionId, 30, NOW)).toEqual({
      status: 'building',
      updatedAt: null,
      range: 30,
    });
  });

  it('never writes to a learning record (3.4)', async () => {
    const s = await addStudent(t.raw, c);
    await watch(t.raw, c, s, c.v1, later(1), later(11));
    await watch(t.raw, c, s, c.v2, later(12));
    await submit(t.raw, c, s, later(13), 'FAILED', 2, [
      {questionId: c.qa, status: 'INCORRECT'},
    ]);
    await t.raw.collection('anomaly_records').insertOne({
      userId: new ObjectId(s),
      versionId: new ObjectId(c.versionId),
      type: 'NO_FACE',
      createdAt: later(5),
    });
    await t.raw.collection('studyViews').insertOne({
      userId: new ObjectId(s),
      courseVersionId: new ObjectId(c.versionId),
      itemId: new ObjectId(c.v2),
      firstStudiedAt: later(6),
    });
    await t.raw.collection('user_activity_events').insertOne({
      userId: new ObjectId(s),
      courseVersionId: new ObjectId(c.versionId),
      videoId: new ObjectId(c.v1),
      rewindData: [{to: '00:04:12', createdAt: later(7)}],
      updatedAt: later(7),
    });
    await t.raw
      .collection('quiz_attempts')
      .insertOne({userId: new ObjectId(s)});

    const sources = [
      'enrollment',
      'progress',
      'watchTime',
      'quiz_attempts',
      'quiz_submission_results',
      'anomaly_records',
      'studyViews',
      'user_activity_events',
    ];
    const snapshot = async () => {
      const out: Record<string, string> = {};
      for (const name of sources)
        out[name] = JSON.stringify(
          await t.raw.collection(name).find().sort({_id: 1}).toArray(),
        );
      return out;
    };
    const before = await snapshot();
    await t.projector.rebuildVersion(c.courseId, c.versionId, later(30));
    await watch(t.raw, c, s, c.v1, later(31), later(35));
    const mid = await snapshot();
    await t.projector.refreshVersion(c.courseId, c.versionId, later(40));
    expect(await snapshot()).toEqual(mid);
    expect(Object.keys(before)).toEqual(sources);

    const ov = await t.query.overview(c.versionId, 7, later(40));
    expect(ov.videos!.find(v => v.itemId === c.v1)!.rewindHotspots).toEqual([
      {startSecond: 250, rewinds: 1},
    ]);
    expect(ov.studyMode).toEqual({strictOnly: 0, studyOnly: 0, both: 1});
    expect(ov.proctoring!.shareWithIncident).toBe(1);
  });
});
