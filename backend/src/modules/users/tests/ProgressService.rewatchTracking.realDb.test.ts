import {describe, it, expect, beforeAll} from 'vitest';
import {ObjectId} from 'mongodb';
import {Container} from 'inversify';
import {useContainer, NotFoundError} from 'routing-controllers';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {sharedContainerModule} from '#root/container.js';
import {usersContainerModule} from '../container.js';
import {coursesContainerModule} from '#root/modules/courses/container.js';
import {quizzesContainerModule} from '#root/modules/quizzes/container.js';
import {projectsContainerModule} from '#root/modules/projects/container.js';
import {authContainerModule} from '#root/modules/auth/container.js';
import {notificationsContainerModule} from '#root/modules/notifications/container.js';
import {anomaliesContainerModule} from '#root/modules/anomalies/container.js';
import {settingContainerModule} from '#root/modules/setting/container.js';
import {courseRegistrationContainerModule} from '#root/modules/courseRegistration/container.js';
import {reportsContainerModule} from '#root/modules/reports/container.js';
import {hpSystemContainerModule} from '#root/modules/hpSystem/container.js';
import {ejectionPolicyContainerModule} from '#root/modules/ejectionPolicy/container.js';
import {emotionsContainerModule} from '#root/modules/emotions/container.js';
import {genAIContainerModule} from '#root/modules/genAI/container.js';
import {studentQuestionsContainerModule} from '#root/modules/studentQuestions/container.js';
import {announcementsContainerModule} from '#root/modules/announcements/container.js';
import {auditTrailsContainerModule} from '#root/modules/auditTrails/container.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {ProgressService} from '../services/ProgressService.js';

/**
 * Rewatches of completed items are recorded in their own collection
 * (rewatchTime). The point of these tests is as much what must NOT happen as
 * what must: completion is modelled as "a watchTime row with a non-null
 * endTime", so a rewatch must never add to, or alter, watchTime or progress.
 *
 * Runs against the project's mongodb-memory-server replica set through the
 * real DI container and real repositories.
 */

