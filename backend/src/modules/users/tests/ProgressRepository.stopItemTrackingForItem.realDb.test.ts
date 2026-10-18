import {describe, it, expect, beforeAll} from 'vitest';
import {ObjectId} from 'mongodb';
import {Container} from 'inversify';
import {sharedContainerModule} from '#root/container.js';
import {usersContainerModule} from '../container.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {USERS_TYPES} from '#users/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {ProgressRepository} from '#root/shared/database/providers/mongo/repositories/ProgressRepository.js';

/**
 * stopItemTrackingForItem against the project's mongodb-memory-server replica
 * set (test/globalSetup.ts). The case that matters is the stale watchItemId a
 * client sends after a refresh: it must close the student's open session for
 * the item, never someone else's or another item's.
 */
describe(
  'ProgressRepository.stopItemTrackingForItem -- real MongoDB',
  {timeout: 60000},
  () => {
    let db: MongoDatabase;
    let repo: ProgressRepository;

    beforeAll(async () => {
      const container = new Container();
      await container.load(sharedContainerModule, usersContainerModule);
      db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
      await db.connect();
      repo = container.get<ProgressRepository>(USERS_TYPES.ProgressRepo);
    });

    function ids() {
      return {
        userId: new ObjectId(),
        courseId: new ObjectId(),
        courseVersionId: new ObjectId(),
        itemId: new ObjectId(),
      };
    }

    async function insertSession(
      fields: Record<string, unknown>,
      minutesAgo: number,
      closed = false,
    ) {
      const watchTime = await db.getCollection('watchTime');
      const _id = new ObjectId();
      const startTime = new Date(Date.now() - minutesAgo * 60 * 1000);
      await watchTime.insertOne({
        _id,
        ...fields,
        startTime,
        ...(closed ? {endTime: new Date()} : {}),
      } as any);
      return _id;
    }

    async function endTimeOf(_id: ObjectId) {
      const watchTime = await db.getCollection('watchTime');
      return (await watchTime.findOne({_id}))?.endTime;
    }

    it('closes the given session when it is the open one for this item', async () => {
      const s = ids();
      const id = await insertSession(s, 5);

      const closed = await repo.stopItemTrackingForItem(
        id.toString(),
        s.userId.toString(),
        s.courseId.toString(),
        s.courseVersionId.toString(),
        s.itemId.toString(),
      );

      expect(closed?._id.toString()).toBe(id.toString());
      expect(await endTimeOf(id)).toBeInstanceOf(Date);
    });

    it("falls back to the latest open session when the id is another item's closed session", async () => {
      const s = ids();
      const previousItemSession = await insertSession(
        {...s, itemId: new ObjectId()},
        20,
        true,
      );
      const beforeRefresh = await insertSession(s, 15);
      const afterRefresh = await insertSession(s, 5);

      const closed = await repo.stopItemTrackingForItem(
        previousItemSession.toString(),
        s.userId.toString(),
        s.courseId.toString(),
        s.courseVersionId.toString(),
        s.itemId.toString(),
      );

      expect(closed?._id.toString()).toBe(afterRefresh.toString());
      expect(await endTimeOf(beforeRefresh)).toBeUndefined();
    });

    it("never closes another student's session, even when given its id", async () => {
      const s = ids();
      const otherStudents = await insertSession(
        {...s, userId: new ObjectId()},
        5,
      );

      const closed = await repo.stopItemTrackingForItem(
        otherStudents.toString(),
        s.userId.toString(),
        s.courseId.toString(),
        s.courseVersionId.toString(),
        s.itemId.toString(),
      );

      expect(closed).toBeNull();
      expect(await endTimeOf(otherStudents)).toBeUndefined();
    });

    it('returns null when the student has no open session for the item', async () => {
      const s = ids();
      const done = await insertSession(s, 10, true);

      const closed = await repo.stopItemTrackingForItem(
        done.toString(),
        s.userId.toString(),
        s.courseId.toString(),
        s.courseVersionId.toString(),
        s.itemId.toString(),
      );

      expect(closed).toBeNull();
    });
  },
);
