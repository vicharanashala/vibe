import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {BadRequestError, InternalServerError} from 'routing-controllers';
import {COURSES_TYPES} from '#root/modules/courses/types.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {GLOBAL_TYPES} from '#root/types.js';
import type {ICourseRepository} from '#shared/database/interfaces/ICourseRepository.js';
import {ShareLinkRepository} from '#shared/database/providers/mongo/repositories/ShareLinkRepository.js';
import {EnrollmentRepository} from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import {CourseService} from '#root/modules/courses/services/CourseService.js';
import {ModuleService} from '#root/modules/courses/services/ModuleService.js';
import {SectionService} from '#root/modules/courses/services/SectionService.js';
import {ItemService} from '#root/modules/courses/services/ItemService.js';
import {Course} from '#root/modules/courses/classes/transformers/Course.js';
import {ItemType} from '#shared/interfaces/models.js';
import {ShareLinkViewingMode} from '#shared/interfaces/models.js';
import {SHARE_LINKS_TYPES} from '../types.js';
import {YouTubeEmbedService} from './YouTubeEmbedService.js';
import {
  CreatedShareLink,
  ShareLinkAnalytics,
  ShareLinkRecipientInput,
  ShareLinkService,
} from './ShareLinkService.js';

const CONTAINER_COURSE_NAME = 'Quick shares';
const CONTAINER_COURSE_DESCRIPTION =
  'Videos shared outside any course. Created and maintained by ViBe — you do '
  + 'not need to edit it.';
const CONTAINER_COHORT_NAME = 'Recipients';
const CONTAINER_MODULE_NAME = 'Shared videos';
const CONTAINER_SECTION_NAME = 'Videos';
const CONTAINER_CHILD_DESCRIPTION = 'Videos shared outside any course.';

/**
 * Where a quick-shared video lives.
 *
 * The whole course version is hidden from the instructor: it exists only
 * because watch time, progress and access are all keyed to a course version.
 */
interface QuickShareContainer {
  courseId: string;
  versionId: string;
  cohortId?: string;
  moduleId: string;
  sectionId: string;
}

export interface QuickShareResult {
  itemId: string;
  videoTitle: string;
  links: CreatedShareLink[];
}

/**
 * Sharing a video that is not in a course.
 *
 * The instructor pastes a URL and names recipients — no course, version or
 * cohort in sight. Behind that, the video is filed into a hidden holder so the
 * ordinary watch-time and progress pipelines have somewhere to write. Keeping
 * the container rather than inventing a standalone video entity is what avoids
 * a second, parallel implementation of tracking.
 *
 * @category ShareLinks/Services
 */
@injectable()
export class QuickShareService {
  constructor(
    @inject(SHARE_LINKS_TYPES.ShareLinkRepo)
    private readonly shareLinkRepo: ShareLinkRepository,
    @inject(SHARE_LINKS_TYPES.ShareLinkService)
    private readonly shareLinkService: ShareLinkService,
    @inject(SHARE_LINKS_TYPES.YouTubeEmbedService)
    private readonly youTubeEmbedService: YouTubeEmbedService,
    @inject(COURSES_TYPES.CourseService)
    private readonly courseService: CourseService,
    @inject(COURSES_TYPES.ModuleService)
    private readonly moduleService: ModuleService,
    @inject(COURSES_TYPES.SectionService)
    private readonly sectionService: SectionService,
    @inject(COURSES_TYPES.ItemService)
    private readonly itemService: ItemService,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
  ) {}

