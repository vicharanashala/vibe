import {injectable, inject} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {COURSES_TYPES} from '#courses/types.js';
import {USERS_TYPES} from '../types.js';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {IItemRepository} from '#root/shared/database/interfaces/IItemRepository.js';
import {ProgressRepository} from '#root/shared/database/providers/mongo/repositories/ProgressRepository.js';
import {StudyViewRepository} from '#root/shared/database/providers/mongo/repositories/StudyViewRepository.js';
import {EnrollmentRepository} from '#root/shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import {StudyModeError} from '#courses/errors/StudyModeError.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from 'routing-controllers';
import {
  IResolvedStudyMode,
  ItemType,
  resolveStudyMode,
} from '#root/shared/interfaces/models.js';

/** A student's study progress for one course version (spec backend/study-progress). */
export interface StudyProgress {
  studiedItems: number;
  totalItems: number;
  percentStudied: number;
  studiedItemIds: string[];
}

/** Lesson types that count towards study progress. */
export const STUDY_PROGRESS_TYPES = new Set<string>([
  ItemType.VIDEO,
  ItemType.BLOG,
]);

type Node = {
  studyModeEnabled?: boolean | null;
  isHidden?: boolean;
  isDeleted?: boolean;
};
type VersionLike = {
  modules?: (Node & {
    moduleId?: unknown;
    sections?: (Node & {sectionId?: unknown; itemsGroupId?: unknown})[];
  })[];
};
type GroupLike = {
  _id?: unknown;
  items?: (Node & {_id?: unknown; type?: string})[];
};

export interface LessonPlace {
  itemId: string;
  moduleId: string;
  sectionId: string;
  type: string;
  studyMode: IResolvedStudyMode;
}

/**
 * Every visible lesson of a version with where it sits and its effective
 * study mode. Hidden or deleted modules, sections and items are skipped.
 */
export function lessonsOf(
  version: VersionLike | null | undefined,
  groups: GroupLike[],
): LessonPlace[] {
  const byId = new Map(groups.map(g => [String(g._id), g]));
  const out: LessonPlace[] = [];
  for (const m of version?.modules ?? []) {
    if (m.isHidden || m.isDeleted) continue;
    for (const s of m.sections ?? []) {
      if (s.isHidden || s.isDeleted || !s.itemsGroupId) continue;
      for (const ref of byId.get(String(s.itemsGroupId))?.items ?? []) {
        if (ref.isHidden || ref.isDeleted) continue;
        out.push({
          itemId: String(ref._id),
          moduleId: String(m.moduleId),
          sectionId: String(s.sectionId),
          type: String(ref.type),
          studyMode: resolveStudyMode(ref, s, m),
        });
      }
    }
  }
  return out;
}

/** The lessons study progress counts: visible videos and articles where study mode is allowed. */
export function eligibleLessons(lessons: LessonPlace[]): string[] {
  return lessons
    .filter(l => STUDY_PROGRESS_TYPES.has(l.type) && l.studyMode.allowed)
    .map(l => l.itemId);
}

/** covered = eligible ∩ (studied ∪ completed in strict mode). */
export function computeStudyProgress(
  eligible: string[],
  studied: Iterable<string>,
  completed: Iterable<string>,
): StudyProgress {
  const done = new Set([...studied, ...completed]);
  const studiedItemIds = eligible.filter(id => done.has(id));
  const totalItems = eligible.length;
  return {
    studiedItems: studiedItemIds.length,
    totalItems,
    percentStudied:
      totalItems === 0
        ? 0
        : Math.round((100 * studiedItemIds.length) / totalItems),
    studiedItemIds,
  };
}

@injectable()
export class StudyProgressService {
  constructor(
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(COURSES_TYPES.ItemRepo) private readonly itemRepo: IItemRepository,
    @inject(USERS_TYPES.ProgressRepo)
    private readonly progressRepo: ProgressRepository,
    @inject(USERS_TYPES.StudyViewRepo)
    private readonly studyViewRepo: StudyViewRepository,
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
  ) {}

