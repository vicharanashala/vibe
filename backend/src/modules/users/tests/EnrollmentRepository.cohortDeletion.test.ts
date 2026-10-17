import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Db, MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';

describe('EnrollmentRepository.enrollmentExistsByCohortId', () => {
  let mongo: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let repo: EnrollmentRepository;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    client = new MongoClient(mongo.getUri());
    await client.connect();
    db = client.db('cohort-deletion-test');

    repo = new EnrollmentRepository({
      getCollection: async (name: string) => db.collection(name),
    } as any);
  });

  afterAll(async () => {
    await client?.close();
    await mongo?.stop();
  });

  beforeEach(async () => {
    await db.collection('enrollment').deleteMany({});
  });

  it('does not block cohort deletion when only inactive, soft-deleted, or ejected enrollments reference it', async () => {
    const versionId = new ObjectId();
    const cohortId = new ObjectId();

    await db.collection('enrollment').insertMany([
      {
        _id: new ObjectId(),
        userId: new ObjectId(),
        courseId: new ObjectId(),
        courseVersionId: versionId,
        cohortId,
        role: 'STUDENT',
        status: 'INACTIVE',
        isDeleted: false,
        isEjected: false,
      },
      {
        _id: new ObjectId(),
        userId: new ObjectId(),
        courseId: new ObjectId(),
        courseVersionId: versionId,
        cohortId,
        role: 'STUDENT',
        status: 'ACTIVE',
        isDeleted: true,
        isEjected: false,
      },
      {
        _id: new ObjectId(),
        userId: new ObjectId(),
        courseId: new ObjectId(),
        courseVersionId: versionId,
        cohortId,
        role: 'STUDENT',
        status: 'ACTIVE',
        isDeleted: false,
        isEjected: true,
      },
    ] as any);

    await expect(
      repo.enrollmentExistsByCohortId(versionId.toString(), cohortId.toString()),
    ).resolves.toBe(false);
  });

  it('blocks cohort deletion when an active, non-deleted, non-ejected enrollment still references it', async () => {
    const versionId = new ObjectId();
    const cohortId = new ObjectId();

    await db.collection('enrollment').insertOne({
      _id: new ObjectId(),
      userId: new ObjectId(),
      courseId: new ObjectId(),
      courseVersionId: versionId,
      cohortId,
      role: 'STUDENT',
      status: 'ACTIVE',
      isDeleted: false,
      isEjected: false,
    } as any);

    await expect(
      repo.enrollmentExistsByCohortId(versionId.toString(), cohortId.toString()),
    ).resolves.toBe(true);
  });

  it('does not block cohort deletion for enrollments referencing a different cohort', async () => {
    const versionId = new ObjectId();
    const cohortId = new ObjectId();
    const otherCohortId = new ObjectId();

    await db.collection('enrollment').insertOne({
      _id: new ObjectId(),
      userId: new ObjectId(),
      courseId: new ObjectId(),
      courseVersionId: versionId,
      cohortId: otherCohortId,
      role: 'STUDENT',
      status: 'ACTIVE',
      isDeleted: false,
      isEjected: false,
    } as any);

    await expect(
      repo.enrollmentExistsByCohortId(versionId.toString(), cohortId.toString()),
    ).resolves.toBe(false);
  });

  it('blocks cohort deletion when courseVersionId/cohortId are stored as strings', async () => {
    const versionId = new ObjectId();
    const cohortId = new ObjectId();

    await db.collection('enrollment').insertOne({
      _id: new ObjectId(),
      userId: new ObjectId(),
      courseId: new ObjectId(),
      courseVersionId: versionId.toString(),
      cohortId: cohortId.toString(),
      role: 'STUDENT',
      status: 'ACTIVE',
      isDeleted: false,
      isEjected: false,
    } as any);

    await expect(
      repo.enrollmentExistsByCohortId(versionId.toString(), cohortId.toString()),
    ).resolves.toBe(true);
  });

  it('does not block cohort deletion when the enrollment is missing status/isDeleted fields entirely', async () => {
    const versionId = new ObjectId();
    const cohortId = new ObjectId();

    await db.collection('enrollment').insertOne({
      _id: new ObjectId(),
      userId: new ObjectId(),
      courseId: new ObjectId(),
      courseVersionId: versionId,
      cohortId,
      role: 'STUDENT',
      // status / isDeleted / isEjected intentionally omitted (legacy doc shape)
    } as any);

    await expect(
      repo.enrollmentExistsByCohortId(versionId.toString(), cohortId.toString()),
    ).resolves.toBe(false);
  });
});

describe('EnrollmentRepository.clearCohortReferences', () => {
  let mongo: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let repo: EnrollmentRepository;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    client = new MongoClient(mongo.getUri());
    await client.connect();
    db = client.db('cohort-deletion-clear-test');

    repo = new EnrollmentRepository({
      getCollection: async (name: string) => db.collection(name),
    } as any);
  });

  afterAll(async () => {
    await client?.close();
    await mongo?.stop();
  });

  beforeEach(async () => {
    await db.collection('enrollment').deleteMany({});
    await db.collection('progress').deleteMany({});
  });

  it('nulls out cohortId on matching enrollments and progress docs, leaving other cohorts untouched', async () => {
    const cohortId = new ObjectId();
    const otherCohortId = new ObjectId();

    const enrollmentId = new ObjectId();
    const otherEnrollmentId = new ObjectId();

    await db.collection('enrollment').insertMany([
      {
        _id: enrollmentId,
        userId: new ObjectId(),
        cohortId,
        role: 'STUDENT',
        status: 'INACTIVE',
        isDeleted: false,
        isEjected: true,
      },
      {
        _id: otherEnrollmentId,
        userId: new ObjectId(),
        cohortId: otherCohortId,
        role: 'STUDENT',
        status: 'ACTIVE',
        isDeleted: false,
        isEjected: false,
      },
    ] as any);

    const progressId = new ObjectId();
    await db.collection('progress').insertOne({
      _id: progressId,
      userId: new ObjectId(),
      cohortId,
    } as any);

    await repo.clearCohortReferences(cohortId.toString());

    const clearedEnrollment = await db
      .collection('enrollment')
      .findOne({ _id: enrollmentId });
    expect(clearedEnrollment.cohortId).toBeNull();

    const untouchedEnrollment = await db
      .collection('enrollment')
      .findOne({ _id: otherEnrollmentId });
    expect(untouchedEnrollment.cohortId).toEqual(otherCohortId);

    const clearedProgress = await db
      .collection('progress')
      .findOne({ _id: progressId });
    expect(clearedProgress.cohortId).toBeNull();
  });
});