  /**
   * Shares a pasted YouTube video with named recipients.
   *
   * The embeddability check runs first and hard-stops the share: generating
   * links for a video that cannot play would send recipients to a dead player
   * and record nothing.
   */
  async shareVideo(
    instructorId: string,
    url: string,
    recipients: ShareLinkRecipientInput[],
    viewingMode: ShareLinkViewingMode = ShareLinkViewingMode.PLAIN,
    endTime = '23:59:59',
    expiresInDays?: number,
    sendEmail = false,
  ): Promise<QuickShareResult> {
    const check = await this.youTubeEmbedService.check(url);
    if (!check.embeddable) {
      throw new BadRequestError(check.message);
    }

    const container = await this.resolveContainer(instructorId);
    const videoTitle = check.title || 'Shared video';

    const {createdItem} = await this.itemService.createItem(
      container.versionId,
      container.moduleId,
      container.sectionId,
      {
        name: videoTitle,
        description: `Shared from ${url}`,
        type: ItemType.VIDEO,
        videoDetails: {
          URL: url,
          startTime: '00:00:00',
          endTime,
          points: 0,
        },
      } as any,
    );

    const itemId = createdItem?._id?.toString();
    if (!itemId) {
      throw new InternalServerError('Failed to file the shared video.');
    }

    const links = await this.shareLinkService.createShareLinks(
      container.courseId,
      container.versionId,
      recipients,
      instructorId,
      container.cohortId,
      itemId,
      expiresInDays,
      viewingMode,
      sendEmail,
      // Recipients recognise the video by its title, not by the holder it was
      // filed into — which they never see.
      videoTitle,
    );

    return {itemId, videoTitle, links};
  }

  /** Every quick share this instructor has made, and who watched. */
  async listQuickShares(instructorId: string): Promise<ShareLinkAnalytics[]> {
    const course =
      await this.shareLinkRepo.findQuickShareContainerCourse(instructorId);
    if (!course) {
      return [];
    }
    const courseId = course._id.toString();
    const versionId = course.versions[0]?.toString();
    if (!versionId) {
      return [];
    }
    return this.shareLinkService.getAnalytics(courseId, versionId);
  }

  /**
   * Finds the instructor's holder, creating it on first use.
   *
   * One per instructor, so their quick-share analytics stay in a single place
   * rather than scattering a hidden course per video.
   */
  private async resolveContainer(
    instructorId: string,
  ): Promise<QuickShareContainer> {
    const existing =
      await this.shareLinkRepo.findQuickShareContainerCourse(instructorId);

    if (existing) {
      const versionId = existing.versions[0]?.toString();
      const version = versionId
        ? await this.courseRepo.readVersion(versionId)
        : null;
      if (version) {
        const module = version.modules?.find(m => !m.isDeleted);
        const section = module?.sections?.find(s => !s.isDeleted);
        if (module && section) {
          return {
            courseId: existing._id.toString(),
            versionId,
            cohortId: version.cohorts?.[0]?.toString(),
            moduleId: module.moduleId.toString(),
            sectionId: section.sectionId.toString(),
          };
        }
      }
    }

    return this.createContainer(instructorId);
  }

  private async createContainer(
    instructorId: string,
  ): Promise<QuickShareContainer> {
    const course = new Course({
      name: CONTAINER_COURSE_NAME,
      description: CONTAINER_COURSE_DESCRIPTION,
    } as any);

    const created = await this.courseService.createCourse(
      course,
      'Shared videos',
      CONTAINER_COURSE_DESCRIPTION,
      instructorId,
      [CONTAINER_COHORT_NAME],
      false,
      0,
    );

    const courseId = created._id.toString();
    const versionId = created.versions[0].toString();

    // Both flags are what keep the holder invisible: the course is never
    // listed as a course, and the instructor's own enrollment into it is not
    // counted among the courses they teach.
    await this.shareLinkRepo.markCourseAsQuickShareContainer(courseId);
    await this.enrollmentRepo.markQuickShareContainerEnrollment(
      instructorId,
      courseId,
      versionId,
    );

    await this.moduleService.createModule(versionId, {
      name: CONTAINER_MODULE_NAME,
      description: CONTAINER_CHILD_DESCRIPTION,
    } as any);

    const withModule = await this.courseRepo.readVersion(versionId);
    const module = withModule.modules.find(m => !m.isDeleted);

    await this.sectionService.createSection(versionId, module.moduleId.toString(), {
      name: CONTAINER_SECTION_NAME,
      description: CONTAINER_CHILD_DESCRIPTION,
    } as any);

    const withSection = await this.courseRepo.readVersion(versionId);
    const freshModule = withSection.modules.find(m => !m.isDeleted);
    const section = freshModule.sections.find(s => !s.isDeleted);

    return {
      courseId,
      versionId,
      cohortId: withSection.cohorts?.[0]?.toString(),
      moduleId: freshModule.moduleId.toString(),
      sectionId: section.sectionId.toString(),
    };
  }

}
