import { injectable, inject } from 'inversify';
import { InternalServerError, NotFoundError, BadRequestError } from 'routing-controllers';
import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import { ProgressRepository } from '#shared/database/providers/mongo/repositories/ProgressRepository.js';
import { IItemRepository } from '#shared/database/interfaces/IItemRepository.js';
import { ICourseRepository } from '#shared/database/interfaces/ICourseRepository.js';
import { PacingGroupRepository } from '#shared/database/providers/mongo/repositories/PacingGroupRepository.js';
import { USERS_TYPES } from '#users/types.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { getItemEffortMinutes } from '../utils/pacingEffort.js';

export interface CombinedPacingPlan {
  hasSelection: boolean;
  targetCompletionDate: Date | null;
  daysLeft: number;
  totalEffortMinutesRemaining: number;
  requiredMinutesPerDay: number;
  paceStatus: 'ahead' | 'on_track' | 'behind' | 'no_data';
  aheadOrBehindByDays: number | null;
  suggestedCatchUpDate: Date | null;
  courses: Array<{
    courseId: string;
    courseVersionId: string;
    courseName: string;
    itemsRemaining: number;
    effortMinutesRemaining: number;
    shareOfTotal: number; // 0–1
  }>;
}

@injectable()
export class PacingGroupService {
  constructor(
    @inject(USERS_TYPES.PacingGroupRepo) private pacingGroupRepo: PacingGroupRepository,
    @inject(USERS_TYPES.EnrollmentRepo) private enrollmentRepo: EnrollmentRepository,
    @inject(USERS_TYPES.ProgressRepo) private progressRepository: ProgressRepository,
    @inject(USERS_TYPES.ItemRepo) private itemRepo: IItemRepository,
    @inject(GLOBAL_TYPES.CourseRepo) private courseRepo: ICourseRepository,
  ) {}

  private async resolveEnrollment(
    userId: string,
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
  ): Promise<any> {
    let enrollment = await this.enrollmentRepo.findEnrollment(
      userId,
      courseId,
      courseVersionId,
      cohortId,
    );
    if (!enrollment && cohortId) {
      enrollment = await this.enrollmentRepo.findEnrollment(
        userId,
        courseId,
        courseVersionId,
        undefined,
      );
    }
    return enrollment;
  }

  async setCombinedPacingTarget(
    userId: string,
    targetCompletionDate: Date,
    courseSelections: Array<{ courseId: string; courseVersionId: string; cohortId?: string }>,
  ): Promise<void> {
    // Validate: courseSelections must be a non-empty array
    if (!courseSelections || !Array.isArray(courseSelections) || courseSelections.length === 0) {
      throw new BadRequestError('Select at least one course');
    }

    // Validate: every entry must correspond to an active enrollment for the user
    for (const entry of courseSelections) {
      const enrollment = await this.resolveEnrollment(
        userId,
        entry.courseId,
        entry.courseVersionId,
        entry.cohortId,
      );
      if (!enrollment) {
        throw new BadRequestError(`Invalid enrollment for course ID ${entry.courseId}`);
      }
    }

    // Call pacingGroupRepo.upsertForUser with exactly the validated list.
    await this.pacingGroupRepo.upsertForUser(
      userId,
      targetCompletionDate,
      courseSelections,
    );
  }

  async clearCombinedPacingTarget(userId: string): Promise<void> {
    await this.pacingGroupRepo.clearForUser(userId);
  }