describe(
  'ProgressService rewatch tracking -- real MongoDB replica set',
  {timeout: 60000},
  () => {
    let db: MongoDatabase;
    let progressService: ProgressService;

    beforeAll(async () => {
      const container = new Container();
      await container.load(
        sharedContainerModule,
        authContainerModule,
        usersContainerModule,
        coursesContainerModule,
        quizzesContainerModule,
        notificationsContainerModule,
        anomaliesContainerModule,
        settingContainerModule,
        courseRegistrationContainerModule,
        projectsContainerModule,
        reportsContainerModule,
        hpSystemContainerModule,
        ejectionPolicyContainerModule,
        emotionsContainerModule,
        genAIContainerModule,
        studentQuestionsContainerModule,
        announcementsContainerModule,
        auditTrailsContainerModule,
      );
      useContainer(new InversifyAdapter(container));
      db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
      await db.connect();
      progressService = container.get<ProgressService>(ProgressService);
    });

    /**
     * Seeds one learner on one item. `completed` decides whether the item's
     * watchTime row is closed (endTime set), which is what makes it completed.
     */
    async function seedLearner(completed: boolean) {
      const ids = {
        userId: new ObjectId(),
        courseId: new ObjectId(),
        courseVersionId: new ObjectId(),
        itemId: new ObjectId(),
        // Progress has moved on to a later item.
        currentItemId: new ObjectId(),
      };

      const progress = await db.getCollection('progress');
      const watchTime = await db.getCollection('watchTime');

      await progress.insertOne({
        userId: ids.userId,
        courseId: ids.courseId,
        courseVersionId: ids.courseVersionId,
        currentModule: new ObjectId(),
        currentSection: new ObjectId(),
        currentItem: ids.currentItemId,
        completed: false,
        isDeleted: false,
      } as any);

      const startTime = new Date(Date.now() - 10 * 60 * 1000);
      await watchTime.insertOne({
        userId: ids.userId,
        courseId: ids.courseId,
        courseVersionId: ids.courseVersionId,
        itemId: ids.itemId,
        startTime,
        ...(completed
          ? {endTime: new Date(startTime.getTime() + 5 * 60 * 1000)}
          : {}),
        isDeleted: false,
      } as any);

      return ids;
    }

    async function snapshot(ids: {userId: ObjectId; itemId: ObjectId}) {
      const progress = await db.getCollection('progress');
      const watchTime = await db.getCollection('watchTime');
      return {
        progress: await progress.find({userId: ids.userId}).toArray(),
        watchTime: await watchTime
          .find({userId: ids.userId, itemId: ids.itemId})
          .toArray(),
      };
    }

    it('records nothing when the item is not completed', async () => {
      const ids = await seedLearner(false);
      const rewatchTime = await db.getCollection('rewatchTime');

      const rewatchId = await progressService.startRewatch(
        ids.userId.toString(),
        ids.courseId.toString(),
        ids.courseVersionId.toString(),
        ids.itemId.toString(),
      );

      expect(rewatchId).toBe('');
      expect(await rewatchTime.countDocuments({userId: ids.userId})).toBe(0);
    });

    async function seedAttempt(userId: ObjectId, quizId: ObjectId) {
      const attempts = await db.getCollection('quiz_attempts');
      const attemptId = new ObjectId();
      await attempts.insertOne({
        _id: attemptId,
        userId,
        quizId,
        questionDetails: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      return attemptId;
    }

    it('creates a rewatch record when the item is completed', async () => {
      const ids = await seedLearner(true);
      const rewatchTime = await db.getCollection('rewatchTime');
      const quizId = new ObjectId();
      const attemptId = await seedAttempt(ids.userId, quizId);

      const rewatchId = await progressService.startRewatch(
        ids.userId.toString(),
        ids.courseId.toString(),
        ids.courseVersionId.toString(),
        ids.itemId.toString(),
        undefined,
        quizId.toString(),
        attemptId.toString(),
      );

      expect(ObjectId.isValid(rewatchId)).toBe(true);

      const record = await rewatchTime.findOne({_id: new ObjectId(rewatchId)});
      expect(record).toMatchObject({
        userId: ids.userId,
        courseId: ids.courseId,
        courseVersionId: ids.courseVersionId,
        itemId: ids.itemId,
        heartbeatCount: 0,
        quizId,
        attemptId,
      });
      expect(record?.startTime).toBeInstanceOf(Date);
      expect(record?.endTime).toBeUndefined();
    });

    it('keeps the quiz but drops an attempt that is not this learner\'s attempt at that quiz', async () => {
      const ids = await seedLearner(true);
      const rewatchTime = await db.getCollection('rewatchTime');
      const quizId = new ObjectId();
      const attemptAtAnotherQuiz = await seedAttempt(ids.userId, new ObjectId());
      const anotherLearnersAttempt = await seedAttempt(new ObjectId(), quizId);

      for (const attemptId of [attemptAtAnotherQuiz, anotherLearnersAttempt]) {
        const rewatchId = await progressService.startRewatch(
          ids.userId.toString(),
          ids.courseId.toString(),
          ids.courseVersionId.toString(),
          ids.itemId.toString(),
          undefined,
          quizId.toString(),
          attemptId.toString(),
        );

        const record = await rewatchTime.findOne({
          _id: new ObjectId(rewatchId),
        });
        expect(record?.quizId).toEqual(quizId);
        expect(record).not.toHaveProperty('attemptId');
      }
    });

    it('leaves out the quiz link when the learner did not come from a quiz', async () => {
      const ids = await seedLearner(true);
      const rewatchTime = await db.getCollection('rewatchTime');

      const rewatchId = await progressService.startRewatch(
        ids.userId.toString(),
        ids.courseId.toString(),
        ids.courseVersionId.toString(),
        ids.itemId.toString(),
      );

      const record = await rewatchTime.findOne({_id: new ObjectId(rewatchId)});
      expect(record).not.toBeNull();
      expect(record).not.toHaveProperty('quizId');
      expect(record).not.toHaveProperty('attemptId');
    });

    it('counts heartbeats, and the closing call stamps endTime without counting', async () => {
      const ids = await seedLearner(true);
      const rewatchTime = await db.getCollection('rewatchTime');

      const rewatchId = await progressService.startRewatch(
        ids.userId.toString(),
        ids.courseId.toString(),
        ids.courseVersionId.toString(),
        ids.itemId.toString(),
      );

      await progressService.recordRewatchHeartbeat(
        ids.userId.toString(),
        rewatchId,
      );
      await progressService.recordRewatchHeartbeat(
        ids.userId.toString(),
        rewatchId,
      );

      const playing = await rewatchTime.findOne({_id: new ObjectId(rewatchId)});
      expect(playing?.heartbeatCount).toBe(2);
      expect(playing?.lastSeenAt).toBeInstanceOf(Date);
      expect(playing?.endTime).toBeUndefined();

      await progressService.recordRewatchHeartbeat(
        ids.userId.toString(),
        rewatchId,
        true,
      );

      const ended = await rewatchTime.findOne({_id: new ObjectId(rewatchId)});
      expect(ended?.heartbeatCount).toBe(2);
      expect(ended?.endTime).toBeInstanceOf(Date);
    });

    it("rejects a heartbeat on another learner's record and leaves it unchanged", async () => {
      const ids = await seedLearner(true);
      const rewatchTime = await db.getCollection('rewatchTime');

      const rewatchId = await progressService.startRewatch(
        ids.userId.toString(),
        ids.courseId.toString(),
        ids.courseVersionId.toString(),
        ids.itemId.toString(),
      );

      await expect(
        progressService.recordRewatchHeartbeat(
          new ObjectId().toString(),
          rewatchId,
        ),
      ).rejects.toBeInstanceOf(NotFoundError);

      const record = await rewatchTime.findOne({_id: new ObjectId(rewatchId)});
      expect(record?.heartbeatCount).toBe(0);
      expect(record?.lastSeenAt).toBeUndefined();
    });

    it('does not touch watchTime or progress, and stays invisible to the orphan recovery job', async () => {
      const ids = await seedLearner(true);
      const rewatchTime = await db.getCollection('rewatchTime');
      const before = await snapshot(ids);

      const rewatchId = await progressService.startRewatch(
        ids.userId.toString(),
        ids.courseId.toString(),
        ids.courseVersionId.toString(),
        ids.itemId.toString(),
      );
      await progressService.recordRewatchHeartbeat(
        ids.userId.toString(),
        rewatchId,
      );

      // The rewatch record is left open (no endTime) and backdated well past
      // the recovery job's age threshold, which is exactly the shape that job
      // sweeps for in watchTime.
      await rewatchTime.updateOne(
        {_id: new ObjectId(rewatchId)},
        {$set: {startTime: new Date(Date.now() - 24 * 60 * 60 * 1000)}},
      );
      await progressService.recoverOrphanedWatchTimes();

      expect(await snapshot(ids)).toEqual(before);

      const record = await rewatchTime.findOne({_id: new ObjectId(rewatchId)});
      expect(record?.endTime).toBeUndefined();
      expect(record).not.toHaveProperty('recoveryAttemptedAt');
    });
  },
);
