import {describe, it, expect, beforeEach, afterAll} from 'vitest';
import {ObjectId} from 'mongodb';
import {
  addStudent,
  analyticsTestDb,
  closeAnalyticsTestDb,
  ist,
  seedCourse,
  submit,
  watch,
} from './fixtures.js';

const NOW = ist('2026-11-17T12:00:00');
const later = (min: number) => new Date(NOW.getTime() + min * 60 * 1000);

afterAll(closeAnalyticsTestDb);

// Real-database tests can be slow on a loaded machine.
describe(
  'AnalyticsRepository: lease and indexes (1.2, 1.3)',
  {timeout: 30000},
  () => {
    it('gives exactly one winner to concurrent lease requests and lets an expired lease be retaken', async () => {
      const {repo} = await analyticsTestDb();
      await repo.createBuildState('v1', 'c1', 0, NOW);
      const results = await Promise.all(
        Array.from({length: 5}, (_, i) =>
          repo.acquireLease('v1', `owner-${i}`, NOW),
        ),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
      // Still held a few seconds later…
      expect(await repo.acquireLease('v1', 'late', later(0.1))).toBe(false);
      // …but free once it has expired.
      expect(await repo.acquireLease('v1', 'late', later(60))).toBe(true);
    });

    it('lets only one recompute hold a learner, and hands dirty learners back to the holder', async () => {
      const {repo} = await analyticsTestDb();
      await repo.init();
      const [a, b] = await Promise.all([
        repo.lockLearners('v1', ['u1', 'u2'], 'A', NOW),
        repo.lockLearners('v1', ['u1', 'u2'], 'B', NOW),
      ]);
      expect([...a, ...b].sort()).toEqual(['u1', 'u2']);
      const holder = a.includes('u1') ? 'A' : 'B';
      await repo.markDirty('v1', 'u1');
      const again = await repo.releaseLearners('v1', ['u1'], holder, NOW);
      expect(again).toEqual(['u1']);
      expect(await repo.releaseLearners('v1', ['u1'], holder, NOW)).toEqual([]);
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
  },
);

describe('AnalyticsProjector against a real database', {timeout: 30000}, () => {
  let t: Awaited<ReturnType<typeof analyticsTestDb>>;
  let c: Awaited<ReturnType<typeof seedCourse>>;

  /** Requests the overview until the build is done (as the page's polling does). */
  async function build(at = NOW) {
    for (let i = 0; i < 50; i++) {
      const ov = await t.query.overview(c.courseId, c.versionId, 30, at);
      if (ov.status === 'ready') return ov;
    }
    throw new Error('build never finished');
  }

  /** Every stored counter row, normalised for comparison. */
  async function counters() {
    const canon = (v: any): any =>
      v && typeof v === 'object' && !(v instanceof Date)
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map(k => [k, canon(v[k])]),
          )
        : v;
    const strip = (rows: any[]) =>
      rows.map(({_id, ...r}) => JSON.stringify(canon(r))).sort();
    const norm = (rows: any[]) =>
      strip(
        rows.map(r => {
          // Zero fields are harmless leftovers of increments; drop them.
          const out: any = {};
          const walk = (src: any, dst: any) => {
            for (const [k, v] of Object.entries(src)) {
              if (v && typeof v === 'object' && !(v instanceof Date)) {
                dst[k] = {};
                walk(v, dst[k]);
                if (!Object.keys(dst[k]).length) delete dst[k];
              } else if (typeof v === 'number') {
                const r6 = Math.round(v * 1e6) / 1e6;
                if (r6 !== 0) dst[k] = r6;
              } else dst[k] = v;
            }
          };
          walk(r, out);
          return out;
        }),
      );
    return {
      daily: norm(await t.raw.collection('ca_course_daily').find().toArray()),
      heat: norm(await t.raw.collection('ca_course_heatmap').find().toArray()),
      items: norm(await t.raw.collection('ca_item_stats').find().toArray()),
    };
  }

  /** Counters a from-scratch rebuild would produce right now. */
  async function rebuiltCounters(at = NOW) {
    await t.projector.resetVersion(c.versionId);
    await build(at);
    return counters();
  }

  beforeEach(async () => {
    t = await analyticsTestDb();
    c = await seedCourse(t.raw);
  });

  it('builds gradually on first view: progress, then the full figures (5.1 rework)', async () => {
    for (let i = 0; i < 5; i++) await addStudent(t.raw, c);
    t.projector.stepLearners = 2;
    const progress: number[] = [];
    let ov = await t.query.overview(c.courseId, c.versionId, 30, NOW);
    while (ov.status === 'building') {
      progress.push(ov.buildProgress!);
      expect(ov.headline).toBeUndefined();
      ov = await t.query.overview(c.courseId, c.versionId, 30, NOW);
    }
    expect(progress).toEqual([40, 80]);
    expect(ov.status).toBe('ready');
    expect(ov.headline!.students.current).toBe(5);
  });

  it('roster excludes staff, guests and quick-share holders, and an unenrol event drops the learner (2.1)', async () => {
    const student = await addStudent(t.raw, c);
    const removedLater = await addStudent(t.raw, c);
    await addStudent(t.raw, c, {role: 'INSTRUCTOR'});
    await addStudent(t.raw, c, {guest: true});
    await addStudent(t.raw, c, {quickShare: true});
    await build();
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
    await t.projector.learnerChanged(c.versionId, removedLater, later(10));
    rows = await t.repo.getLearners(c.versionId);
    expect(rows.map(r => r.userId)).toEqual([student]);
    expect(await counters()).toEqual(await rebuiltCounters(later(10)));
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
    const before = await build();

    const instructor = await addStudent(t.raw, c, {role: 'INSTRUCTOR'});
    await watch(t.raw, c, instructor, c.v1, later(-30), later(-20));
    await t.projector.learnerChanged(c.versionId, instructor, later(10));
    const after = await t.query.overview(c.courseId, c.versionId, 30, NOW);
    expect(after).toEqual(before);
  });

  it('an event shows on the next request; a quiet day is zero; one student twice a day counts once (3.1, 3.2)', async () => {
    const s = await addStudent(t.raw, c);
    let ov = await build();
    expect(
      ov.daily!.every(d => d.learningHours === 0 && d.activeLearners === 0),
    ).toBe(true);

    // Two videos on the same day, each followed by its event.
    await watch(t.raw, c, s, c.v1, later(1), later(11));
    await t.projector.learnerChanged(c.versionId, s, later(12));
    await watch(t.raw, c, s, c.v2, later(12), later(22));
    await t.raw
      .collection('progress')
      .updateOne(
        {userId: new ObjectId(s)},
        {$set: {currentItem: new ObjectId(c.q1)}},
      );
    await t.projector.learnerChanged(c.versionId, s, later(23));
    ov = await t.query.overview(c.courseId, c.versionId, 7, later(30));
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

  it('the same event processed twice changes nothing the second time (3.2)', async () => {
    const s = await addStudent(t.raw, c);
    await build();
    await watch(t.raw, c, s, c.v1, later(1), later(11));
    await submit(t.raw, c, s, later(12), 'PASSED', 8);
    await t.projector.learnerChanged(c.versionId, s, later(13));
    const once = await counters();
    await t.projector.learnerChanged(c.versionId, s, later(14));
    await t.projector.learnerChanged(c.versionId, s, later(15));
    expect(await counters()).toEqual(once);
  });

  it('concurrent recomputes leave the counters equal to the sum of the learner rows (3.2)', async () => {
    const a = await addStudent(t.raw, c);
    const b = await addStudent(t.raw, c);
    await build();
    await watch(t.raw, c, a, c.v1, later(1), later(11));
    await submit(t.raw, c, b, later(2), 'FAILED', 3, [
      {questionId: c.qa, status: 'CORRECT'},
      {questionId: c.qb, status: 'INCORRECT'},
    ]);
    await submit(t.raw, c, b, later(4), 'PASSED', 9);
    await Promise.all([
      ...Array.from({length: 4}, () =>
        t.projector.learnerChanged(c.versionId, a, later(5)),
      ),
      ...Array.from({length: 4}, () =>
        t.projector.learnerChanged(c.versionId, b, later(5)),
      ),
    ]);
    const live = await counters();
    const liveOverview = await t.query.overview(
      c.courseId,
      c.versionId,
      30,
      later(10),
    );
    expect(live).toEqual(await rebuiltCounters(later(10)));
    const quiz = liveOverview.quizzes!.find(q => q.itemId === c.q1)!;
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

  it('an interrupted build resumes from its cursor, skips events after the cursor, and counts events during the build exactly once (3.3)', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) ids.push(await addStudent(t.raw, c));
    const sorted = [...ids].sort();
    t.projector.stepLearners = 2;

    // Step 1 builds the first two learners, then the teacher leaves.
    let ov = await t.query.overview(c.courseId, c.versionId, 30, NOW);
    expect(ov).toMatchObject({status: 'building', buildProgress: 33});
    const state = (await t.repo.getState(c.versionId))!;
    expect(state.cursorUserId).toBe(sorted[1]);

    // Events meanwhile: one learner already built, one not yet reached.
    await watch(t.raw, c, sorted[0], c.v1, later(1), later(11));
    await t.projector.learnerChanged(c.versionId, sorted[0], later(12));
    await watch(t.raw, c, sorted[5], c.v1, later(2), later(12));
    await t.projector.learnerChanged(c.versionId, sorted[5], later(13));
    expect(
      (await t.repo.getLearners(c.versionId)).map(l => l.userId).sort(),
    ).toEqual(sorted.slice(0, 2));

    // The teacher comes back; the build continues where it stopped.
    do ov = await t.query.overview(c.courseId, c.versionId, 30, later(20));
    while (ov.status === 'building');
    expect(ov.daily!.at(-1)!.activeLearners).toBe(2);
    expect(await counters()).toEqual(await rebuiltCounters(later(20)));
  });

  it('two concurrent build steps do one step (3.3)', async () => {
    for (let i = 0; i < 4; i++) await addStudent(t.raw, c);
    t.projector.stepLearners = 2;
    await t.projector.buildStep(c.courseId, c.versionId, NOW); // creates state, step 1
    const [r1, r2] = await Promise.all([
      t.projector.buildStep(c.courseId, c.versionId, NOW),
      t.projector.buildStep(c.courseId, c.versionId, NOW),
    ]);
    expect(r1.processed + r2.processed).toBe(2);
  });

  it('a rebuild drops drifted figures and rebuilds them exactly (3.3)', async () => {
    const s = await addStudent(t.raw, c);
    await watch(t.raw, c, s, c.v1, later(-50), later(-40));
    await build();
    const good = await counters();
    await t.raw
      .collection('ca_course_daily')
      .updateMany({versionId: c.versionId}, {$set: {learningSeconds: 999999}});
    expect(await counters()).not.toEqual(good);
    await t.projector.resetVersion(c.versionId);
    expect(
      (await t.query.overview(c.courseId, c.versionId, 30, NOW)).status,
    ).toBe('ready'); // tiny course: one step
    expect(await counters()).toEqual(good);
  });

  it('computes inactivity when read, with no event (3.4)', async () => {
    const s = await addStudent(t.raw, c);
    await watch(
      t.raw,
      c,
      s,
      c.v1,
      ist('2026-11-01T10:00:00'),
      ist('2026-11-01T10:10:00'),
    );
    await build(ist('2026-11-02T12:00:00'));
    const ov = await t.query.overview(
      c.courseId,
      c.versionId,
      30,
      ist('2026-11-09T12:00:00'),
    );
    expect(ov.checkOn).toEqual([
      expect.objectContaining({
        userId: s,
        reason: 'inactive',
        daysSinceActive: 8,
      }),
    ]);
  });

  it('sweeps a learner whose recompute was cut short before reading figures (3.2)', async () => {
    const s = await addStudent(t.raw, c);
    await build();
    await watch(t.raw, c, s, c.v1, later(1), later(11));
    // An event marked the learner but its instance died before recomputing.
    await t.repo.markDirty(c.versionId, s);
    const ov = await t.query.overview(c.courseId, c.versionId, 7, later(20));
    expect(ov.videos!.find(v => v.itemId === c.v1)!.completed).toBe(1);
  });

  it('does nothing for a version without analytics (4.1)', async () => {
    const s = await addStudent(t.raw, c);
    await t.projector.learnerChanged(c.versionId, s, NOW);
    expect(await t.raw.collection('ca_learner_locks').countDocuments()).toBe(0);
    expect(await t.raw.collection('ca_learners').countDocuments()).toBe(0);
  });

  it('picks up enrolments that fired no event, at the next roster check (4.1)', async () => {
    await addStudent(t.raw, c);
    await build();
    // Enrolled inside another service's transaction: no event.
    await addStudent(t.raw, c);
    let ov = await t.query.overview(c.courseId, c.versionId, 30, later(1));
    expect(ov.headline!.students.current).toBe(1); // checked < 5 min ago
    ov = await t.query.overview(c.courseId, c.versionId, 30, later(6));
    expect(ov.headline!.students.current).toBe(2);
    expect(await counters()).toEqual(await rebuiltCounters(later(6)));
  });

  it('never writes to a learning record (3.5)', async () => {
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
    await build(later(30));
    expect(await snapshot()).toEqual(before);
    await watch(t.raw, c, s, c.v1, later(31), later(35));
    const mid = await snapshot();
    await t.projector.learnerChanged(c.versionId, s, later(36));
    await t.projector.resetVersion(c.versionId);
    await build(later(40));
    expect(await snapshot()).toEqual(mid);

    const ov = await t.query.overview(c.courseId, c.versionId, 7, later(40));
    expect(ov.videos!.find(v => v.itemId === c.v1)!.rewindHotspots).toEqual([
      {startSecond: 250, rewinds: 1},
    ]);
    expect(ov.studyMode).toEqual({strictOnly: 0, studyOnly: 0, both: 1});
    expect(ov.proctoring!.shareWithIncident).toBe(1);
  });
});
