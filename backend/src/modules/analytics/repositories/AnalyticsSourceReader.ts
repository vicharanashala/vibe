import {injectable, inject} from 'inversify';
import {ObjectId} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import type {
  CourseItem,
  CourseStructure,
  LearnerSources,
} from '../services/projection.js';
import {hmsToSeconds} from '../services/time.js';

/** Matches an id stored either as an ObjectId or as its hex string. */
export function idIn(ids: string[]): {$in: (string | ObjectId)[]} {
  const out: (string | ObjectId)[] = [];
  for (const id of ids) {
    out.push(id);
    if (ObjectId.isValid(id) && String(new ObjectId(id)) === id)
      out.push(new ObjectId(id));
  }
  return {$in: out};
}
const idEq = (id: string) => idIn([id]);

export interface RosterEntry {
  userId: string;
  enrollment: LearnerSources['enrollment'];
  progress: LearnerSources['progress'];
}

const byOrder = (a: {order?: string}, b: {order?: string}) =>
  String(a.order ?? '').localeCompare(String(b.order ?? ''));

/**
 * Read-only access to the platform's existing learning records for the
 * analytics projector. Nothing here writes to any collection.
 */
@injectable()
export class AnalyticsSourceReader {
  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private col(name: string) {
    return this.db.getCollection<any>(name);
  }

  /** Visible modules, sections and items of a version, in course order. */
  async loadStructure(versionId: string): Promise<CourseStructure | null> {
    const version = await (
      await this.col('newCourseVersion')
    ).findOne({_id: idEq(versionId)});
    if (!version) return null;
    const modules = [...(version.modules ?? [])]
      .filter((m: any) => !m.isDeleted && !m.isHidden)
      .sort(byOrder);
    const groupIds: string[] = [];
    for (const m of modules)
      for (const s of m.sections ?? [])
        if (!s.isDeleted && !s.isHidden && s.itemsGroupId)
          groupIds.push(String(s.itemsGroupId));
    const groups = await (await this.col('itemsGroup'))
      .find({_id: idIn(groupIds)})
      .toArray();
    const groupById = new Map(groups.map((g: any) => [String(g._id), g]));

    const refs: Omit<CourseItem, 'name' | 'durationSeconds'>[] = [];
    const outModules: CourseStructure['modules'] = [];
    let order = 0;
    modules.forEach((m: any) => {
      const itemIds: string[] = [];
      const moduleIndex = outModules.length;
      for (const s of [...(m.sections ?? [])].sort(byOrder)) {
        if (s.isDeleted || s.isHidden || !s.itemsGroupId) continue;
        const g = groupById.get(String(s.itemsGroupId));
        const items = [...(g?.items ?? [])]
          .filter((i: any) => i?._id && !i.isHidden && !i.isDeleted)
          .sort(byOrder);
        for (const i of items) {
          const itemId = String(i._id);
          itemIds.push(itemId);
          refs.push({
            itemId,
            type: String(i.type ?? '').toUpperCase(),
            moduleId: String(m.moduleId),
            sectionId: String(s.sectionId),
            moduleIndex,
            order: order++,
          });
        }
      }
      outModules.push({moduleId: String(m.moduleId), name: m.name ?? '', itemIds});
    });

    // Names (and video lengths) live in the per-type item collections.
    const details = new Map<string, any>();
    const ids = refs.map(r => r.itemId);
    for (const name of [
      'videos',
      'quizzes',
      'blogs',
      'feedback_forms',
      'projects',
      'reflection_items',
    ]) {
      const docs = await (await this.col(name))
        .find(
          {_id: idIn(ids)},
          {projection: {name: 1, 'details.startTime': 1, 'details.endTime': 1}},
        )
        .toArray();
      for (const d of docs) details.set(String(d._id), d);
    }

    const items = new Map<string, CourseItem>();
    for (const r of refs) {
      const d = details.get(r.itemId);
      let durationSeconds: number | null = null;
      if (r.type === 'VIDEO') {
        const start = hmsToSeconds(d?.details?.startTime) ?? 0;
        const end = hmsToSeconds(d?.details?.endTime);
        durationSeconds = end != null && end > start ? end - start : null;
      }
      items.set(r.itemId, {...r, name: d?.name ?? 'Untitled', durationSeconds});
    }

    return {
      courseId: String(version.courseId),
      versionId,
      modules: outModules,
      items,
      quizIds: refs.filter(r => r.type === 'QUIZ').map(r => r.itemId),
      videoIds: refs.filter(r => r.type === 'VIDEO').map(r => r.itemId),
      questionText: new Map(),
    };
  }

  /**
   * Enrolled students of a version with their progress. Staff, share-link
   * guests and quick-share holders are excluded, matching the existing
   * course statistics.
   */
  async loadRoster(courseId: string, versionId: string): Promise<RosterEntry[]> {
    const enrollments = await (await this.col('enrollment'))
      .find(
        {
          courseId: idEq(courseId),
          courseVersionId: idEq(versionId),
          role: {$regex: /^student$/i},
          status: {$regex: /^active$/i},
          isDeleted: {$ne: true},
          isShareLinkGuest: {$ne: true},
          isQuickShareContainer: {$ne: true},
        },
        {
          projection: {
            userId: 1,
            enrollmentDate: 1,
            percentCompleted: 1,
            cohortId: 1,
            cohort: 1,
          },
        },
      )
      .toArray();
    const progress = await (await this.col('progress'))
      .find(
        {courseId: idEq(courseId), courseVersionId: idEq(versionId)},
        {projection: {userId: 1, currentItem: 1, completed: 1, completedAt: 1}},
      )
      .toArray();
    const progressByUser = new Map<string, any>();
    for (const p of progress) {
      const key = String(p.userId);
      // A student with several progress rows (cohorts): keep the furthest along.
      const prev = progressByUser.get(key);
      if (!prev || (p.completed && !prev.completed)) progressByUser.set(key, p);
    }
    const seen = new Set<string>();
    const out: RosterEntry[] = [];
    for (const e of enrollments) {
      const userId = String(e.userId);
      if (seen.has(userId)) continue;
      seen.add(userId);
      out.push({userId, enrollment: e, progress: progressByUser.get(userId) ?? null});
    }
    return out;
  }

