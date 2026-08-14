import { injectable, inject } from 'inversify';
import { InternalServerError, NotFoundError } from 'routing-controllers';
import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import { ProgressRepository } from '#shared/database/providers/mongo/repositories/ProgressRepository.js';
import { IItemRepository } from '#shared/database/interfaces/IItemRepository.js';
import { ICourseRepository } from '#shared/database/interfaces/ICourseRepository.js';
import { USERS_TYPES } from '#users/types.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { Item } from '#courses/classes/transformers/Item.js';
import { getItemEffortMinutes } from '../utils/pacingEffort.js';
import { ObjectId } from 'mongodb';

export interface PacingPlan {
  hasTarget: boolean;
  targetCompletionDate: Date | null;
  teacherDeadline?: Date | null;
  itemsRemaining: number;
  effortMinutesRemaining: number;
  daysLeft: number;
  itemsPerDay: number;
  requiredMinutesPerDay: number;
  isOverdue: boolean;
  paceStatus: 'ahead' | 'on_track' | 'behind' | 'no_data';
  aheadOrBehindByDays: number | null;
  suggestedCatchUpDate: Date | null;
  moduleBreakdown: Array<{
    moduleId: string;
    moduleName: string;
    totalItems: number;
    completedItems: number;
    itemsRemaining: number;
    effortMinutesRemaining: number;
    suggestedFinishByDate: Date | null;
    difficulty?: string;
  }>;
}

export interface CoursePacingOverview {
  totalStudents: number;
  aheadCount: number;
  onTrackCount: number;
  behindCount: number;
  noDataCount: number;
  noTargetSetCount: number;
  teacherDeadline?: Date | null;
  students: Array<{
    userId: string;
    name: string;
    hasTarget: boolean;
    paceStatus: 'ahead' | 'on_track' | 'behind' | 'no_data' | null;
    aheadOrBehindByDays: number | null;
    requiredMinutesPerDay: number | null;
    itemsRemaining: number;
  }>;
}

@injectable()
export class PacingService {
  constructor(
    @inject(USERS_TYPES.EnrollmentRepo) private enrollmentRepo: EnrollmentRepository,
    @inject(USERS_TYPES.ProgressRepo) private progressRepository: ProgressRepository,
    @inject(USERS_TYPES.ItemRepo) private itemRepo: IItemRepository,
    @inject(GLOBAL_TYPES.CourseRepo) private courseRepo: ICourseRepository,
  ) { }

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

  async setPacingTarget(
    userId: string,
    courseId: string,
    courseVersionId: string,
    targetCompletionDate: Date | null,
    cohort?: string,
  ): Promise<void> {
    const enrollment = await this.resolveEnrollment(userId, courseId, courseVersionId, cohort);
    if (!enrollment) {
      throw new NotFoundError('Enrollment not found');
    }
    await this.enrollmentRepo.updateTargetCompletionDate(
      enrollment._id.toString(),
      targetCompletionDate,
    );
  }

