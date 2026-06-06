import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestError, ForbiddenError, NotFoundError } from 'routing-controllers';
import { CourseSettingService } from '../services/CourseSettingService.js';

/**
 * Unit tests for CourseSettingService.updateFollowUpInvite — the per-course
 * "follow-up invite" configuration that, on course completion, auto-invites a
 * student to a follow-up course. These tests focus on the validation branches,
 * especially the cohort-required path (the case where the follow-up course
 * version uses cohorts and a cohort must be selected at configuration time).
 *
 * The DB is bypassed by stubbing BaseService._withTransaction so no MongoDB
 * connection is required.
 */

const SOURCE_COURSE = 'c1';
const SOURCE_VERSION = 'v1';
const TARGET_COURSE = 'c2';
const TARGET_VERSION = 'v2';

function makeService(opts: {
  targetCohorts?: string[];
  targetCourseExists?: boolean;
  targetVersionExists?: boolean;
  targetVersionStatus?: 'active' | 'archived';
  sourceVersionStatus?: 'active' | 'archived';
} = {}) {
  const {
    targetCohorts = [],
    targetCourseExists = true,
    targetVersionExists = true,
    targetVersionStatus = 'active',
    sourceVersionStatus = 'active',
  } = opts;

  const settingsRepo = {
    // Existing settings doc so readCourseSettings() doesn't try to create one.
    readCourseSettings: vi.fn().mockResolvedValue({
      courseId: SOURCE_COURSE,
      courseVersionId: SOURCE_VERSION,
      settings: { proctors: { detectors: [] } },
    }),
    updateFollowUpInvite: vi.fn().mockResolvedValue({ acknowledged: true }),
    createCourseSettings: vi.fn(),
  };

  const courseRepo = {
    read: vi.fn().mockResolvedValue(
      targetCourseExists ? { _id: TARGET_COURSE, name: 'Target Course' } : null,
    ),
    readVersion: vi.fn().mockResolvedValue(
      targetVersionExists
        ? { _id: TARGET_VERSION, cohorts: targetCohorts }
        : null,
    ),
    getCourseVersionStatus: vi.fn().mockImplementation((versionId: string) =>
      Promise.resolve(
        versionId === SOURCE_VERSION ? sourceVersionStatus : targetVersionStatus,
      ),
    ),
  };

  const db = {} as any;
  const svc = new CourseSettingService(
    settingsRepo as any,
    courseRepo as any,
    db,
  );

  // Run transaction callbacks immediately with a dummy session — no real DB.
  vi.spyOn(svc as any, '_withTransaction').mockImplementation((fn: any) =>
    fn({}),
  );

  return { svc, settingsRepo, courseRepo };
}

