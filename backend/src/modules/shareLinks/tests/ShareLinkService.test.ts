// models.ts pulls in class-transformer decorators, which need the metadata
// polyfill loaded first — same first line as every other suite here.
import 'reflect-metadata';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ObjectId} from 'mongodb';
import {
  ShareLinkStatus,
  ShareLinkViewingMode,
} from '#shared/interfaces/models.js';
import {ShareLinkService} from '../services/ShareLinkService.js';

const COURSE_ID = new ObjectId().toString();
const VERSION_ID = new ObjectId().toString();
const COHORT_ID = new ObjectId().toString();
const SHARER_ID = new ObjectId().toString();

function buildService(overrides: Record<string, any> = {}) {
  const shareLinkRepo = {
    createMany: vi.fn(async (links: any[]) =>
      links.map(() => new ObjectId().toString()),
    ),
    findActiveByRecipient: vi.fn(async () => null),
    findByToken: vi.fn(async () => null),
    findById: vi.fn(async () => null),
    findByCourseVersion: vi.fn(async () => []),
    update: vi.fn(async () => undefined),
    recordOpen: vi.fn(async () => undefined),
    getViewerActivity: vi.fn(async () => new Map()),
    ...overrides.shareLinkRepo,
  };

  const userRepo = {
    findByEmail: vi.fn(async () => null),
    findById: vi.fn(async () => ({
      _id: new ObjectId(),
      firebaseUID: 'guest-uid',
    })),
    create: vi.fn(async () => new ObjectId().toString()),
    ...overrides.userRepo,
  };

  const courseRepo = {
    getCourseVersionStatus: vi.fn(async () => 'active'),
    readVersion: vi.fn(async () => ({
      courseId: COURSE_ID,
      cohorts: [],
    })),
    ...overrides.courseRepo,
  };

  const itemRepo = {
    getTotalItemsCount: vi.fn(async () => 10),
    ...overrides.itemRepo,
  };

  const enrollmentService = {
    enrollUser: vi.fn(async () => ({status: 'ENROLLED', role: 'STUDENT'})),
    ...overrides.enrollmentService,
  };

  const enrollmentRepo = {
    markShareLinkGuestEnrollment: vi.fn(async () => undefined),
    ...overrides.enrollmentRepo,
  };

  const authService = {
    createGuestFirebaseUser: vi.fn(async () => 'guest-uid'),
    createCustomToken: vi.fn(async () => 'custom-token'),
    ...overrides.authService,
  };

  const mailService = {
    sendShareLink: vi.fn(async () => true),
    ...overrides.mailService,
  };

  const service = new ShareLinkService(
    shareLinkRepo as any,
    userRepo as any,
    courseRepo as any,
    itemRepo as any,
    enrollmentService as any,
    enrollmentRepo as any,
    authService as any,
    mailService as any,
    {} as any,
  );

  // The service extends BaseService for transactions; unit tests run the body
  // directly rather than standing up a replica set.
  (service as any)._withTransaction = async (fn: any) => fn(undefined);

  return {
    service,
    shareLinkRepo,
    userRepo,
    courseRepo,
    itemRepo,
    enrollmentService,
    enrollmentRepo,
    authService,
    mailService,
  };
}

