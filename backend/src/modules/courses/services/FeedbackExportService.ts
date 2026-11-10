import {injectable, inject} from 'inversify';
import {ObjectId} from 'mongodb';
import {NotFoundError} from 'routing-controllers';
import {GLOBAL_TYPES} from '#root/types.js';
import {COURSES_TYPES} from '#courses/types.js';
import {QUIZZES_TYPES} from '#quizzes/types.js';
import {USERS_TYPES} from '#users/types.js';
import type {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import type {IItemRepository} from '#root/shared/database/interfaces/IItemRepository.js';
import type {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import type {FeedbackRepository} from '#quizzes/repositories/providers/mongodb/FeedbackRepository.js';
import {EnrollmentRepository} from '#root/shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import {
  answerFields,
  formatAnswer,
  parseFeedbackFields,
  type FeedbackField,
} from '#courses/utils/feedbackFormFields.js';
import type {Cell, SheetSpec} from '#courses/utils/xlsxWriter.js';

/**
 * Builds feedback exports (one form, or a whole course version) as sheets
 * that are written out as .xlsx or CSV. Every answer row carries the
 * student's account name and email, cohort, where the form sits in the
 * course, the lesson it is about, and the time in IST and ISO 8601, then one
 * column per question titled with the question text.
 */

export type History = 'latest' | 'all';

export interface ExportStudent {
  name: string;
  email: string;
  cohort: string;
}

export interface ExportForm {
  id: string;
  name: string;
  moduleName: string;
  sectionName: string;
  /** The lesson before the form in its section (used when a submission has none recorded). */
  aboutName: string;
  fields: FeedbackField[];
}

export interface ExportSubmission {
  userId: string;
  feedbackFormId: string;
  previousItemId?: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
  isCurrentVersion: boolean;
  cohortId?: string | null;
}

const IST = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "2026-11-01 15:30" in India Standard Time. */
export function formatIST(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const p = Object.fromEntries(
    IST.formatToParts(d).map(x => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}

export function formatISO(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

export const FIXED_COLUMNS = [
  'Student',
  'Email',
  'Cohort',
  'Module',
  'Section',
  'Form',
  'About lesson',
  'Submitted (IST)',
  'Submitted (ISO)',
];

const UNKNOWN_STUDENT: ExportStudent = {name: '', email: '', cohort: ''};

/** The fixed columns of one answer row. */
function fixedCells(
  form: ExportForm,
  sub: ExportSubmission,
  student: ExportStudent,
  itemNames: Map<string, string>,
  history: History,
): Cell[] {
  const about = sub.previousItemId
    ? (itemNames.get(sub.previousItemId) ?? form.aboutName)
    : sub.previousItemId === null
      ? ''
      : form.aboutName;
  return [
    student.name,
    student.email,
    student.cohort,
    form.moduleName,
    form.sectionName,
    form.name,
    about,
    formatIST(sub.createdAt),
    formatISO(sub.createdAt),
    ...(history === 'all'
      ? [sub.isCurrentVersion ? 'Current' : 'Replaced']
      : []),
  ];
}

/** Newest first; only current answers unless history is 'all'. */
function pick(subs: ExportSubmission[], history: History) {
  return subs
    .filter(s => history === 'all' || s.isCurrentVersion)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

/** One form's sheet: the fixed columns, then a column per question. */
export function formSheet(
  form: ExportForm,
  subs: ExportSubmission[],
  students: Map<string, ExportStudent>,
  itemNames: Map<string, string>,
  history: History,
): SheetSpec {
  const questions = answerFields(form.fields);
  const header = [
    ...FIXED_COLUMNS,
    ...(history === 'all' ? ['Version'] : []),
    ...questions.map(q => q.title),
  ];
  const rows = pick(subs, history).map(sub => [
    ...fixedCells(
      form,
      sub,
      students.get(sub.userId) ?? UNKNOWN_STUDENT,
      itemNames,
      history,
    ),
    ...questions.map(q => formatAnswer(q, sub.details)),
  ]);
  return {name: form.name, header, rows};
}

/**
 * Every form's answers in one table (for the course CSV): the form name is a
 * column, and questions with the same text across forms share a column.
 */
export function allAnswersSheet(
  forms: ExportForm[],
  subsByForm: Map<string, ExportSubmission[]>,
  students: Map<string, ExportStudent>,
  itemNames: Map<string, string>,
  history: History,
): SheetSpec {
  const titles: string[] = [];
  for (const f of forms)
    for (const q of answerFields(f.fields))
      if (!titles.includes(q.title)) titles.push(q.title);
  const header = [
    ...FIXED_COLUMNS,
    ...(history === 'all' ? ['Version'] : []),
    ...titles,
  ];
  const rows: Cell[][] = [];
  for (const form of forms) {
    const questions = answerFields(form.fields);
    for (const sub of pick(subsByForm.get(form.id) ?? [], history)) {
      const byTitle = new Map(
        questions.map(q => [q.title, formatAnswer(q, sub.details)]),
      );
      rows.push([
        ...fixedCells(
          form,
          sub,
          students.get(sub.userId) ?? UNKNOWN_STUDENT,
          itemNames,
          history,
        ),
        ...titles.map(t => byTitle.get(t) ?? ''),
      ]);
    }
  }
  return {name: 'All answers', header, rows};
}

export interface OverviewStudent extends ExportStudent {
  userId: string;
  progress: number | null;
}

/** One row per enrolled student: forms answered and when they last answered. */
export function overviewSheet(
  students: OverviewStudent[],
  forms: ExportForm[],
  subs: ExportSubmission[],
): SheetSpec {
  const formIds = new Set(forms.map(f => f.id));
  const answered = new Map<string, Set<string>>();
  const last = new Map<string, Date>();
  for (const s of subs) {
    if (!formIds.has(s.feedbackFormId)) continue;
    if (!answered.has(s.userId)) answered.set(s.userId, new Set());
    answered.get(s.userId)!.add(s.feedbackFormId);
    const at = new Date(s.createdAt);
    if (!last.has(s.userId) || at > last.get(s.userId)!) last.set(s.userId, at);
  }
  return {
    name: 'Overview',
    header: [
      'Student',
      'Email',
      'Cohort',
      'Progress %',
      'Forms answered',
      'Total forms',
      'Last answer (IST)',
    ],
    rows: [...students]
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name) || a.email.localeCompare(b.email),
      )
      .map(s => [
        s.name,
        s.email,
        s.cohort,
        s.progress ?? '',
        answered.get(s.userId)?.size ?? 0,
        forms.length,
        formatIST(last.get(s.userId)),
      ]),
  };
}

export interface CourseExport {
  courseName: string;
  sheets: SheetSpec[];
  /** Every answer in one table, for CSV. */
  allAnswers: SheetSpec;
  /** One row per student per video, or null when the course has no videos. */
  watch: SheetSpec | null;
}

@injectable()
export class FeedbackExportService {
  constructor(
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,
    @inject(QUIZZES_TYPES.FeedbackRepo)
    private readonly feedbackRepo: FeedbackRepository,
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  /** The version's structure: forms in course order, item names and places. */
  private async structure(versionId: string) {
    const version = await this.courseRepo.readVersion(versionId);
    if (!version) throw new NotFoundError('Course version not found');
    const byOrder = (a: any, b: any) =>
      String(a.order ?? '').localeCompare(String(b.order ?? ''));
    const modules = [...(version.modules ?? [])]
      .filter((m: any) => !m.isDeleted)
      .sort(byOrder);
    const sections = modules.flatMap((m: any) =>
      [...(m.sections ?? [])]
        .filter((s: any) => !s.isDeleted)
        .sort(byOrder)
        .map((s: any) => ({module: m, section: s})),
    );
    const groups = await this.itemRepo.readItemsGroupsByIds(
      sections.map(s => s.section.itemsGroupId?.toString()).filter(Boolean),
    );
    const groupMap = new Map(groups.map((g: any) => [g._id.toString(), g]));

    const itemNames = new Map<string, string>();
    const place = new Map<
      string,
      {moduleName: string; sectionName: string; position: number}
    >();
    const formPlaces: {
      id: string;
      moduleId?: string;
      sectionId?: string;
      moduleName: string;
      sectionName: string;
      aboutName: string;
      name: string;
    }[] = [];
    let position = 0;
    for (const {module, section} of sections) {
      const items = [
        ...((groupMap.get(section.itemsGroupId?.toString()) as any)?.items ??
          []),
      ]
        .filter((i: any) => !i.isHidden && !i.isDeleted)
        .sort(byOrder);
      items.forEach((item: any, index: number) => {
        const id = item._id.toString();
        itemNames.set(id, item.name ?? '');
        place.set(id, {
          moduleName: module.name ?? '',
          sectionName: section.name ?? '',
          position: position++,
        });
        if (item.type === 'FEEDBACK') {
          formPlaces.push({
            id,
            moduleId: module.moduleId?.toString() ?? '',
            sectionId: section.sectionId?.toString() ?? '',
            name: item.name ?? 'Feedback',
            moduleName: module.name ?? '',
            sectionName: section.name ?? '',
            aboutName: index > 0 ? (items[index - 1].name ?? '') : '',
          });
        }
      });
    }
    return {version, itemNames, place, formPlaces};
  }

  private async loadForms(
    formPlaces: {
      id: string;
      moduleName: string;
      sectionName: string;
      aboutName: string;
      name: string;
    }[],
  ): Promise<ExportForm[]> {
    const docs =
      (await this.feedbackRepo.getFormsByIds(formPlaces.map(f => f.id))) ?? [];
    const byId = new Map(docs.map((d: any) => [d._id.toString(), d]));
    return formPlaces.map(fp => {
      const doc: any = byId.get(fp.id);
      return {
        ...fp,
        name: doc?.name || fp.name,
        fields: parseFeedbackFields(
          doc?.details?.jsonSchema,
          doc?.details?.uiSchema,
        ),
      };
    });
  }

  /** Account names, emails and cohort names for the given students. */
  private async people(
    userIds: string[],
    cohortOf: Map<string, string | undefined>,
    version: any,
  ): Promise<Map<string, ExportStudent>> {
    const cohortNames = new Map<string, string>();
    if (version.cohorts?.length) {
      const cohorts = await this.courseRepo.getCohortsByIds(version.cohorts, {
        limit: version.cohorts.length,
      });
      for (const c of cohorts) cohortNames.set(c._id.toString(), c.name);
    }
    const usersCollection = await this.db.getCollection<any>('users');
    const objectIds = userIds
      .filter(id => ObjectId.isValid(id))
      .map(id => new ObjectId(id));
    const users = await usersCollection
      .find(
        {_id: {$in: objectIds}},
        {projection: {firstName: 1, lastName: 1, email: 1}},
      )
      .toArray();
    const map = new Map<string, ExportStudent>();
    for (const u of users) {
      const id = u._id.toString();
      const cohort = cohortOf.get(id);
      map.set(id, {
        name: [u.firstName, u.lastName].filter(Boolean).join(' '),
        email: u.email ?? '',
        cohort: cohort ? (cohortNames.get(cohort) ?? '') : '',
      });
    }
    return map;
  }

  private static toExportSubmissions(raw: any[]): ExportSubmission[] {
    return raw.map(s => ({
      userId: s.userId?.toString(),
      feedbackFormId: s.feedbackFormId?.toString(),
      previousItemId:
        s.previousItemId === null ? null : s.previousItemId?.toString(),
      details: s.details ?? {},
      createdAt: s.createdAt,
      isCurrentVersion: !!s.isCurrentVersion,
      cohortId: s.cohortId?.toString(),
    }));
  }

  async buildCourseExport(
    courseId: string,
    versionId: string,
    options: {cohortIds?: string[]; history?: History} = {},
  ): Promise<CourseExport> {
    const history = options.history ?? 'latest';
    const course = await this.courseRepo.read(courseId);
    if (!course) throw new NotFoundError('Course not found');
    const {version, itemNames, place, formPlaces} =
      await this.structure(versionId);
    const forms = await this.loadForms(formPlaces);

    const [rawSubs, enrollments, watchData] = await Promise.all([
      this.feedbackRepo.getSubmissionsForForms(
        forms.map(f => f.id),
        versionId,
        options.cohortIds,
      ),
      this.enrollmentRepo.findEnrollments({
        courseId: {$in: [courseId, new ObjectId(courseId)]},
        courseVersionId: {$in: [versionId, new ObjectId(versionId)]},
        role: 'STUDENT',
        isDeleted: {$ne: true},
        ...(options.cohortIds
          ? {cohortId: {$in: options.cohortIds.map(id => new ObjectId(id))}}
          : {}),
      }),
      this.enrollmentRepo.getWatchFeedbackData(
        courseId,
        versionId,
        options.cohortIds ?? null,
      ),
    ]);
    const subs = FeedbackExportService.toExportSubmissions(rawSubs);

    const cohortOf = new Map<string, string | undefined>();
    for (const e of enrollments)
      cohortOf.set(e.userId.toString(), (e as any).cohortId?.toString());
    for (const s of subs)
      if (!cohortOf.has(s.userId))
        cohortOf.set(s.userId, s.cohortId ?? undefined);
    const students = await this.people([...cohortOf.keys()], cohortOf, version);

    const subsByForm = new Map<string, ExportSubmission[]>();
    for (const s of subs) {
      if (!subsByForm.has(s.feedbackFormId))
        subsByForm.set(s.feedbackFormId, []);
      subsByForm.get(s.feedbackFormId)!.push(s);
    }

    const overviewStudents: OverviewStudent[] = enrollments.map((e: any) => ({
      userId: e.userId.toString(),
      ...(students.get(e.userId.toString()) ?? UNKNOWN_STUDENT),
      progress:
        typeof e.percentCompleted === 'number'
          ? Math.round(e.percentCompleted * 100) / 100
          : null,
    }));
    const currentSubs = subs.filter(s => s.isCurrentVersion);

    const sheets: SheetSpec[] = [
      overviewSheet(overviewStudents, forms, currentSubs),
      ...forms.map(f =>
        formSheet(f, subsByForm.get(f.id) ?? [], students, itemNames, history),
      ),
    ];
    const watch = this.watchSheet(watchData, forms, students, place);
    if (watch) sheets.push(watch);

    return {
      courseName: (course as any).name ?? 'Course',
      sheets,
      allAnswers: allAnswersSheet(
        forms,
        subsByForm,
        students,
        itemNames,
        history,
      ),
      watch,
    };
  }

  /** One row per student per video: watch figures and that video's form answers. */
  private watchSheet(
    data: Awaited<ReturnType<EnrollmentRepository['getWatchFeedbackData']>>,
    forms: ExportForm[],
    students: Map<string, ExportStudent>,
    place: Map<
      string,
      {moduleName: string; sectionName: string; position: number}
    >,
  ): SheetSpec | null {
    if (!data.videos.length) return null;
    const formById = new Map(forms.map(f => [f.id, f]));
    const titles: string[] = [];
    for (const f of forms)
      for (const q of answerFields(f.fields))
        if (!titles.includes(q.title)) titles.push(q.title);
    const videos = [...data.videos].sort(
      (a, b) =>
        (place.get(a.videoId.toString())?.position ?? 1e9) -
        (place.get(b.videoId.toString())?.position ?? 1e9),
    );
    const enrolled = data.enrollments
      .map((e: any) => e.userId.toString())
      .sort((a: string, b: string) =>
        (students.get(a)?.name ?? '').localeCompare(
          students.get(b)?.name ?? '',
        ),
      );
    const rows: Cell[][] = [];
    for (const uid of enrolled) {
      const student = students.get(uid) ?? UNKNOWN_STUDENT;
      for (const video of videos) {
        const vid = video.videoId.toString();
        const watch = data.watchMap.get(`${uid}|${vid}`);
        const feedback = data.feedbackMap.get(`${uid}|${vid}`);
        const form = feedback
          ? formById.get(feedback.feedbackFormId?.toString())
          : undefined;
        const {rawWatchedSeconds, watchPercentage} =
          EnrollmentRepository.watchFigures(watch, video.videoDurationSeconds);
        const answers = new Map(
          form
            ? answerFields(form.fields).map(q => [
                q.title,
                formatAnswer(q, feedback.details),
              ])
            : [],
        );
        const where = place.get(vid);
        rows.push([
          student.name,
          student.email,
          student.cohort,
          where?.moduleName ?? '',
          where?.sectionName ?? '',
          video.videoName,
          video.videoDurationSeconds,
          rawWatchedSeconds,
          watchPercentage,
          watch?.watchSessionCount || 0,
          formatIST(watch?.firstWatchAt),
          formatIST(watch?.lastWatchAt),
          feedback
            ? (form?.name ??
              data.formMap.get(feedback.feedbackFormId?.toString()) ??
              '')
            : '',
          formatIST(feedback?.createdAt),
          ...titles.map(t => answers.get(t) ?? ''),
        ]);
      }
    }
    return {
      name: 'Watch + feedback',
      header: [
        'Student',
        'Email',
        'Cohort',
        'Module',
        'Section',
        'Video',
        'Duration (s)',
        'Watched (s)',
        'Watch %',
        'Sessions',
        'First watched (IST)',
        'Last watched (IST)',
        'Form',
        'Answered (IST)',
        ...titles,
      ],
      rows,
    };
  }

  /** Every feedback form in the version, in course order, with its current responses. */
  async listForms(
    versionId: string,
    cohortIds?: string[],
  ): Promise<
    {
      id: string;
      name: string;
      moduleId: string;
      sectionId: string;
      moduleName: string;
      sectionName: string;
      aboutName: string;
      responses: number;
    }[]
  > {
    const {formPlaces} = await this.structure(versionId);
    const forms = await this.loadForms(formPlaces);
    const placeOf = new Map(formPlaces.map(p => [p.id, p]));
    const counts = await this.feedbackRepo.countCurrentByForm(
      forms.map(f => f.id),
      versionId,
      cohortIds,
    );
    return forms.map(f => ({
      id: f.id,
      name: f.name,
      moduleId: placeOf.get(f.id)?.moduleId ?? '',
      sectionId: placeOf.get(f.id)?.sectionId ?? '',
      moduleName: f.moduleName,
      sectionName: f.sectionName,
      aboutName: f.aboutName,
      responses: counts.get(f.id) ?? 0,
    }));
  }

  /** One form's sheet, for the per-form download. */
  async buildFormExport(
    courseId: string,
    versionId: string,
    formId: string,
    options: {cohortIds?: string[]; history?: History} = {},
  ): Promise<{courseName: string; sheet: SheetSpec}> {
    const history = options.history ?? 'latest';
    const course = await this.courseRepo.read(courseId);
    if (!course) throw new NotFoundError('Course not found');
    const {version, itemNames, formPlaces} = await this.structure(versionId);
    const placeOf = formPlaces.find(f => f.id === formId) ?? {
      id: formId,
      name: 'Feedback',
      moduleName: '',
      sectionName: '',
      aboutName: '',
    };
    const [form] = await this.loadForms([placeOf]);
    const subs = FeedbackExportService.toExportSubmissions(
      await this.feedbackRepo.getSubmissionsForForms(
        [formId],
        versionId,
        options.cohortIds,
      ),
    );
    const enrollments = await this.enrollmentRepo.findEnrollments({
      courseId: {$in: [courseId, new ObjectId(courseId)]},
      courseVersionId: {$in: [versionId, new ObjectId(versionId)]},
      userId: {
        $in: [...new Set(subs.map(s => s.userId))].map(id => new ObjectId(id)),
      },
      isDeleted: {$ne: true},
    });
    const cohortOf = new Map<string, string | undefined>();
    for (const s of subs) cohortOf.set(s.userId, s.cohortId ?? undefined);
    for (const e of enrollments)
      cohortOf.set(
        e.userId.toString(),
        (e as any).cohortId?.toString() ?? cohortOf.get(e.userId.toString()),
      );
    const students = await this.people([...cohortOf.keys()], cohortOf, version);
    return {
      courseName: (course as any).name ?? 'Course',
      sheet: formSheet(form, subs, students, itemNames, history),
    };
  }
}

/** CSV text with a UTF-8 BOM (so Excel reads Indian-language text correctly). */
export function toCsv(sheet: SheetSpec): string {
  const escape = (v: Cell) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [sheet.header, ...sheet.rows].map(r => r.map(escape).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** A file name like "Gurusetu Pilot-feedback-2026-11-10.xlsx", safe for downloads. */
export function exportFileName(
  courseName: string,
  suffix: string,
  ext: string,
  now = new Date(),
): string {
  const day = formatIST(now).slice(0, 10);
  const safe =
    courseName
      .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'course';
  return `${safe}-${suffix}-${day}.${ext}`;
}
