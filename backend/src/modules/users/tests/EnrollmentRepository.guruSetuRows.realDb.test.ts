import {describe, it, expect, beforeAll} from 'vitest';
import {ObjectId} from 'mongodb';
import {Container} from 'inversify';
import {sharedContainerModule} from '#root/container.js';
import {usersContainerModule} from '../container.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {USERS_TYPES} from '#users/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {EnrollmentRepository} from '#root/shared/database/providers/mongo/repositories/EnrollmentRepository.js';

/**
 * The Gurusetu watch + feedback export (used by the old frontend) must keep
 * returning exactly these rows after its data gathering moved into the shared
 * method the course feedback export also uses.
 */
describe(
  'EnrollmentRepository.getGuruSetuFeedbackRows -- real MongoDB',
  {timeout: 60000},
  () => {
    let db: MongoDatabase;
    let repo: EnrollmentRepository;

    beforeAll(async () => {
      const container = new Container();
      await container.load(sharedContainerModule, usersContainerModule);
      db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
      await db.connect();
      repo = container.get<EnrollmentRepository>(USERS_TYPES.EnrollmentRepo);
    });

    async function seed() {
      const tag = new ObjectId().toString();
      const courseId = new ObjectId();
      const versionId = new ObjectId();
      const groupId = new ObjectId();
      const video1 = new ObjectId();
      const video2 = new ObjectId();
      const form1 = new ObjectId();
      const asha = new ObjectId();
      const ravi = new ObjectId();
      const cohort = new ObjectId();
      await (
        await db.getCollection('newCourseVersion')
      ).insertOne({
        _id: versionId,
        courseId,
        modules: [
          {
            moduleId: new ObjectId(),
            name: 'M1',
            order: 'a',
            sections: [
              {
                sectionId: new ObjectId(),
                name: 'S1',
                order: 'a',
                itemsGroupId: groupId,
              },
            ],
          },
        ],
      } as any);
      await (
        await db.getCollection('itemsGroup')
      ).insertOne({
        _id: groupId,
        items: [
          {_id: video1, type: 'VIDEO', order: 'a', name: 'Intro'},
          {_id: form1, type: 'FEEDBACK', order: 'b', name: 'Intro feedback'},
          {_id: video2, type: 'VIDEO', order: 'c', name: 'Deep dive'},
        ],
      } as any);
      await (
        await db.getCollection('videos')
      ).insertMany([
        {
          _id: video1,
          name: 'Intro',
          details: {startTime: '00:00:00', endTime: '00:10:00'},
        },
        {
          _id: video2,
          name: 'Deep dive',
          details: {startTime: '00:00:00', endTime: '00:05:00'},
        },
      ] as any);
      await (
        await db.getCollection('feedback_forms')
      ).insertOne({_id: form1, name: 'Intro feedback'} as any);
      await (
        await db.getCollection('users')
      ).insertMany([
        {
          _id: asha,
          firebaseUID: `a-${tag}`,
          firstName: 'Asha',
          lastName: 'Rao',
          email: `a-${tag}@example.com`,
        },
        {
          _id: ravi,
          firebaseUID: `r-${tag}`,
          firstName: 'Ravi',
          lastName: 'K',
          email: `r-${tag}@example.com`,
        },
      ] as any);
      await (
        await db.getCollection('enrollment')
      ).insertMany([
        {
          userId: asha,
          courseId,
          courseVersionId: versionId,
          role: 'STUDENT',
          status: 'ACTIVE',
          cohortId: cohort,
        },
        {
          userId: ravi,
          courseId,
          courseVersionId: versionId,
          role: 'STUDENT',
          status: 'ACTIVE',
        },
      ] as any);
      const t = (min: number) => new Date(Date.UTC(2026, 10, 1, 10, min));
      await (
        await db.getCollection('watchTime')
      ).insertMany([
        // 6 min, then a left-open 30 min session clamped to the 10 min video
        {
          userId: asha,
          courseVersionId: versionId,
          itemId: video1,
          startTime: t(0),
          endTime: t(6),
        },
        {
          userId: asha,
          courseVersionId: versionId,
          itemId: video1.toString(),
          startTime: t(10),
          endTime: t(40),
        },
      ] as any);
      await (
        await db.getCollection('feedback_submission')
      ).insertMany([
        {
          userId: asha,
          courseVersionId: versionId,
          feedbackFormId: form1,
          previousItemId: video1,
          previousItemType: 'VIDEO',
          details: {Name: 'A', Email: 'x', Useful: 'old'},
          createdAt: t(7),
          updatedAt: t(7),
        },
        {
          userId: asha,
          courseVersionId: versionId,
          feedbackFormId: form1,
          previousItemId: video1,
          previousItemType: 'VIDEO',
          details: {Name: 'A', Email: 'x', Useful: 'yes'},
          createdAt: t(8),
          updatedAt: t(8),
        },
      ] as any);
      return {courseId, versionId, cohort, tag, t};
    }

    it('returns one row per student per video, with capped watch and latest feedback', async () => {
      const {courseId, versionId, tag, t} = await seed();
      const rows = await repo.getGuruSetuFeedbackRows(
        courseId.toString(),
        versionId.toString(),
      );
      expect(rows.map(r => [r.userEmail, r.videoName])).toEqual([
        [`a-${tag}@example.com`, 'Deep dive'],
        [`a-${tag}@example.com`, 'Intro'],
        [`r-${tag}@example.com`, 'Deep dive'],
        [`r-${tag}@example.com`, 'Intro'],
      ]);
      const ashaIntro = rows[1];
      expect(ashaIntro).toMatchObject({
        userFirstName: 'Asha',
        userLastName: 'Rao',
        videoDurationSeconds: 600,
        rawWatchedSeconds: 600,
        watchPercentage: 100,
        watchSessionCount: 2,
        firstWatchAt: t(0),
        lastWatchAt: t(10),
        feedbackFormName: 'Intro feedback',
        Useful: 'yes',
        feedbackSubmittedAt: t(8),
      });
      expect(ashaIntro).not.toHaveProperty('Name');
      expect(ashaIntro).not.toHaveProperty('Email');
      expect(rows[3]).toMatchObject({
        rawWatchedSeconds: 0,
        watchPercentage: 0,
        watchSessionCount: 0,
      });
      expect(rows[3].feedbackFormName).toBeUndefined();
    });

    it('limits to one cohort', async () => {
      const {courseId, versionId, cohort, tag} = await seed();
      const rows = await repo.getGuruSetuFeedbackRows(
        courseId.toString(),
        versionId.toString(),
        cohort.toString(),
      );
      expect(new Set(rows.map(r => r.userEmail))).toEqual(
        new Set([`a-${tag}@example.com`]),
      );
    });
  },
);