describe('ShareLinkService.createShareLinks', () => {
  it('mints one distinct token per recipient', async () => {
    const {service, shareLinkRepo} = buildService();

    const links = await service.createShareLinks(
      COURSE_ID,
      VERSION_ID,
      [
        {name: 'Ananya Rao', email: 'Ananya@Example.com'},
        {name: 'Bhavna Iyer', email: 'bhavna@example.com'},
      ],
      SHARER_ID,
    );

    expect(links).toHaveLength(2);
    const created = shareLinkRepo.createMany.mock.calls[0][0];
    expect(created[0].token).not.toBe(created[1].token);
    // Identity travels in the link, so the recipient is stored with it.
    expect(created[0].recipientName).toBe('Ananya Rao');
    expect(created[0].recipientEmail).toBe('ananya@example.com');
  });

  it('reuses a live link for a recipient who was already shared with', async () => {
    const existing = {
      _id: new ObjectId(),
      token: 'existing-token',
      recipientName: 'Ananya Rao',
      recipientEmail: 'ananya@example.com',
      status: ShareLinkStatus.OPENED,
      expiresAt: new Date(Date.now() + 86_400_000),
    };
    const {service, shareLinkRepo} = buildService({
      shareLinkRepo: {findActiveByRecipient: vi.fn(async () => existing)},
    });

    const links = await service.createShareLinks(
      COURSE_ID,
      VERSION_ID,
      [{name: 'Ananya Rao', email: 'ananya@example.com'}],
      SHARER_ID,
    );

    // Re-sharing must not split one person's watching across two identities.
    expect(shareLinkRepo.createMany).toHaveBeenCalledWith([], undefined);
    expect(links[0].url).toContain('existing-token');
  });

  it('refuses to share a version that has cohorts without naming one', async () => {
    const {service} = buildService({
      courseRepo: {
        readVersion: vi.fn(async () => ({
          courseId: COURSE_ID,
          cohorts: [{_id: COHORT_ID}],
        })),
      },
    });

    await expect(
      service.createShareLinks(
        COURSE_ID,
        VERSION_ID,
        [{name: 'Ananya Rao', email: 'ananya@example.com'}],
        SHARER_ID,
      ),
    ).rejects.toThrow(/cohort/i);
  });

  it('defaults to plain viewing rather than proctoring a guest', async () => {
    const {service, shareLinkRepo} = buildService();

    await service.createShareLinks(
      COURSE_ID,
      VERSION_ID,
      [{name: 'Ananya Rao', email: 'ananya@example.com'}],
      SHARER_ID,
    );

    // Someone who was simply sent a video should not meet a camera prompt.
    const [created] = shareLinkRepo.createMany.mock.calls[0][0];
    expect(created.viewingMode).toBe(ShareLinkViewingMode.PLAIN);
  });

  it('honours a proctored link when the sharer asks for one', async () => {
    const {service, shareLinkRepo} = buildService();

    await service.createShareLinks(
      COURSE_ID,
      VERSION_ID,
      [{name: 'Ananya Rao', email: 'ananya@example.com'}],
      SHARER_ID,
      undefined,
      undefined,
      30,
      ShareLinkViewingMode.PROCTORED,
    );

    const [created] = shareLinkRepo.createMany.mock.calls[0][0];
    expect(created.viewingMode).toBe(ShareLinkViewingMode.PROCTORED);
  });

  it('refuses to share an archived version', async () => {
    const {service} = buildService({
      courseRepo: {getCourseVersionStatus: vi.fn(async () => 'archived')},
    });

    await expect(
      service.createShareLinks(
        COURSE_ID,
        VERSION_ID,
        [{name: 'Ananya Rao', email: 'ananya@example.com'}],
        SHARER_ID,
      ),
    ).rejects.toThrow(/archived/i);
  });
});

describe('ShareLinkService.openShareLink', () => {
  const activeLink = () => ({
    _id: new ObjectId(),
    token: 'a'.repeat(48),
    courseId: new ObjectId(COURSE_ID),
    courseVersionId: new ObjectId(VERSION_ID),
    cohortId: new ObjectId(COHORT_ID),
    recipientName: 'Ananya Rao',
    recipientEmail: 'ananya@example.com',
    status: ShareLinkStatus.ACTIVE,
    openCount: 0,
    expiresAt: new Date(Date.now() + 86_400_000),
  });

  it('creates and enrolls a guest on first open, and returns a session', async () => {
    const link = activeLink();
    const {service, authService, enrollmentService, shareLinkRepo} =
      buildService({
        shareLinkRepo: {findByToken: vi.fn(async () => link)},
      });

    const result = await service.openShareLink(link.token);

    expect(authService.createGuestFirebaseUser).toHaveBeenCalled();
    expect(enrollmentService.enrollUser).toHaveBeenCalledWith(
      expect.any(String),
      COURSE_ID,
      VERSION_ID,
      'STUDENT',
      true,
      COHORT_ID,
    );
    expect(shareLinkRepo.recordOpen).toHaveBeenCalled();
    expect(result.customToken).toBe('custom-token');
    expect(result.recipientName).toBe('Ananya Rao');
  });

  it('flags the guest so they stay out of the course own analytics', async () => {
    const link = activeLink();
    const {service, userRepo, enrollmentRepo} = buildService({
      shareLinkRepo: {findByToken: vi.fn(async () => link)},
    });

    await service.openShareLink(link.token);

    const [createdUser] = userRepo.create.mock.calls[0];
    expect(createdUser.isShareLinkGuest).toBe(true);
    // The enrollment is flagged too — rosters and enrollment statistics read
    // from there, not from the user.
    expect(enrollmentRepo.markShareLinkGuestEnrollment).toHaveBeenCalledWith(
      expect.any(String),
      COURSE_ID,
      VERSION_ID,
    );
  });

  it('tells the client which viewing mode the link carries', async () => {
    const link = {...activeLink(), viewingMode: ShareLinkViewingMode.PROCTORED};
    const {service} = buildService({
      shareLinkRepo: {findByToken: vi.fn(async () => link)},
    });

    const result = await service.openShareLink(link.token);

    expect(result.viewingMode).toBe(ShareLinkViewingMode.PROCTORED);
  });

  it('reads a link minted before viewing modes existed as plain', async () => {
    const {viewingMode, ...legacyLink} = {
      ...activeLink(),
      viewingMode: undefined,
    };
    const {service} = buildService({
      shareLinkRepo: {findByToken: vi.fn(async () => legacyLink)},
    });

    const result = await service.openShareLink(legacyLink.token);

    // Defaulting the other way would start proctoring for a guest.
    expect(result.viewingMode).toBe(ShareLinkViewingMode.PLAIN);
  });

  it('does not ask for the recipient email when creating the guest identity', async () => {
    const link = activeLink();
    const {service, authService} = buildService({
      shareLinkRepo: {findByToken: vi.fn(async () => link)},
    });

    await service.openShareLink(link.token);

    // Binding the guest to the recipient's real address would collide with any
    // genuine ViBe account they already have.
    const [guestEmail] = authService.createGuestFirebaseUser.mock.calls[0];
    expect(guestEmail).not.toContain('ananya@example.com');
    expect(guestEmail).toContain(link.token.slice(0, 24));
  });

  it('reuses the bound guest on later opens instead of making another', async () => {
    const guestUserId = new ObjectId();
    const link = {...activeLink(), guestUserId, status: ShareLinkStatus.OPENED};
    const {service, authService, enrollmentService} = buildService({
      shareLinkRepo: {findByToken: vi.fn(async () => link)},
    });

    await service.openShareLink(link.token);

    expect(authService.createGuestFirebaseUser).not.toHaveBeenCalled();
    expect(enrollmentService.enrollUser).not.toHaveBeenCalled();
  });

  it('rejects a revoked link', async () => {
    const link = {...activeLink(), status: ShareLinkStatus.REVOKED};
    const {service} = buildService({
      shareLinkRepo: {findByToken: vi.fn(async () => link)},
    });

    await expect(service.openShareLink(link.token)).rejects.toThrow(/revoked/i);
  });

  it('rejects an expired link', async () => {
    const link = {...activeLink(), expiresAt: new Date(Date.now() - 1000)};
    const {service} = buildService({
      shareLinkRepo: {findByToken: vi.fn(async () => link)},
    });

    await expect(service.openShareLink(link.token)).rejects.toThrow(/expired/i);
  });

  it('rejects an unknown token', async () => {
    const {service} = buildService();

    await expect(service.openShareLink('b'.repeat(48))).rejects.toThrow(
      /not valid/i,
    );
  });
});