  async getCombinedPacingPlan(userId: string): Promise<CombinedPacingPlan> {
    // Load the group via pacingGroupRepo.getByUserId
    const group = await this.pacingGroupRepo.getByUserId(userId);
    if (!group || !group.courseSelections || group.courseSelections.length === 0) {
      return {
        hasSelection: false,
        targetCompletionDate: null,
        daysLeft: 0,
        totalEffortMinutesRemaining: 0,
        requiredMinutesPerDay: 0,
        paceStatus: 'no_data',
        aheadOrBehindByDays: null,
        suggestedCatchUpDate: null,
        courses: [],
      };
    }

    const courseBreakdowns: CombinedPacingPlan['courses'] = [];
    let totalEffortMinutesRemaining = 0;
    const today = new Date();
    const windowStart = new Date();
    windowStart.setDate(today.getDate() - 7);

    let totalRecentMinutes = 0;
    let maxDaysSinceEnroll = 1;
    let hasAnyRecentCompletions = false;

    for (const selection of group.courseSelections) {
      const courseIdStr = selection.courseId.toString();
      const versionIdStr = selection.courseVersionId.toString();
      const cohortIdStr = selection.cohortId?.toString();

      // Load course name
      const course = await this.courseRepo.read(courseIdStr);
      const courseName = course?.name || 'Unknown Course';

      // Load course version
      const courseVersion = await this.courseRepo.readVersion(versionIdStr);
      if (!courseVersion) {
        continue;
      }

      // Get completed items
      const completedIds = await this.progressRepository.getCompletedItems(
        userId,
        courseIdStr,
        versionIdStr,
        cohortIdStr,
      );

      const allGroupIds = (courseVersion.modules || [])
        .flatMap(m => m.sections || [])
        .map(s => s.itemsGroupId)
        .filter(Boolean)
        .map(id => id.toString());
      const itemsGroups = allGroupIds.length > 0 ? await this.itemRepo.getItemGroupsByIds(allGroupIds) : [];
      const itemsGroupMap = new Map<string, any>();
      for (const g of itemsGroups) {
        itemsGroupMap.set(g._id.toString(), g);
      }

      const itemCache = new Map<string, any>();
      const getItem = async (itemId: string) => {
        if (itemCache.has(itemId)) return itemCache.get(itemId);
        try {
          const item = await this.itemRepo.readItemById(itemId);
          itemCache.set(itemId, item);
          return item;
        } catch (_) {
          itemCache.set(itemId, null);
          return null;
        }
      };

      let courseTotalItems = 0;
      let courseCompletedItems = 0;
      let courseEffortRemaining = 0;

      for (const mod of courseVersion.modules) {
        for (const sec of mod.sections) {
          if (!sec.itemsGroupId) continue;
          const itemsGroup = itemsGroupMap.get(sec.itemsGroupId.toString()) || await this.itemRepo.readItemsGroup(sec.itemsGroupId.toString());
          const items = itemsGroup?.items || [];
          for (const itemRef of items) {
            if (itemRef.isHidden) continue;
            courseTotalItems++;
            const itemIdStr = itemRef._id?.toString();
            const isCompleted = completedIds.includes(itemIdStr || '');
            if (isCompleted) {
              courseCompletedItems++;
              continue;
            }
            const fullItem = itemIdStr ? await getItem(itemIdStr) : null;
            const effort = fullItem ? getItemEffortMinutes(fullItem) : 10;
            courseEffortRemaining += effort;
          }
        }
      }

      const itemsRemaining = courseTotalItems - courseCompletedItems;
      totalEffortMinutesRemaining += courseEffortRemaining;

      const enrollment = await this.resolveEnrollment(
        userId,
        courseIdStr,
        versionIdStr,
        cohortIdStr,
      );

      if (enrollment) {
        const daysSinceEnroll = Math.max(
          1,
          Math.floor((today.getTime() - new Date(enrollment.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24)),
        );
        maxDaysSinceEnroll = Math.max(maxDaysSinceEnroll, daysSinceEnroll);

        const recentCompleted = await this.progressRepository.getCompletedItemsInWindow(
          userId,
          courseIdStr,
          versionIdStr,
          windowStart,
          cohortIdStr,
        );

        if (recentCompleted.length > 0) {
          hasAnyRecentCompletions = true;
          for (const id of recentCompleted) {
            const fullItem = await getItem(id);
            if (fullItem) {
              totalRecentMinutes += getItemEffortMinutes(fullItem);
            }
          }
        }
      }

      courseBreakdowns.push({
        courseId: courseIdStr,
        courseVersionId: versionIdStr,
        courseName,
        itemsRemaining,
        effortMinutesRemaining: Math.round(courseEffortRemaining),
        shareOfTotal: 0,
      });
    }

    for (const breakdown of courseBreakdowns) {
      breakdown.shareOfTotal = totalEffortMinutesRemaining > 0
        ? breakdown.effortMinutesRemaining / totalEffortMinutesRemaining
        : 0;
    }

    const targetDate = group.targetCompletionDate;
    const daysLeft = Math.max(0, Math.ceil((new Date(targetDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const requiredMinutesPerDay = daysLeft > 0 ? Math.ceil(totalEffortMinutesRemaining / daysLeft) : totalEffortMinutesRemaining;

    let paceStatus: CombinedPacingPlan['paceStatus'] = 'no_data';
    let aheadOrBehindByDays: number | null = null;
    let suggestedCatchUpDate: Date | null = null;

    if (hasAnyRecentCompletions) {
      const divisor = Math.min(7, maxDaysSinceEnroll);
      const actualMinutesPerDay = totalRecentMinutes / divisor;
      if (actualMinutesPerDay >= requiredMinutesPerDay * 1.1) {
        paceStatus = 'ahead';
      } else if (actualMinutesPerDay <= requiredMinutesPerDay * 0.9) {
        paceStatus = 'behind';
      } else {
        paceStatus = 'on_track';
      }

      if (actualMinutesPerDay > 0) {
        aheadOrBehindByDays = Math.round(daysLeft - (totalEffortMinutesRemaining / actualMinutesPerDay));
        if (paceStatus === 'behind') {
          const catchUpDays = Math.ceil(totalEffortMinutesRemaining / actualMinutesPerDay);
          const catchUp = new Date();
          catchUp.setDate(today.getDate() + catchUpDays);
          suggestedCatchUpDate = catchUp;
        }
      }
    }

    return {
      hasSelection: true,
      targetCompletionDate: targetDate,
      daysLeft,
      totalEffortMinutesRemaining: Math.round(totalEffortMinutesRemaining),
      requiredMinutesPerDay: Math.round(requiredMinutesPerDay),
      paceStatus,
      aheadOrBehindByDays: aheadOrBehindByDays !== null ? Math.round(aheadOrBehindByDays) : null,
      suggestedCatchUpDate,
      courses: courseBreakdowns,
    };
  }
}
