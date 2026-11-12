import {injectable, inject} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {COURSES_TYPES} from '#courses/types.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import type {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import type {IItemRepository} from '#root/shared/database/interfaces/IItemRepository.js';
import type {EnrollmentRepository} from '#root/shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import {
  ContentLockSource,
  resolveContentLock,
} from '#root/shared/interfaces/models.js';
import {ContentLockedError} from '../errors/ContentLockedError.js';

/**
 * The one check behind every student entry point to a lesson (spec
 * backend/content-locking). It takes only the item id and works out where the
 * lesson really sits, so ids in a request can't change the answer, and quiz
 * attempts, whose requests name no course or version, can use it too.
 */
@injectable()
export class ContentLockService {
  constructor(
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
  ) {}

  /**
   * Throws ContentLockedError if the lesson is locked and the caller isn't
   * course staff. A lesson that can't be placed in a version counts as open:
   * the caller's own checks deal with it.
   */
  async assertOpenForUser(userId: string, itemId: string): Promise<void> {
    const group = await this.itemRepo.findItemsGroupByItemId(itemId);
    const ref = group?.items?.find(i => i._id?.toString() === itemId);
    if (!group || !ref) return;

    const place = await this.courseRepo.getItemGroupInfo(group._id);
    if (!place) return;
    const versionId = place.courseVersionId.toString();
    const version = await this.courseRepo.readVersion(versionId);
    const module = version?.modules?.find(
      m => m.moduleId?.toString() === place.moduleId.toString(),
    );
    const section = module?.sections?.find(
      s => s.sectionId?.toString() === place.sectionId.toString(),
    );

    const {locked, source} = resolveContentLock(ref, section, module);
    if (!locked) return;

    const enrollment = await this.enrollmentRepo.findEnrollment(
      userId,
      version.courseId.toString(),
      versionId,
    );
    if (enrollment && enrollment.role !== 'STUDENT') return;

    throw new ContentLockedError(
      source as Exclude<ContentLockSource, 'default'>,
    );
  }
}
