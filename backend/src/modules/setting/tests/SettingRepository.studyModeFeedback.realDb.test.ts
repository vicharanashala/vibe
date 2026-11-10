import {describe, it, expect, beforeAll} from 'vitest';
import {ObjectId} from 'mongodb';
import {Container} from 'inversify';
import {sharedContainerModule} from '#root/container.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {SettingRepository} from '#root/shared/database/providers/mongo/repositories/SettingRepository.js';

/**
 * Study-mode feedback is how phones answer (strict mode is PC-only), so it is
 * on unless a course turns it off.
 */
describe(
  'SettingRepository study-mode feedback -- real MongoDB',
  {timeout: 60000},
  () => {
    let repo: SettingRepository;

    beforeAll(async () => {
      const container = new Container();
      await container.load(sharedContainerModule);
      const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
      await db.connect();
      repo = new SettingRepository(db);
    });

    it('is on for a course with no settings document', async () => {
      expect(
        await repo.isStudyModeFeedbackAllowed(
          new ObjectId().toString(),
          new ObjectId().toString(),
        ),
      ).toBe(true);
    });

    it('can be turned off and back on', async () => {
      const course = new ObjectId().toString();
      const version = new ObjectId().toString();
      await repo.updateStudyModeFeedback(course, version, false);
      expect(await repo.isStudyModeFeedbackAllowed(course, version)).toBe(
        false,
      );
      await repo.updateStudyModeFeedback(course, version, true);
      expect(await repo.isStudyModeFeedbackAllowed(course, version)).toBe(true);
    });
  },
);