  /** Students with any record for this version in (from, to]. */
  async dirtyUserIds(
    courseId: string,
    versionId: string,
    quizIds: string[],
    from: Date,
    to: Date,
  ): Promise<Set<string>> {
    const range = {$gt: from, $lte: to};
    const lists = await Promise.all([
      (await this.col('watchTime')).distinct('userId', {
        courseId: idEq(courseId),
        courseVersionId: idEq(versionId),
        endTime: range,
      }),
      quizIds.length
        ? (await this.col('quiz_submission_results')).distinct('userId', {
            quizId: idIn(quizIds),
            submittedAt: range,
          })
        : Promise.resolve([]),
      (await this.col('anomaly_records')).distinct('userId', {
        versionId: idEq(versionId),
        createdAt: range,
      }),
      (await this.col('studyViews')).distinct('userId', {
        courseVersionId: idEq(versionId),
        firstStudiedAt: range,
      }),
      (await this.col('user_activity_events')).distinct('userId', {
        courseVersionId: idEq(versionId),
        updatedAt: range,
      }),
    ]);
    const out = new Set<string>();
    for (const list of lists) for (const id of list) out.add(String(id));
    return out;
  }

  /** Every record of these students for this version, grouped by student. */
  async loadLearnerRecords(
    courseId: string,
    versionId: string,
    quizIds: string[],
    userIds: string[],
  ): Promise<
    Map<
      string,
      Omit<LearnerSources, 'userId' | 'enrollment' | 'progress'>
    >
  > {
    const users = idIn(userIds);
    const [watch, subs, anomalies, study, activity, people] = await Promise.all([
      (await this.col('watchTime'))
        .find(
          {
            userId: users,
            courseId: idEq(courseId),
            courseVersionId: idEq(versionId),
          },
          {projection: {userId: 1, itemId: 1, startTime: 1, endTime: 1, isDeleted: 1}},
        )
        .toArray(),
      quizIds.length
        ? (await this.col('quiz_submission_results'))
            .find(
              {userId: users, quizId: idIn(quizIds)},
              {
                projection: {
                  userId: 1,
                  quizId: 1,
                  submittedAt: 1,
                  'gradingResult.totalScore': 1,
                  'gradingResult.totalMaxScore': 1,
                  'gradingResult.gradingStatus': 1,
                  'gradingResult.overallFeedback.questionId': 1,
                  'gradingResult.overallFeedback.status': 1,
                },
              },
            )
            .toArray()
        : Promise.resolve([]),
      (await this.col('anomaly_records'))
        .find(
          {userId: users, versionId: idEq(versionId)},
          {projection: {userId: 1, type: 1, createdAt: 1}},
        )
        .toArray(),
      (await this.col('studyViews'))
        .find(
          {userId: users, courseVersionId: idEq(versionId)},
          {projection: {userId: 1, itemId: 1, firstStudiedAt: 1}},
        )
        .toArray(),
      (await this.col('user_activity_events'))
        .find(
          {userId: users, courseVersionId: idEq(versionId)},
          {projection: {userId: 1, videoId: 1, 'rewindData.to': 1}},
        )
        .toArray(),
      (await this.col('users'))
        .find(
          {_id: users},
          {projection: {firstName: 1, lastName: 1, email: 1}},
        )
        .toArray(),
    ]);
    const out = new Map<
      string,
      Omit<LearnerSources, 'userId' | 'enrollment' | 'progress'>
    >();
    for (const id of userIds)
      out.set(id, {
        user: null,
        watchTimes: [],
        submissions: [],
        anomalies: [],
        studyViews: [],
        activityEvents: [],
      });
    const push = (rows: any[], key: keyof Omit<LearnerSources, 'userId' | 'enrollment' | 'progress' | 'user'>) => {
      for (const r of rows) out.get(String(r.userId))?.[key].push(r as never);
    };
    push(watch, 'watchTimes');
    push(subs, 'submissions');
    push(anomalies, 'anomalies');
    push(study, 'studyViews');
    push(activity, 'activityEvents');
    for (const p of people) {
      const entry = out.get(String(p._id));
      if (entry) entry.user = p;
    }
    return out;
  }

  /** Whether any proctoring check is turned on for the course version. */
  async proctoringChecksOn(courseId: string, versionId: string): Promise<boolean> {
    const s = await (await this.col('courseSettings')).findOne(
      {courseId: idEq(courseId), courseVersionId: idEq(versionId)},
      {projection: {'settings.proctors.detectors': 1}},
    );
    return (s?.settings?.proctors?.detectors ?? []).some(
      (d: any) => d?.settings?.enabled,
    );
  }

  async questionTexts(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const docs = await (await this.col('questions'))
      .find({_id: idIn(ids)}, {projection: {text: 1}})
      .toArray();
    return new Map(docs.map((d: any) => [String(d._id), String(d.text ?? '')]));
  }
}
