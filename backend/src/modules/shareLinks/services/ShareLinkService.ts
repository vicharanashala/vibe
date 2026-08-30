import 'reflect-metadata';
import crypto from 'crypto';
import {injectable, inject} from 'inversify';
import {ObjectId} from 'mongodb';
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from 'routing-controllers';
import {appConfig} from '#root/config/app.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {COURSES_TYPES} from '#root/modules/courses/types.js';
import {AUTH_TYPES} from '#root/modules/auth/types.js';
import type {IAuthService} from '#root/modules/auth/interfaces/IAuthService.js';
import type {ICourseRepository} from '#shared/database/interfaces/ICourseRepository.js';
import type {IItemRepository} from '#shared/database/interfaces/IItemRepository.js';
import {UserRepository} from '#shared/database/providers/mongo/repositories/UserRepository.js';
import {ShareLinkRepository} from '#shared/database/providers/mongo/repositories/ShareLinkRepository.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {BaseService, MongoDatabase} from '#root/shared/index.js';
import {
  IShareLink,
  ShareLinkEmailStatus,
  ShareLinkStatus,
  ShareLinkViewingMode,
} from '#shared/interfaces/models.js';
import {EnrollmentRepository} from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import {User} from '#auth/classes/transformers/User.js';
import {ShareLink} from '../classes/transformers/ShareLink.js';
import {ShareLinkMailService} from './ShareLinkMailService.js';
import {SHARE_LINKS_TYPES} from '../types.js';

export interface ShareLinkRecipientInput {
  name: string;
  email: string;
}

export interface CreatedShareLink {
  shareLinkId: string;
  recipientName: string;
  recipientEmail: string;
  url: string;
  status: ShareLinkStatus;
  viewingMode: ShareLinkViewingMode;
  emailStatus: ShareLinkEmailStatus;
  expiresAt: Date;
}

export interface ShareLinkAnalytics {
  shareLinkId: string;
  recipientName: string;
  recipientEmail: string;
  status: ShareLinkStatus;
  openCount: number;
  totalWatchTimeSeconds: number;
  completedItems: number;
  totalItems: number;
  watchedPercent: number;
  rewinds: number;
  fastForwards: number;
  lastSeenAt?: Date;
}

const DEFAULT_EXPIRY_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Share links: per-recipient, identity-bearing links into a course version the
 * instructor already owns.
 *
 * The recipient never signs in. Their identity travels in the token, and the
 * first open binds it to a guest user so watch time, progress and activity all
 * land in the ordinary collections under a real userId — which is what lets the
 * sharer see who watched and how much without a parallel analytics pipeline.
 *
 * @category ShareLinks/Services
 */
@injectable()
export class ShareLinkService extends BaseService {
  constructor(
    @inject(SHARE_LINKS_TYPES.ShareLinkRepo)
    private readonly shareLinkRepo: ShareLinkRepository,
    @inject(GLOBAL_TYPES.UserRepo)
    private readonly userRepo: UserRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
    @inject(AUTH_TYPES.AuthService)
    private readonly authService: IAuthService,
    @inject(SHARE_LINKS_TYPES.ShareLinkMailService)
    private readonly mailService: ShareLinkMailService,
    @inject(GLOBAL_TYPES.Database)
    database: MongoDatabase,
  ) {
    super(database);
  }

  async createShareLinks(
    courseId: string,
    courseVersionId: string,
    recipients: ShareLinkRecipientInput[],
    createdBy: string,
    cohortId?: string,
    itemId?: string,
    expiresInDays: number = DEFAULT_EXPIRY_DAYS,
    viewingMode: ShareLinkViewingMode = ShareLinkViewingMode.PLAIN,
    sendEmail = false,
    emailSubjectTitle = 'a video on ViBe',
  ): Promise<CreatedShareLink[]> {
    const versionStatus =
      await this.courseRepo.getCourseVersionStatus(courseVersionId);
    if (versionStatus === 'archived') {
      throw new ForbiddenError(
        'Cannot share an archived course version.',
      );
    }

    const courseVersion = await this.courseRepo.readVersion(courseVersionId);
    if (!courseVersion) {
      throw new NotFoundError('Course version not found');
    }
    if (courseVersion.courseId.toString() !== courseId) {
      throw new BadRequestError(
        'Course version does not belong to the given course',
      );
    }

    // A share link drops its holder into a cohort, so a version that has
    // cohorts must be shared into a named one — the same rule an invite obeys.
    if (courseVersion.cohorts?.length > 0 && !cohortId) {
      throw new BadRequestError(
        'This course version has cohorts. Choose the cohort to share into.',
      );
    }

    const expiresAt = new Date(Date.now() + expiresInDays * DAY_IN_MS);

    const links = await this._withTransaction(async session => {
      const created: ShareLink[] = [];

      for (const recipient of recipients) {
        const recipientEmail = recipient.email.toLowerCase().trim();

        // Re-sharing with the same person reuses their live link rather than
        // splitting their watching across two identities.
        const existing = await this.shareLinkRepo.findActiveByRecipient(
          recipientEmail,
          courseId,
          courseVersionId,
          cohortId,
          session,
        );
        if (existing) {
          created.push(existing as ShareLink);
          continue;
        }

        created.push(
          new ShareLink({
            token: this.generateToken(),
            courseId: new ObjectId(courseId),
            courseVersionId: new ObjectId(courseVersionId),
            cohortId: cohortId ? new ObjectId(cohortId) : undefined,
            itemId: itemId ? new ObjectId(itemId) : undefined,
            recipientName: recipient.name.trim(),
            recipientEmail,
            createdBy: new ObjectId(createdBy),
            expiresAt,
            viewingMode,
          }),
        );
      }

      const fresh = created.filter(link => !link._id);
      const insertedIds = await this.shareLinkRepo.createMany(fresh, session);
      fresh.forEach((link, index) => {
        link._id = insertedIds[index];
      });

      return created;
    });

    if (sendEmail) {
      await this.emailLinks(links, emailSubjectTitle);
    }

    return links.map(link => this.toCreatedShareLink(link));
  }

