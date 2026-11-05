import {describe, it, expect, beforeAll} from 'vitest';
import {ObjectId} from 'mongodb';
import {Container} from 'inversify';
import {useContainer} from 'routing-controllers';
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
 * The two commits fixing #1383's NotFoundError-retry-forever bug reasoned
 * that a throw from courseRepo.readVersion inside recoverOrphanedWatchTimes'
 * _withTransaction callback aborts the whole transaction -- including the
 * closeOrphanedWatchTime write that already ran earlier in the same
 * callback -- based on reading _withTransaction's abort call and MongoDB's
 * standard transaction guarantee, not by watching it happen.
 *
 * This exercises recoverOrphanedWatchTimes for real against the project's
 * own mongodb-memory-server replica set (test/globalSetup.ts -- a genuine
 * mongod, not a mock), through the real DI container and real repositories,
 * with no stubbed collaborators anywhere in the two functions under test.
 */

describe(
  'ProgressService.recoverOrphanedWatchTimes -- real MongoDB replica set',
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

    it('commits a real close when nothing throws (control case)', async () => {
      const userId = new ObjectId();
      const courseId = new ObjectId();
      const courseVersionId = new ObjectId();
      const itemId = new ObjectId();
      // Progress is parked on a different item, so advanceProgressAfterItemCompletion's
      // "already moved on" early return fires -- closes without ever needing
      // a real course version to exist.
      const otherCurrentItemId = new ObjectId();

      const blogs = await db.getCollection('blogs');
      const progress = await db.getCollection('progress');
      const watchTime = await db.getCollection('watchTime');

      await blogs.insertOne({
        _id: itemId,
        name: 'Real DB blog item',
        description: '',
        type: 'BLOG',
        details: {},
        isDeleted: false,
      } as any);

      await progress.insertOne({
        userId,
        courseId,
        courseVersionId,
        currentModule: new ObjectId(),
        currentSection: new ObjectId(),
        currentItem: otherCurrentItemId,
        completed: false,
        isDeleted: false,
      } as any);

      const watchTimeId = new ObjectId();
      const oldStart = new Date(Date.now() - 60 * 60 * 1000);
      await watchTime.insertOne({
        _id: watchTimeId,
        userId,
        courseId,
        courseVersionId,
        itemId,
        startTime: oldStart,
        isDeleted: false,
      } as any);

      const summary = await progressService.recoverOrphanedWatchTimes();

      expect(summary.closed).toBeGreaterThanOrEqual(1);
      expect(summary.advanced).toBe(0);

      const reloaded = await watchTime.findOne({_id: watchTimeId});
      // Real commit, read back with no session -- the write genuinely landed.
      expect(reloaded?.endTime).toBeInstanceOf(Date);
      expect(reloaded?.endTime?.getTime()).toBe(oldStart.getTime());
    });

    it('rolls back a real close when courseRepo.readVersion throws for a permanently deleted course version', async () => {
      const userId = new ObjectId();
      const courseId = new ObjectId();
      // Deliberately never created in newCourseVersion -- readVersion throws
      // NotFoundError for real, from the real CourseRepository.
      const courseVersionId = new ObjectId();
      const itemId = new ObjectId();

      const blogs = await db.getCollection('blogs');
      const progress = await db.getCollection('progress');
      const watchTime = await db.getCollection('watchTime');

      await blogs.insertOne({
        _id: itemId,
        name: 'Real DB blog item (deleted version case)',
        description: '',
        type: 'BLOG',
        details: {},
        isDeleted: false,
      } as any);

      // currentItem === itemId, so the "already moved on" early return does
      // NOT fire -- the sweep proceeds to courseRepo.readVersion.
      await progress.insertOne({
        userId,
        courseId,
        courseVersionId,
        currentModule: new ObjectId(),
        currentSection: new ObjectId(),
        currentItem: itemId,
        completed: false,
        isDeleted: false,
      } as any);

      const watchTimeId = new ObjectId();
      const oldStart = new Date(Date.now() - 60 * 60 * 1000);
      await watchTime.insertOne({
        _id: watchTimeId,
        userId,
        courseId,
        courseVersionId,
        itemId,
        startTime: oldStart,
        isDeleted: false,
      } as any);

      const summary = await progressService.recoverOrphanedWatchTimes();

      // closeOrphanedWatchTime DID run inside the transaction (before
      // readVersion threw) -- the point of this test is that its write does
      // not survive the abort.
      expect(summary.closed).toBe(0);
      expect(summary.advanced).toBe(0);
      expect(summary.rejected).toBeGreaterThanOrEqual(1);

      const reloaded = await watchTime.findOne({_id: watchTimeId});
      // The real, decisive assertion: read back with no session, after the
      // sweep has fully returned. If the transaction had NOT rolled back,
      // endTime would be set here despite the row being reported as
      // rejected/not closed -- a genuine data-integrity bug, not just a
      // miscounted summary.
      expect(reloaded?.endTime).toBeUndefined();
      // recoveryAttemptedAt is written by markRecoveryAttempted, which runs
      // after the loop, outside any transaction -- so it must survive even
      // though the close itself was rolled back.
      expect(reloaded?.recoveryAttemptedAt).toBeInstanceOf(Date);
    });
  },
);
