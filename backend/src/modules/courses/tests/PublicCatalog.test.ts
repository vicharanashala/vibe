import 'reflect-metadata';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {Db, MongoClient, ObjectId} from 'mongodb';
import {MongoMemoryServer} from 'mongodb-memory-server';

import {SettingRepository} from '#shared/database/providers/mongo/repositories/SettingRepository.js';

/**
 * Tests for SettingRepository.getPublicCatalog — the query behind the student
 * "Available courses" tab (CourseService.getPublicCourses).
 *
 * The catalog is a union of two independent sources: cohorts flagged
 * `isPublic` and courseSettings flagged `settings.isPublic`. The cohort branch
 * originally ignored the course-level flag, so a public cohort published a
 * private course to every student — the "Pinternship - Euclideans" leak, where
 * the offending cohort row had been inserted by a migration script with
 * `isPublic: true` hardcoded and was not visible in Manage Cohorts.
 *
 * Runs against an in-process MongoDB so the aggregation pipeline itself is
 * exercised (no DB stubs) without needing an external cluster.
 */
describe('getPublicCatalog', () => {
  let mongo: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let repo: SettingRepository;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    client = new MongoClient(mongo.getUri());
    await client.connect();
    db = client.db('catalog-test');

    // getPublicCatalog only needs getCollection(); no session is passed, so a
    // standalone server (no replica set) is enough.
    const fakeDatabase = {
      getCollection: async (name: string) => db.collection(name),
    };
    repo = new SettingRepository(fakeDatabase as any);
  });

  afterAll(async () => {
    await client?.close();
    await mongo?.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      ['newCourse', 'newCourseVersion', 'courseSettings', 'cohorts'].map(c =>
        db.collection(c).deleteMany({}),
      ),
    );
  });

  /**
   * Creates a course + version + settings, and optionally one cohort.
   * Mirrors the shape the app writes, including the fields the pipeline reads.
   */
  async function seedCourse(opts: {
    name: string;
    coursePublic: boolean;
    versionStatus?: string;
    versionDeleted?: boolean;
    cohort?: {name: string; isPublic: boolean; isActive?: boolean};
  }) {
    const courseId = new ObjectId();
    const versionId = new ObjectId();
    const cohortId = new ObjectId();

    await db.collection('newCourse').insertOne({
      _id: courseId,
      name: opts.name,
      description: `${opts.name} description`,
    });

    await db.collection('newCourseVersion').insertOne({
      _id: versionId,
      courseId,
      version: 'v1.0',
      description: 'version description',
      versionStatus: opts.versionStatus ?? 'active',
      ...(opts.versionDeleted ? {isDeleted: true} : {}),
    });

    await db.collection('courseSettings').insertOne({
      courseId,
      courseVersionId: versionId,
      settings: {isPublic: opts.coursePublic},
    });

    if (opts.cohort) {
      await db.collection('cohorts').insertOne({
        _id: cohortId,
        name: opts.cohort.name,
        courseId,
        courseVersionId: versionId,
        isPublic: opts.cohort.isPublic,
        isDeleted: false,
        ...(opts.cohort.isActive === undefined
          ? {}
          : {isActive: opts.cohort.isActive}),
      });
    }

    return {courseId, versionId, cohortId};
  }

  const catalog = (
    enrolledVersionIds: string[] = [],
    enrolledCohortIds: string[] = [],
    search = '',
  ) => repo.getPublicCatalog(enrolledVersionIds, enrolledCohortIds, 0, 50, search);

  it('does not list a private course just because one of its cohorts is public', async () => {
    await seedCourse({
      name: 'Pinternship - Euclideans',
      coursePublic: false,
      cohort: {name: 'Euclideans', isPublic: true},
    });

    expect(await catalog()).toEqual([]);
  });

  it('lists a public cohort of a public course', async () => {
    await seedCourse({
      name: 'Open Course',
      coursePublic: true,
      cohort: {name: 'Cohort A', isPublic: true},
    });

    const result = await catalog();

    const cohortRow = result.find(r => r.type === 'COHORT');
    expect(cohortRow).toMatchObject({
      type: 'COHORT',
      cohortName: 'Cohort A',
      courseName: 'Open Course',
    });
  });

  it('lists a public course that has no cohorts', async () => {
    await seedCourse({name: 'Solo Course', coursePublic: true});

    expect(await catalog()).toMatchObject([
      {type: 'COURSE', courseName: 'Solo Course', cohortName: null},
    ]);
  });

  it('excludes a non-public cohort of a public course', async () => {
    await seedCourse({
      name: 'Open Course',
      coursePublic: true,
      cohort: {name: 'Private Cohort', isPublic: false},
    });

    const result = await catalog();

    expect(result.map(r => r.type)).toEqual(['COURSE']);
  });

  it('excludes a deactivated cohort but keeps one with no isActive field', async () => {
    await seedCourse({
      name: 'Closed Cohort Course',
      coursePublic: true,
      cohort: {name: 'Closed', isPublic: true, isActive: false},
    });
    await seedCourse({
      name: 'Legacy Cohort Course',
      coursePublic: true,
      cohort: {name: 'Legacy', isPublic: true}, // isActive absent
    });

    const cohortNames = (await catalog())
      .filter(r => r.type === 'COHORT')
      .map(r => r.cohortName);

    expect(cohortNames).toEqual(['Legacy']);
  });

  it('excludes archived and deleted versions from both branches', async () => {
    await seedCourse({
      name: 'Archived Course',
      coursePublic: true,
      versionStatus: 'archived',
      cohort: {name: 'Archived Cohort', isPublic: true},
    });
    await seedCourse({
      name: 'Deleted Version Course',
      coursePublic: true,
      versionDeleted: true,
      cohort: {name: 'Deleted Version Cohort', isPublic: true},
    });

    expect(await catalog()).toEqual([]);
  });

  it('excludes a course the student is already enrolled in', async () => {
    const {versionId} = await seedCourse({
      name: 'Enrolled Course',
      coursePublic: true,
    });

    expect(await catalog([versionId.toString()])).toEqual([]);
  });

  it('excludes a cohort the student is already enrolled in', async () => {
    const {cohortId} = await seedCourse({
      name: 'Enrolled Cohort Course',
      coursePublic: true,
      cohort: {name: 'Joined', isPublic: true},
    });

    const result = await catalog([], [cohortId.toString()]);

    expect(result.map(r => r.type)).toEqual(['COURSE']);
  });

  it('matches the search term against course and cohort names', async () => {
    await seedCourse({
      name: 'Algorithms',
      coursePublic: true,
      cohort: {name: 'Euclideans', isPublic: true},
    });
    await seedCourse({name: 'Databases', coursePublic: true});

    expect((await catalog([], [], 'euclid')).map(r => r.cohortName)).toEqual([
      'Euclideans',
    ]);
    expect((await catalog([], [], 'databases')).map(r => r.courseName)).toEqual([
      'Databases',
    ]);
  });
});