  /**
   * Mails each recipient their own link.
   *
   * Failures are recorded rather than thrown: the links already exist and the
   * sharer can still copy them, so losing the whole share because one address
   * bounced would be the worse outcome. The dashboard shows who was not
   * reached.
   */
  private async emailLinks(
    links: ShareLink[],
    subjectTitle: string,
  ): Promise<void> {
    await Promise.all(
      links.map(async link => {
        const sent = await this.mailService.sendShareLink(
          link,
          this.urlFor(link),
          subjectTitle,
        );
        link.emailStatus = sent
          ? ShareLinkEmailStatus.SENT
          : ShareLinkEmailStatus.FAILED;
        link.emailedAt = sent ? new Date() : undefined;

        await this.shareLinkRepo.update(link._id.toString(), {
          emailStatus: link.emailStatus,
          ...(link.emailedAt ? {emailedAt: link.emailedAt} : {}),
        });
      }),
    );
  }

  async listShareLinks(
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
  ): Promise<CreatedShareLink[]> {
    const links = await this.shareLinkRepo.findByCourseVersion(
      courseId,
      courseVersionId,
      cohortId,
    );
    return links.map(link => this.toCreatedShareLink(link));
  }

  /**
   * Per-recipient watching for every link issued on this course version.
   */
  async getAnalytics(
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
  ): Promise<ShareLinkAnalytics[]> {
    const links = await this.shareLinkRepo.findByCourseVersion(
      courseId,
      courseVersionId,
      cohortId,
    );

    const guestUserIds = links
      .filter(link => link.guestUserId)
      .map(link => new ObjectId(link.guestUserId.toString()));

    const [activity, totalItems] = await Promise.all([
      this.shareLinkRepo.getViewerActivity(
        guestUserIds,
        courseId,
        courseVersionId,
      ),
      this.itemRepo.getTotalItemsCount(courseId, courseVersionId),
    ]);

    return links.map(link => {
      const viewer = link.guestUserId
        ? activity.get(link.guestUserId.toString())
        : undefined;
      const completedItems = viewer?.completedItems ?? 0;

      return {
        shareLinkId: link._id.toString(),
        recipientName: link.recipientName,
        recipientEmail: link.recipientEmail,
        status: this.effectiveStatus(link),
        openCount: link.openCount ?? 0,
        totalWatchTimeSeconds: viewer?.totalWatchTimeSeconds ?? 0,
        completedItems,
        totalItems,
        watchedPercent:
          totalItems > 0
            ? Math.round((completedItems / totalItems) * 100)
            : 0,
        rewinds: viewer?.rewinds ?? 0,
        fastForwards: viewer?.fastForwards ?? 0,
        lastSeenAt: viewer?.lastSeenAt,
      };
    });
  }

  /**
   * Opens a share link: validates the token, binds it to a guest identity on
   * first use, and hands back a custom token the client signs in with.
   */
  async openShareLink(token: string): Promise<{
    customToken: string;
    courseId: string;
    courseVersionId: string;
    cohortId?: string;
    itemId?: string;
    recipientName: string;
    viewingMode: ShareLinkViewingMode;
  }> {
    const link = await this.shareLinkRepo.findByToken(token);
    if (!link) {
      throw new NotFoundError('This share link is not valid.');
    }
    if (link.status === ShareLinkStatus.REVOKED) {
      throw new ForbiddenError('This share link has been revoked.');
    }
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenError('This share link has expired.');
    }

    const versionStatus = await this.courseRepo.getCourseVersionStatus(
      link.courseVersionId.toString(),
    );
    if (versionStatus === 'archived') {
      throw new ForbiddenError(
        'The shared course version is no longer available.',
      );
    }