describe('ShareLinkService.getAnalytics', () => {
  it('reports each recipient by name with what they watched', async () => {
    const guestUserId = new ObjectId();
    const link = {
      _id: new ObjectId(),
      token: 'c'.repeat(48),
      courseId: new ObjectId(COURSE_ID),
      courseVersionId: new ObjectId(VERSION_ID),
      recipientName: 'Ananya Rao',
      recipientEmail: 'ananya@example.com',
      guestUserId,
      status: ShareLinkStatus.OPENED,
      openCount: 3,
      expiresAt: new Date(Date.now() + 86_400_000),
    };
    const {service} = buildService({
      shareLinkRepo: {
        findByCourseVersion: vi.fn(async () => [link]),
        getViewerActivity: vi.fn(
          async () =>
            new Map([
              [
                guestUserId.toString(),
                {
                  totalWatchTimeSeconds: 620,
                  completedItems: 4,
                  rewinds: 7,
                  fastForwards: 2,
                  lastSeenAt: new Date('2026-08-14T10:00:00Z'),
                },
              ],
            ]),
        ),
      },
    });

    const [row] = await service.getAnalytics(COURSE_ID, VERSION_ID);

    expect(row.recipientName).toBe('Ananya Rao');
    expect(row.totalWatchTimeSeconds).toBe(620);
    expect(row.completedItems).toBe(4);
    expect(row.totalItems).toBe(10);
    expect(row.watchedPercent).toBe(40);
    expect(row.rewinds).toBe(7);
    expect(row.openCount).toBe(3);
  });

  it('shows a never-opened link as zero rather than omitting it', async () => {
    const link = {
      _id: new ObjectId(),
      token: 'd'.repeat(48),
      courseId: new ObjectId(COURSE_ID),
      courseVersionId: new ObjectId(VERSION_ID),
      recipientName: 'Bhavna Iyer',
      recipientEmail: 'bhavna@example.com',
      status: ShareLinkStatus.ACTIVE,
      openCount: 0,
      expiresAt: new Date(Date.now() + 86_400_000),
    };
    const {service} = buildService({
      shareLinkRepo: {findByCourseVersion: vi.fn(async () => [link])},
    });

    const [row] = await service.getAnalytics(COURSE_ID, VERSION_ID);

    // "Sent it and heard nothing" is itself the answer the sharer wants.
    expect(row.watchedPercent).toBe(0);
    expect(row.totalWatchTimeSeconds).toBe(0);
    expect(row.status).toBe(ShareLinkStatus.ACTIVE);
  });

  it('reports an elapsed link as expired without rewriting the record', async () => {
    const link = {
      _id: new ObjectId(),
      token: 'e'.repeat(48),
      courseId: new ObjectId(COURSE_ID),
      courseVersionId: new ObjectId(VERSION_ID),
      recipientName: 'Chetan Nair',
      recipientEmail: 'chetan@example.com',
      status: ShareLinkStatus.ACTIVE,
      openCount: 0,
      expiresAt: new Date(Date.now() - 1000),
    };
    const {service, shareLinkRepo} = buildService({
      shareLinkRepo: {findByCourseVersion: vi.fn(async () => [link])},
    });

    const [row] = await service.getAnalytics(COURSE_ID, VERSION_ID);

    expect(row.status).toBe(ShareLinkStatus.EXPIRED);
    expect(shareLinkRepo.update).not.toHaveBeenCalled();
  });
});

