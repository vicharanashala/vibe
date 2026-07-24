import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';

/**
 * Repository-level tests for EnrollmentRepository.getCourseCompletions,
 * which backs the `/integrations/courses/:courseId/completions` endpoint.
 * Runs against the in-memory Mongo replica set started in test/globalSetup.ts.
 */
describe('EnrollmentRepository.getCourseCompletions', () => {
  let db: MongoDatabase;
  let repo: EnrollmentRepository;

  const courseId = new ObjectId();
  const otherCourseId = new ObjectId();
  const courseVersionId = new ObjectId();

  const finisher = { _id: new ObjectId(), email: 'finisher@example.com', firstName: 'Fin', lastName: 'Isher' };
  const finisher2 = { _id: new ObjectId(), email: 'finisher2@example.com', firstName: 'Fin2', lastName: 'Isher2' };
  const activeLearner = { _id: new ObjectId(), email: 'active@example.com', firstName: 'Act', lastName: 'Ive' };
  const ejectedFinisher = { _id: new ObjectId(), email: 'ejected@example.com', firstName: 'Eje', lastName: 'Cted' };
  const otherCourseFinisher = { _id: new ObjectId(), email: 'othercourse@example.com', firstName: 'Other', lastName: 'Course' };

  beforeAll(async () => {
    db = new MongoDatabase(process.env.DB_URL, 'enrollment_repo_course_completions_test');
    await db.connect();
    repo = new EnrollmentRepository(db);

    const users = await db.getCollection('users');
    await users.insertMany([finisher, finisher2, activeLearner, ejectedFinisher, otherCourseFinisher] as any);

    const enrollments = await db.getCollection('enrollment');
    await enrollments.insertMany([
      {
        userId: finisher._id,
        courseId,
        courseVersionId,
        role: 'STUDENT',
        status: 'ACTIVE',
        enrollmentDate: new Date('2026-01-01'),
        percentCompleted: 100,
        isDeleted: false,
      },
      {
        userId: finisher2._id,
        courseId,
        courseVersionId,
        role: 'STUDENT',
        status: 'ACTIVE',
        enrollmentDate: new Date('2026-01-01'),
        percentCompleted: 100,
        isDeleted: false,
      },
      {
        userId: activeLearner._id,
        courseId,
        courseVersionId,
        role: 'STUDENT',
        status: 'ACTIVE',
        enrollmentDate: new Date('2026-01-01'),
        percentCompleted: 40,
        isDeleted: false,
      },
      // Completed the course, but the enrollment itself is no longer active
      // (e.g. unenrolled/ejected afterwards) — should NOT be reported.
      {
        userId: ejectedFinisher._id,
        courseId,
        courseVersionId,
        role: 'STUDENT',
        status: 'INACTIVE',
        enrollmentDate: new Date('2026-01-01'),
        percentCompleted: 100,
        isDeleted: false,
      },
      // Completed a *different* course — should not leak into this course's results.
      {
        userId: otherCourseFinisher._id,
        courseId: otherCourseId,
        courseVersionId,
        role: 'STUDENT',
        status: 'ACTIVE',
        enrollmentDate: new Date('2026-01-01'),
        percentCompleted: 100,
        isDeleted: false,
      },
    ] as any);

    const progress = await db.getCollection('progress');
    await progress.insertMany([
      {
        userId: finisher._id,
        courseId,
        courseVersionId,
        completed: true,
        completedAt: new Date('2026-02-01'),
      },
      {
        userId: finisher2._id,
        courseId,
        courseVersionId,
        completed: true,
        completedAt: new Date('2026-02-15'),
      },
      {
        userId: activeLearner._id,
        courseId,
        courseVersionId,
        completed: false,
      },
      {
        userId: ejectedFinisher._id,
        courseId,
        courseVersionId,
        completed: true,
        completedAt: new Date('2026-02-05'),
      },
      {
        userId: otherCourseFinisher._id,
        courseId: otherCourseId,
        courseVersionId,
        completed: true,
        completedAt: new Date('2026-02-10'),
      },
    ] as any);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it('returns only active-enrollment candidates who completed the given course, earliest first', async () => {
    const { total, candidates } = await repo.getCourseCompletions(
      courseId.toString(),
      0,
      50,
    );

    expect(total).toBe(2);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      userId: finisher._id.toString(),
      email: 'finisher@example.com',
      name: 'Fin Isher',
      courseVersionId: courseVersionId.toString(),
    });
    expect(new Date(candidates[0].completedAt).toISOString()).toBe(
      new Date('2026-02-01').toISOString(),
    );
    expect(candidates[1].userId).toBe(finisher2._id.toString());
  });

  it('excludes learners who have not completed the course', async () => {
    const { candidates } = await repo.getCourseCompletions(courseId.toString(), 0, 50);
    expect(candidates.some(c => c.userId === activeLearner._id.toString())).toBe(false);
  });

  it('excludes completions tied to an inactive enrollment', async () => {
    const { candidates } = await repo.getCourseCompletions(courseId.toString(), 0, 50);
    expect(candidates.some(c => c.userId === ejectedFinisher._id.toString())).toBe(false);
  });

  it('scopes results to the requested course only', async () => {
    const { total, candidates } = await repo.getCourseCompletions(
      otherCourseId.toString(),
      0,
      50,
    );
    expect(total).toBe(1);
    expect(candidates[0].userId).toBe(otherCourseFinisher._id.toString());
  });

  it('paginates via skip/limit', async () => {
    const page1 = await repo.getCourseCompletions(courseId.toString(), 0, 1);
    expect(page1.total).toBe(2);
    expect(page1.candidates).toHaveLength(1);
    expect(page1.candidates[0].userId).toBe(finisher._id.toString());

    const page2 = await repo.getCourseCompletions(courseId.toString(), 1, 1);
    expect(page2.candidates).toHaveLength(1);
    expect(page2.candidates[0].userId).toBe(finisher2._id.toString());

    const page3 = await repo.getCourseCompletions(courseId.toString(), 2, 1);
    expect(page3.candidates).toHaveLength(0);
  });

  it('returns an empty result for a course with no completions', async () => {
    const { total, candidates } = await repo.getCourseCompletions(
      new ObjectId().toString(),
      0,
      50,
    );
    expect(total).toBe(0);
    expect(candidates).toHaveLength(0);
  });
});