    const guestUserId = await this.resolveGuestUser(link);
    await this.shareLinkRepo.recordOpen(
      link._id.toString(),
      new ObjectId(guestUserId),
    );

    const guest = await this.userRepo.findById(guestUserId);
    if (!guest) {
      throw new InternalServerError('Failed to resolve the share link viewer.');
    }

    return {
      customToken: await this.authService.createCustomToken(guest.firebaseUID),
      courseId: link.courseId.toString(),
      courseVersionId: link.courseVersionId.toString(),
      cohortId: link.cohortId?.toString(),
      itemId: link.itemId?.toString(),
      recipientName: link.recipientName,
      // A link minted before viewing modes existed reads as PLAIN, which is
      // the safe default: it never starts proctoring for a guest.
      viewingMode: link.viewingMode ?? ShareLinkViewingMode.PLAIN,
    };
  }

  async revokeShareLink(shareLinkId: string): Promise<{message: string}> {
    const link = await this.shareLinkRepo.findById(shareLinkId);
    if (!link) {
      throw new NotFoundError('Share link not found');
    }
    if (link.status === ShareLinkStatus.REVOKED) {
      return {message: 'This share link is already revoked.'};
    }

    // Revoking closes the door, it does not erase what was already watched —
    // the sharer keeps the analytics they have collected so far.
    await this.shareLinkRepo.update(shareLinkId, {
      status: ShareLinkStatus.REVOKED,
      revokedAt: new Date(),
    });
    return {message: 'Share link revoked.'};
  }

  async findById(shareLinkId: string): Promise<IShareLink> {
    const link = await this.shareLinkRepo.findById(shareLinkId);
    if (!link) {
      throw new NotFoundError('Share link not found');
    }
    return link;
  }

  /**
   * Finds or creates the guest user this token is bound to, and makes sure it
   * is enrolled in the shared cohort.
   *
   * The guest address is derived from the link token, never from the
   * recipient's own email: a real ViBe account with the same address must stay
   * untouched, and a forwarded link must not let anyone else's watching land on
   * this recipient's row.
   */
  private async resolveGuestUser(link: IShareLink): Promise<string> {
    if (link.guestUserId) {
      return link.guestUserId.toString();
    }

    const guestEmail = this.guestEmailFor(link.token);
    const existing = await this.userRepo.findByEmail(guestEmail);
    const displayName = link.recipientName || 'Guest viewer';

    let guestUserId: string;
    if (existing) {
      guestUserId = existing._id.toString();
    } else {
      const firebaseUID = await this.authService.createGuestFirebaseUser(
        guestEmail,
        displayName,
      );
      const [firstName, ...rest] = displayName.split(' ');
      guestUserId = await this.userRepo.create(
        Object.assign(
          new User({
            firebaseUID,
            email: guestEmail,
            firstName,
            lastName: rest.join(' '),
            roles: 'user',
          }),
          // Marks them as never having signed up, which is what keeps them out
          // of the course's own analytics.
          {isShareLinkGuest: true},
        ),
      );
      if (!guestUserId) {
        throw new InternalServerError('Failed to create the share link viewer.');
      }
    }

    const enrollment = await this.enrollmentService.enrollUser(
      guestUserId,
      link.courseId.toString(),
      link.courseVersionId.toString(),
      'STUDENT',
      true,
      link.cohortId?.toString(),
    );
    if (!enrollment) {
      throw new InternalServerError(
        'Failed to give the share link viewer access to the course.',
      );
    }

    // The enrollment exists only to grant access. Flagging it keeps the roster
    // and the version's enrollment statistics about enrolled learners, so
    // sharing a course with fifty people does not move its completion rate.
    await this.enrollmentRepo.markShareLinkGuestEnrollment(
      guestUserId,
      link.courseId.toString(),
      link.courseVersionId.toString(),
    );

    return guestUserId;
  }

  private guestEmailFor(token: string): string {
    return `share-${token.slice(0, 24)}@guests.vibe.local`;
  }

  private urlFor(link: IShareLink): string {
    return `${appConfig.origins[0]}/share/${link.token}`;
  }

  private generateToken(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  private effectiveStatus(link: IShareLink): ShareLinkStatus {
    if (link.status === ShareLinkStatus.REVOKED) {
      return ShareLinkStatus.REVOKED;
    }
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      return ShareLinkStatus.EXPIRED;
    }
    return link.status;
  }

  private toCreatedShareLink(link: IShareLink): CreatedShareLink {
    return {
      shareLinkId: link._id.toString(),
      recipientName: link.recipientName,
      recipientEmail: link.recipientEmail,
      url: this.urlFor(link),
      status: this.effectiveStatus(link),
      viewingMode: link.viewingMode ?? ShareLinkViewingMode.PLAIN,
      emailStatus: link.emailStatus ?? ShareLinkEmailStatus.NOT_SENT,
      expiresAt: link.expiresAt,
    };
  }
}
