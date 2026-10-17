// models.ts pulls in class-transformer decorators, which need the metadata
// polyfill loaded first — same first line as every other suite here.
import 'reflect-metadata';
import {describe, expect, it, vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {ForbiddenError} from 'routing-controllers';
import {HpAccessService} from '../services/hpAccessService.js';
import {COHORT_OVERRIDES} from '../constants.js';

const VERSION_ID = new ObjectId().toString();

function makeService(settings: unknown[] | null) {
  const settingsRepository = {
    getSettingsByVersionIds: vi.fn().mockResolvedValue(settings),
  };

  return {
    service: new HpAccessService(settingsRepository as never),
    settingsRepository,
  };
}

describe('HpAccessService', () => {
  it('treats a version with hpSystem on as enabled', async () => {
    const {service} = makeService([
      {courseVersionId: VERSION_ID, settings: {hpSystem: true}},
    ]);

    await expect(service.isEnabled(VERSION_ID)).resolves.toBe(true);
    await expect(service.assertEnabled(VERSION_ID)).resolves.toBeUndefined();
  });

  it('refuses writes once hpSystem is switched off', async () => {
    const {service} = makeService([
      {courseVersionId: VERSION_ID, settings: {hpSystem: false}},
    ]);

    await expect(service.isEnabled(VERSION_ID)).resolves.toBe(false);
    await expect(service.assertEnabled(VERSION_ID)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('refuses writes for a version that has no settings at all', async () => {
    const {service} = makeService([]);

    await expect(service.assertEnabled(VERSION_ID)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it.each([undefined, null, '', 'not-an-object-id'])(
    'refuses writes for the unusable version id %p',
    async versionId => {
      const {service, settingsRepository} = makeService([]);

      await expect(service.isEnabled(versionId)).resolves.toBe(false);
      expect(settingsRepository.getSettingsByVersionIds).not.toHaveBeenCalled();
    },
  );

  it('keeps the pre-settings legacy versions writable', async () => {
    const legacyVersionId = COHORT_OVERRIDES.Euclideans.versionId;
    const {service, settingsRepository} = makeService([]);

    await expect(service.isEnabled(legacyVersionId)).resolves.toBe(true);
    expect(settingsRepository.getSettingsByVersionIds).not.toHaveBeenCalled();
  });

  it('accepts an ObjectId as readily as a string', async () => {
    const {service} = makeService([
      {courseVersionId: VERSION_ID, settings: {hpSystem: true}},
    ]);

    await expect(service.isEnabled(new ObjectId(VERSION_ID))).resolves.toBe(
      true,
    );
  });
});
