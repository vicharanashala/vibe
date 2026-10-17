// models.ts pulls in class-transformer decorators, which need the metadata
// polyfill loaded first — same first line as every other suite here.
import 'reflect-metadata';
import {describe, expect, it, vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {ShareLinkViewingMode} from '#shared/interfaces/models.js';
import {QuickShareService} from '../services/QuickShareService.js';

const INSTRUCTOR_ID = new ObjectId().toString();
const COURSE_ID = new ObjectId();
const VERSION_ID = new ObjectId();
const COHORT_ID = new ObjectId();
const MODULE_ID = new ObjectId();
const SECTION_ID = new ObjectId();
const ITEM_ID = new ObjectId();

const URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const existingContainer = () => ({
  _id: COURSE_ID,
  versions: [VERSION_ID],
  isQuickShareContainer: true,
});

const containerVersion = () => ({
  _id: VERSION_ID,
  cohorts: [COHORT_ID],
  modules: [
    {
      moduleId: MODULE_ID,
      sections: [{sectionId: SECTION_ID}],
    },
  ],
});

function buildService(overrides: Record<string, any> = {}) {
  const shareLinkRepo = {
    findQuickShareContainerCourse: vi.fn(async () => existingContainer()),
    markCourseAsQuickShareContainer: vi.fn(async () => undefined),
    ...overrides.shareLinkRepo,
  };

  const shareLinkService = {
    createShareLinks: vi.fn(async () => [
      {
        shareLinkId: new ObjectId().toString(),
        recipientName: 'Ananya Rao',
        recipientEmail: 'ananya@example.com',
        url: 'https://vibe.test/share/abc',
        status: 'ACTIVE',
        viewingMode: ShareLinkViewingMode.PLAIN,
        expiresAt: new Date(),
      },
    ]),
    getAnalytics: vi.fn(async () => []),
    ...overrides.shareLinkService,
  };

  const youTubeEmbedService = {
    check: vi.fn(async () => ({
      embeddable: true,
      videoId: 'dQw4w9WgXcQ',
      title: 'A lecture',
    })),
    ...overrides.youTubeEmbedService,
  };

  const courseService = {
    createCourse: vi.fn(async () => ({
      _id: COURSE_ID,
      versions: [VERSION_ID],
    })),
    ...overrides.courseService,
  };

  const moduleService = {
    createModule: vi.fn(async () => containerVersion()),
    ...overrides.moduleService,
  };

  const sectionService = {
    createSection: vi.fn(async () => containerVersion()),
    ...overrides.sectionService,
  };

  const itemService = {
    createItem: vi.fn(async () => ({createdItem: {_id: ITEM_ID}})),
    ...overrides.itemService,
  };

  const courseRepo = {
    readVersion: vi.fn(async () => containerVersion()),
    ...overrides.courseRepo,
  };

  const enrollmentRepo = {
    markQuickShareContainerEnrollment: vi.fn(async () => undefined),
    ...overrides.enrollmentRepo,
  };

  const service = new QuickShareService(
    shareLinkRepo as any,
    shareLinkService as any,
    youTubeEmbedService as any,
    courseService as any,
    moduleService as any,
    sectionService as any,
    itemService as any,
    courseRepo as any,
    enrollmentRepo as any,
  );

  return {
    service,
    shareLinkRepo,
    shareLinkService,
    youTubeEmbedService,
    courseService,
    moduleService,
    sectionService,
    itemService,
    courseRepo,
    enrollmentRepo,
  };
}

const recipients = [{name: 'Ananya Rao', email: 'ananya@example.com'}];

describe('QuickShareService.shareVideo', () => {
  it('files the video into the instructor holder and mints links for it', async () => {
    const {service, itemService, shareLinkService} = buildService();

    const result = await service.shareVideo(INSTRUCTOR_ID, URL, recipients);

    const [versionId, moduleId, sectionId, body] =
      itemService.createItem.mock.calls[0];
    expect(versionId).toBe(VERSION_ID.toString());
    expect(moduleId).toBe(MODULE_ID.toString());
    expect(sectionId).toBe(SECTION_ID.toString());
    expect(body.videoDetails.URL).toBe(URL);
    // The link points at the item just created, in the holder's cohort.
    expect(shareLinkService.createShareLinks).toHaveBeenCalledWith(
      COURSE_ID.toString(),
      VERSION_ID.toString(),
      recipients,
      INSTRUCTOR_ID,
      COHORT_ID.toString(),
      ITEM_ID.toString(),
      undefined,
      ShareLinkViewingMode.PLAIN,
      false,
      'A lecture',
    );
    expect(result.videoTitle).toBe('A lecture');
    expect(result.links).toHaveLength(1);
  });

  it('refuses to share a video that cannot be embedded', async () => {
    const {service, itemService, shareLinkService} = buildService({
      youTubeEmbedService: {
        check: vi.fn(async () => ({
          embeddable: false,
          reason: 'EMBEDDING_DISABLED',
          message: "This video's owner has disabled embedding",
        })),
      },
    });

    await expect(
      service.shareVideo(INSTRUCTOR_ID, URL, recipients),
    ).rejects.toThrow(/embedding/i);

    // Nothing is created, so no links exist that would lead to a dead player.
    expect(itemService.createItem).not.toHaveBeenCalled();
    expect(shareLinkService.createShareLinks).not.toHaveBeenCalled();
  });

  it('reuses the instructor existing holder instead of making another', async () => {
    const {service, courseService} = buildService();

    await service.shareVideo(INSTRUCTOR_ID, URL, recipients);
    await service.shareVideo(INSTRUCTOR_ID, URL, recipients);

    expect(courseService.createCourse).not.toHaveBeenCalled();
  });

  it('creates the holder on first use and hides it both ways', async () => {
    const {service, courseService, shareLinkRepo, enrollmentRepo} =
      buildService({
        shareLinkRepo: {
          findQuickShareContainerCourse: vi.fn(async () => null),
          markCourseAsQuickShareContainer: vi.fn(async () => undefined),
        },
      });

    await service.shareVideo(INSTRUCTOR_ID, URL, recipients);

    expect(courseService.createCourse).toHaveBeenCalled();
    // Hidden as a course, and hidden from the courses they teach — both are
    // needed, since the two listings read from different collections.
    expect(shareLinkRepo.markCourseAsQuickShareContainer).toHaveBeenCalledWith(
      COURSE_ID.toString(),
    );
    expect(
      enrollmentRepo.markQuickShareContainerEnrollment,
    ).toHaveBeenCalledWith(
      INSTRUCTOR_ID,
      COURSE_ID.toString(),
      VERSION_ID.toString(),
    );
  });

  it('passes the chosen viewing mode through to the links', async () => {
    const {service, shareLinkService} = buildService();

    await service.shareVideo(
      INSTRUCTOR_ID,
      URL,
      recipients,
      ShareLinkViewingMode.PROCTORED,
    );

    const call = shareLinkService.createShareLinks.mock.calls[0];
    expect(call[7]).toBe(ShareLinkViewingMode.PROCTORED);
  });

  it('falls back to a generic title when YouTube gives none', async () => {
    const {service, itemService} = buildService({
      youTubeEmbedService: {
        check: vi.fn(async () => ({embeddable: true, videoId: 'x'})),
      },
    });

    await service.shareVideo(INSTRUCTOR_ID, URL, recipients);

    expect(itemService.createItem.mock.calls[0][3].name).toBe('Shared video');
  });
});

describe('QuickShareService email delivery', () => {
  it('passes the send-email choice and the video title through', async () => {
    const {service, shareLinkService} = buildService();

    await service.shareVideo(
      INSTRUCTOR_ID,
      URL,
      recipients,
      ShareLinkViewingMode.PLAIN,
      undefined,
      undefined,
      true,
    );

    const call = shareLinkService.createShareLinks.mock.calls[0];
    expect(call[8]).toBe(true);
    // Recipients recognise the video by its title, never by the hidden holder.
    expect(call[9]).toBe('A lecture');
  });
});

describe('QuickShareService.listQuickShares', () => {
  it('returns nothing for an instructor who has never quick-shared', async () => {
    const {service, shareLinkService} = buildService({
      shareLinkRepo: {findQuickShareContainerCourse: vi.fn(async () => null)},
    });

    expect(await service.listQuickShares(INSTRUCTOR_ID)).toEqual([]);
    expect(shareLinkService.getAnalytics).not.toHaveBeenCalled();
  });

  it('reads analytics from the holder version', async () => {
    const {service, shareLinkService} = buildService();

    await service.listQuickShares(INSTRUCTOR_ID);

    expect(shareLinkService.getAnalytics).toHaveBeenCalledWith(
      COURSE_ID.toString(),
      VERSION_ID.toString(),
    );
  });
});