describe('ShareLinkService.revokeShareLink', () => {
  it('revokes without discarding the analytics already collected', async () => {
    const link = {
      _id: new ObjectId(),
      status: ShareLinkStatus.OPENED,
      courseId: new ObjectId(COURSE_ID),
      courseVersionId: new ObjectId(VERSION_ID),
    };
    const {service, shareLinkRepo} = buildService({
      shareLinkRepo: {findById: vi.fn(async () => link)},
    });

    await service.revokeShareLink(link._id.toString());

    const [, changes] = shareLinkRepo.update.mock.calls[0];
    expect(changes.status).toBe(ShareLinkStatus.REVOKED);
    expect(changes.revokedAt).toBeInstanceOf(Date);
    expect(changes).not.toHaveProperty('guestUserId');
  });

  it('is idempotent', async () => {
    const link = {
      _id: new ObjectId(),
      status: ShareLinkStatus.REVOKED,
      courseId: new ObjectId(COURSE_ID),
      courseVersionId: new ObjectId(VERSION_ID),
    };
    const {service, shareLinkRepo} = buildService({
      shareLinkRepo: {findById: vi.fn(async () => link)},
    });

    const result = await service.revokeShareLink(link._id.toString());

    expect(result.message).toMatch(/already revoked/i);
    expect(shareLinkRepo.update).not.toHaveBeenCalled();
  });
});

describe('ShareLinkService email delivery', () => {
  it('does not mail anyone unless the sharer asked for it', async () => {
    const {service, mailService} = buildService();

    await service.createShareLinks(
      COURSE_ID,
      VERSION_ID,
      [{name: 'Ananya Rao', email: 'ananya@example.com'}],
      SHARER_ID,
    );

    expect(mailService.sendShareLink).not.toHaveBeenCalled();
  });

  it('mails each recipient their own link and records the send', async () => {
    const {service, mailService, shareLinkRepo} = buildService();

    const links = await service.createShareLinks(
      COURSE_ID,
      VERSION_ID,
      [
        {name: 'Ananya Rao', email: 'ananya@example.com'},
        {name: 'Bhavna Iyer', email: 'bhavna@example.com'},
      ],
      SHARER_ID,
      undefined,
      undefined,
      30,
      ShareLinkViewingMode.PLAIN,
      true,
      'Intro to graphs',
    );

    expect(mailService.sendShareLink).toHaveBeenCalledTimes(2);
    // Each person is mailed their own URL, never a shared one.
    const [firstCall, secondCall] = mailService.sendShareLink.mock.calls;
    expect(firstCall[1]).not.toBe(secondCall[1]);
    expect(firstCall[2]).toBe('Intro to graphs');
    expect(links.every(l => l.emailStatus === 'SENT')).toBe(true);
    expect(shareLinkRepo.update).toHaveBeenCalledTimes(2);
  });

  it('keeps the links when the mail fails, and says who was not reached', async () => {
    const {service, shareLinkRepo} = buildService({
      mailService: {sendShareLink: vi.fn(async () => false)},
    });

    const links = await service.createShareLinks(
      COURSE_ID,
      VERSION_ID,
      [{name: 'Ananya Rao', email: 'ananya@example.com'}],
      SHARER_ID,
      undefined,
      undefined,
      30,
      ShareLinkViewingMode.PLAIN,
      true,
    );

    // The link still exists and is copyable — a bounced address must not sink
    // the whole share.
    expect(links).toHaveLength(1);
    expect(links[0].url).toContain('/share/');
    expect(links[0].emailStatus).toBe('FAILED');
    const [, changes] = shareLinkRepo.update.mock.calls[0];
    expect(changes.emailStatus).toBe('FAILED');
    expect(changes.emailedAt).toBeUndefined();
  });
});