describe('CourseSettingService.updateFollowUpInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists the config when the target course has no cohorts', async () => {
    const { svc, settingsRepo } = makeService({ targetCohorts: [] });

    const result = await svc.updateFollowUpInvite(SOURCE_COURSE, SOURCE_VERSION, {
      enabled: true,
      courseId: TARGET_COURSE,
      courseVersionId: TARGET_VERSION,
    });

    expect(result).toBe(true);
    expect(settingsRepo.updateFollowUpInvite).toHaveBeenCalledOnce();
    expect(settingsRepo.updateFollowUpInvite.mock.calls[0][2]).toMatchObject({
      enabled: true,
      courseId: TARGET_COURSE,
      courseVersionId: TARGET_VERSION,
    });
  });

  it('rejects enabling when the target version has cohorts but no cohort is selected', async () => {
    const { svc, settingsRepo } = makeService({ targetCohorts: ['cohortA', 'cohortB'] });

    await expect(
      svc.updateFollowUpInvite(SOURCE_COURSE, SOURCE_VERSION, {
        enabled: true,
        courseId: TARGET_COURSE,
        courseVersionId: TARGET_VERSION,
        // cohortId intentionally omitted
      }),
    ).rejects.toThrowError(/cohort/i);

    expect(settingsRepo.updateFollowUpInvite).not.toHaveBeenCalled();
  });

  it('rejects an invalid cohort that does not belong to the target version', async () => {
    const { svc, settingsRepo } = makeService({ targetCohorts: ['cohortA', 'cohortB'] });

    await expect(
      svc.updateFollowUpInvite(SOURCE_COURSE, SOURCE_VERSION, {
        enabled: true,
        courseId: TARGET_COURSE,
        courseVersionId: TARGET_VERSION,
        cohortId: 'not-a-real-cohort',
      }),
    ).rejects.toThrowError(BadRequestError);

    expect(settingsRepo.updateFollowUpInvite).not.toHaveBeenCalled();
  });

  it('persists the config when a valid cohort is selected', async () => {
    const { svc, settingsRepo } = makeService({ targetCohorts: ['cohortA', 'cohortB'] });

    const result = await svc.updateFollowUpInvite(SOURCE_COURSE, SOURCE_VERSION, {
      enabled: true,
      courseId: TARGET_COURSE,
      courseVersionId: TARGET_VERSION,
      cohortId: 'cohortB',
    });

    expect(result).toBe(true);
    expect(settingsRepo.updateFollowUpInvite.mock.calls[0][2]).toMatchObject({
      enabled: true,
      cohortId: 'cohortB',
    });
  });

  it('requires a target course and version when enabling', async () => {
    const { svc, settingsRepo } = makeService();

    await expect(
      svc.updateFollowUpInvite(SOURCE_COURSE, SOURCE_VERSION, {
        enabled: true,
        // no courseId / courseVersionId
      }),
    ).rejects.toThrowError(BadRequestError);

    expect(settingsRepo.updateFollowUpInvite).not.toHaveBeenCalled();
  });

  it('throws when the target course version does not exist', async () => {
    const { svc } = makeService({ targetVersionExists: false });

    await expect(
      svc.updateFollowUpInvite(SOURCE_COURSE, SOURCE_VERSION, {
        enabled: true,
        courseId: TARGET_COURSE,
        courseVersionId: TARGET_VERSION,
      }),
    ).rejects.toThrowError(NotFoundError);
  });

  it('refuses an archived target course version', async () => {
    const { svc } = makeService({ targetVersionStatus: 'archived' });

    await expect(
      svc.updateFollowUpInvite(SOURCE_COURSE, SOURCE_VERSION, {
        enabled: true,
        courseId: TARGET_COURSE,
        courseVersionId: TARGET_VERSION,
      }),
    ).rejects.toThrowError(ForbiddenError);
  });

  it('disables without validating a target (no cohort needed)', async () => {
    const { svc, settingsRepo, courseRepo } = makeService();

    const result = await svc.updateFollowUpInvite(SOURCE_COURSE, SOURCE_VERSION, {
      enabled: false,
    });

    expect(result).toBe(true);
    // Target validation is skipped entirely when disabling.
    expect(courseRepo.read).not.toHaveBeenCalled();
    expect(settingsRepo.updateFollowUpInvite.mock.calls[0][2]).toMatchObject({
      enabled: false,
    });
  });

  it('blocks updates when the source course version is archived', async () => {
    const { svc } = makeService({ sourceVersionStatus: 'archived' });

    await expect(
      svc.updateFollowUpInvite(SOURCE_COURSE, SOURCE_VERSION, {
        enabled: true,
        courseId: TARGET_COURSE,
        courseVersionId: TARGET_VERSION,
      }),
    ).rejects.toThrowError(ForbiddenError);
  });
});

describe('CourseSettingService.getCourseVersionsWithFollowUpInviteEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeListService(
    rows: Array<{ courseId: string; courseVersionId: string }>,
  ) {
    const settingsRepo = {
      getCourseVersionsWithFollowUpInviteEnabled: vi
        .fn()
        .mockResolvedValue(rows),
    };
    const svc = new CourseSettingService(
      settingsRepo as any,
      {} as any,
      {} as any,
    );
    return { svc, settingsRepo };
  }

  it('returns the enabled source course versions from the repo', async () => {
    const rows = [
      { courseId: 'c1', courseVersionId: 'v1' },
      { courseId: 'c2', courseVersionId: 'v2' },
    ];
    const { svc, settingsRepo } = makeListService(rows);

    const result = await svc.getCourseVersionsWithFollowUpInviteEnabled();

    expect(result).toEqual(rows);
    expect(
      settingsRepo.getCourseVersionsWithFollowUpInviteEnabled,
    ).toHaveBeenCalledOnce();
  });

  it('returns an empty list when no course version has it enabled', async () => {
    const { svc } = makeListService([]);

    const result = await svc.getCourseVersionsWithFollowUpInviteEnabled();

    expect(result).toEqual([]);
  });
});