  /** The caller's active enrollment in the course version (any cohort), or a 403. */
  private async activeEnrollment(
    userId: string,
    courseId: string,
    versionId: string,
  ) {
    const enrollment = await this.enrollmentRepo.findEnrollment(
      userId,
      courseId,
      versionId,
    );
    if (!enrollment || enrollment.status === 'INACTIVE') {
      throw new ForbiddenError('You are not enrolled in this course version');
    }
    return enrollment;
  }

  /**
   * Records that the caller studied a video or article (spec "Only valid
   * study views are recorded"). Never touches strict progress.
   */
  async recordStudyView(
    userId: string,
    courseId: string,
    versionId: string,
    lesson: {moduleId: string; sectionId: string; itemId: string},
  ): Promise<{recorded: boolean}> {
    const enrollment = await this.activeEnrollment(userId, courseId, versionId);
    const place = (await this.lessons(versionId)).find(
      l =>
        l.itemId === lesson.itemId &&
        l.moduleId === lesson.moduleId &&
        l.sectionId === lesson.sectionId,
    );
    if (!place) {
      throw new NotFoundError(
        `Item ${lesson.itemId} not found in this course version`,
      );
    }
    if (!STUDY_PROGRESS_TYPES.has(place.type)) {
      throw new BadRequestError(
        'Only videos and articles count towards study progress',
      );
    }
    if (!place.studyMode.allowed) {
      throw new StudyModeError(
        'STUDY_MODE_DISABLED',
        `The instructor has disabled study mode for this ${place.studyMode.source}.`,
        place.studyMode.source,
      );
    }
    // Study progress is tracked for students only.
    if (enrollment.role !== 'STUDENT') return {recorded: false};
    await this.studyViewRepo.recordView({
      userId,
      courseId,
      courseVersionId: versionId,
      itemId: lesson.itemId,
    });
    return {recorded: true};
  }

  /** The caller's own study progress. */
  async studyProgressFor(
    userId: string,
    courseId: string,
    versionId: string,
  ): Promise<StudyProgress> {
    const enrollment = await this.activeEnrollment(userId, courseId, versionId);
    return this.forUser(
      courseId,
      versionId,
      userId,
      enrollment.cohortId?.toString() ?? null,
    );
  }

  /** All visible lessons of a version, from one version read and one ItemsGroup query. */
  async lessons(versionId: string): Promise<LessonPlace[]> {
    const version = await this.courseRepo.readVersion(versionId);
    const groupIds = (version?.modules ?? []).flatMap(m =>
      (m.sections ?? [])
        .map(s => s.itemsGroupId?.toString())
        .filter((id): id is string => !!id),
    );
    const groups = await this.itemRepo.readItemsGroupsByIds(groupIds);
    return lessonsOf(version as VersionLike, groups as GroupLike[]);
  }

  /** Study progress for several students of a course version, keyed by user id. */
  async forUsers(
    courseId: string,
    versionId: string,
    users: {userId: string; cohortId?: string | null}[],
  ): Promise<Map<string, StudyProgress>> {
    const result = new Map<string, StudyProgress>();
    if (users.length === 0) return result;
    const eligible = eligibleLessons(await this.lessons(versionId));
    const views = await this.studyViewRepo.findViews(
      versionId,
      users.map(u => u.userId),
      eligible,
    );
    const studiedBy = new Map<string, string[]>();
    for (const v of views)
      studiedBy.set(v.userId, [...(studiedBy.get(v.userId) ?? []), v.itemId]);
    await Promise.all(
      users.map(async u => {
        const completed = await this.progressRepo.getCompletedItems(
          u.userId,
          courseId,
          versionId,
          u.cohortId ?? undefined,
        );
        result.set(
          u.userId,
          computeStudyProgress(
            eligible,
            studiedBy.get(u.userId) ?? [],
            completed,
          ),
        );
      }),
    );
    return result;
  }

  async forUser(
    courseId: string,
    versionId: string,
    userId: string,
    cohortId?: string | null,
  ): Promise<StudyProgress> {
    return (await this.forUsers(courseId, versionId, [{userId, cohortId}])).get(
      userId,
    )!;
  }
}