  async getPacingPlan(
    userId: string,
    courseId: string,
    courseVersionId: string,
    cohort?: string,
    forceTeacherDeadline?: boolean,
  ): Promise<PacingPlan> {
    const enrollment = await this.resolveEnrollment(userId, courseId, courseVersionId, cohort);
    if (!enrollment) {
      throw new NotFoundError('Enrollment not found');
    }

    const courseVersion = await this.courseRepo.readVersion(courseVersionId);
    if (!courseVersion) {
      throw new NotFoundError('Course version not found');
    }

    const completedIds = await this.progressRepository.getCompletedItems(
      userId,
      courseId,
      courseVersionId,
      cohort,
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

    const moduleBreakdown: PacingPlan['moduleBreakdown'] = [];
    const itemDifficultyMap = new Map<string, string | undefined>();
    let totalItems = 0;
    let totalCompleted = 0;
    let totalEffortRemaining = 0;

    for (const mod of courseVersion.modules) {
      const moduleId = mod.moduleId?.toString() || '';
      const moduleName = mod.name;
      let moduleTotal = 0;
      let moduleCompleted = 0;
      let moduleEffortRemaining = 0;

      for (const sec of mod.sections) {
        if (!sec.itemsGroupId) continue;
        const itemsGroup = itemsGroupMap.get(sec.itemsGroupId.toString()) || await this.itemRepo.readItemsGroup(sec.itemsGroupId.toString());
        const items = itemsGroup?.items || [];
        for (const itemRef of items) {
          if (itemRef.isHidden) continue;
          moduleTotal++;
          const itemIdStr = itemRef._id?.toString();
          if (itemIdStr) {
            itemDifficultyMap.set(itemIdStr, mod.difficulty);
          }
          const isCompleted = completedIds.includes(itemIdStr || '');
          if (isCompleted) {
            moduleCompleted++;
            continue;
          }
          // fetch full item for effort
          const fullItem = itemIdStr ? await getItem(itemIdStr) : null;
          const effort = fullItem ? getItemEffortMinutes(fullItem) : 10;
          moduleEffortRemaining += effort;
        }
      }

      // Adjust effort according to difficulty: moderate +5%, difficult/hard +10%
      if (mod.difficulty === 'moderate') {
        moduleEffortRemaining = moduleEffortRemaining * 1.05;
      } else if (mod.difficulty === 'difficult' || mod.difficulty === 'hard') {
        moduleEffortRemaining = moduleEffortRemaining * 1.10;
      }

      const itemsRemaining = moduleTotal - moduleCompleted;
      totalItems += moduleTotal;
      totalCompleted += moduleCompleted;
      totalEffortRemaining += moduleEffortRemaining;

      moduleBreakdown.push({
        moduleId,
        moduleName,
        totalItems: moduleTotal,
        completedItems: moduleCompleted,
        itemsRemaining,
        effortMinutesRemaining: Math.round(moduleEffortRemaining),
        suggestedFinishByDate: null,
        difficulty: mod.difficulty,
      });
    }

    const itemsRemaining = totalItems - totalCompleted;

    const hasTarget = forceTeacherDeadline ? !!courseVersion.teacherDeadline : !!enrollment.targetCompletionDate;
    const targetDate = forceTeacherDeadline ? (courseVersion.teacherDeadline || null) : (enrollment.targetCompletionDate || null);
    const today = new Date();
    const daysLeft = hasTarget ? Math.max(0, Math.ceil((targetDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : 0;
    const requiredMinutesPerDay = daysLeft > 0 ? Math.ceil(totalEffortRemaining / daysLeft) : totalEffortRemaining;
    const itemsPerDay = daysLeft > 0 ? Math.ceil(itemsRemaining / daysLeft) : itemsRemaining;
    const isOverdue = hasTarget && targetDate! < today && itemsRemaining > 0;

    // Allocate suggestedFinishByDate per module proportionally
    if (hasTarget && daysLeft > 0) {
      let accumulatedDays = 0;
      for (const mod of moduleBreakdown) {
        if (mod.effortMinutesRemaining === 0) {
          mod.suggestedFinishByDate = null;
          continue;
        }
        const share = mod.effortMinutesRemaining / totalEffortRemaining;
        const allocDays = Math.ceil(share * daysLeft);
        accumulatedDays += allocDays;
        const date = new Date();
        date.setDate(today.getDate() + Math.min(accumulatedDays, daysLeft));
        mod.suggestedFinishByDate = date;
      }
    }

    // Adaptive pace calculation
    let paceStatus: PacingPlan['paceStatus'] = 'no_data';
    let aheadOrBehindByDays: number | null = null;
    let suggestedCatchUpDate: Date | null = null;

    if (hasTarget) {
      const windowStart = new Date();
      windowStart.setDate(today.getDate() - 7);
      const recentCompleted = await this.progressRepository.getCompletedItemsInWindow(
        userId,
        courseId,
        courseVersionId,
        windowStart,
        cohort,
      );
      if (recentCompleted.length > 0) {
        let minutes = 0;
        for (const id of recentCompleted) {
          const fullItem = await getItem(id);
          if (fullItem) {
            let effort = getItemEffortMinutes(fullItem);
            const difficulty = itemDifficultyMap.get(id);
            if (difficulty === 'moderate') {
              effort *= 1.05;
            } else if (difficulty === 'difficult' || difficulty === 'hard') {
              effort *= 1.10;
            }
            minutes += effort;
          }
        }
        const daysSinceEnroll = Math.max(1, Math.floor((today.getTime() - new Date(enrollment.enrollmentDate).getTime()) / (1000 * 60 * 60 * 24)));
        const divisor = Math.min(7, daysSinceEnroll);
        const actualMinutesPerDay = minutes / divisor;
        if (actualMinutesPerDay >= requiredMinutesPerDay * 1.1) {
          paceStatus = 'ahead';
        } else if (actualMinutesPerDay <= requiredMinutesPerDay * 0.9) {
          paceStatus = 'behind';
        } else {
          paceStatus = 'on_track';
        }
        aheadOrBehindByDays = Math.round(daysLeft - (totalEffortRemaining / actualMinutesPerDay));
        if (paceStatus === 'behind') {
          const catchUpDays = Math.ceil(totalEffortRemaining / actualMinutesPerDay);
          const catchUp = new Date();
          catchUp.setDate(today.getDate() + catchUpDays);
          suggestedCatchUpDate = catchUp;
        }
      }
    }

    return {
      hasTarget,
      targetCompletionDate: targetDate,
      teacherDeadline: courseVersion.teacherDeadline || null,
      itemsRemaining,
      effortMinutesRemaining: Math.round(totalEffortRemaining),
      daysLeft,
      itemsPerDay: Math.round(itemsPerDay),
      requiredMinutesPerDay: Math.round(requiredMinutesPerDay),
      isOverdue,
      paceStatus,
      aheadOrBehindByDays: aheadOrBehindByDays !== null ? Math.round(aheadOrBehindByDays) : null,
      suggestedCatchUpDate,
      moduleBreakdown,
    };
  }

  async getCoursePacingOverview(
    courseId: string,
    courseVersionId: string,
  ): Promise<CoursePacingOverview> {
    const result = await this.enrollmentRepo.getCourseVersionEnrollments(
      courseId,
      courseVersionId,
      0,
      100000,
      '',
      'name',
      'asc',
      'STUDENT',
      'ACTIVE',
    );
    const courseVersion = await this.courseRepo.readVersion(courseVersionId);
    const teacherDeadline = courseVersion?.teacherDeadline || null;

    const enrollments = result.enrollments || [];

    let aheadCount = 0;
    let onTrackCount = 0;
    let behindCount = 0;
    let noDataCount = 0;
    let noTargetSetCount = 0;
    const students: CoursePacingOverview['students'] = [];

    for (const enrollment of enrollments) {
      const studentUserId = enrollment.userId?.toString();
      if (!studentUserId) continue;

      try {
        const plan = await this.getPacingPlan(
          studentUserId,
          courseId,
          courseVersionId,
          enrollment.cohortId?.toString(),
          true,
        );

        const name = `${enrollment.firstName || ''} ${enrollment.lastName || ''}`.trim() || enrollment.email || 'Unknown';

        const paceStatus = plan.hasTarget ? plan.paceStatus : null;

        if (!plan.hasTarget) {
          noTargetSetCount++;
        } else if (plan.paceStatus === 'ahead') {
          aheadCount++;
        } else if (plan.paceStatus === 'on_track') {
          onTrackCount++;
        } else if (plan.paceStatus === 'behind') {
          behindCount++;
        } else if (plan.paceStatus === 'no_data') {
          noDataCount++;
        }

        students.push({
          userId: studentUserId,
          name,
          hasTarget: plan.hasTarget,
          paceStatus: paceStatus,
          aheadOrBehindByDays: plan.aheadOrBehindByDays,
          requiredMinutesPerDay: plan.requiredMinutesPerDay,
          itemsRemaining: plan.itemsRemaining,
        });
      } catch (err) {
        console.error(`Failed to get pacing plan for student ${studentUserId}:`, err);
      }
    }

    students.sort((a, b) => {
      const getCategoryValue = (s: any) => {
        if (!s.hasTarget) return 2;
        if (s.paceStatus === 'no_data') return 1;
        return 0;
      };

      const catA = getCategoryValue(a);
      const catB = getCategoryValue(b);
      if (catA !== catB) return catA - catB;

      if (catA === 0) {
        const daysA = a.aheadOrBehindByDays ?? 0;
        const daysB = b.aheadOrBehindByDays ?? 0;
        return daysA - daysB;
      }
      return 0;
    });

    return {
      totalStudents: enrollments.length,
      aheadCount,
      onTrackCount,
      behindCount,
      noDataCount,
      noTargetSetCount,
      students,
    };
  }
}
