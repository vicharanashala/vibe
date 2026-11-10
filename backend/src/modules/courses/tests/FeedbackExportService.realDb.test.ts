import {describe, it, expect, beforeAll} from 'vitest';
import {ObjectId} from 'mongodb';
import {Container} from 'inversify';
import {sharedContainerModule} from '#root/container.js';
import {usersContainerModule} from '#users/container.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {USERS_TYPES} from '#users/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {ItemRepository} from '#root/shared/database/providers/mongo/repositories/ItemRepository.js';
import {CourseRepository} from '#root/shared/database/providers/mongo/repositories/CourseRepository.js';
import {FeedbackRepository} from '#quizzes/repositories/providers/mongodb/FeedbackRepository.js';
import {FeedbackExportService} from '#courses/services/FeedbackExportService.js';
import {writeXlsx} from '#courses/utils/xlsxWriter.js';
import {readXlsx} from './helpers/readXlsx.js';

/**
 * The course feedback export end to end against mongodb-memory-server: a
 * course with two videos each followed by a form, plus a form first in its
 * section, two students (one in a cohort), watch time and an updated answer.
 */
describe('FeedbackExportService -- real MongoDB', {timeout: 60000}, () => {
  let db: MongoDatabase;
  let service: FeedbackExportService;

  beforeAll(async () => {
    const container = new Container();
    await container.load(sharedContainerModule, usersContainerModule);
    db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();
    // The reads the export uses need only the database; the rest of
    // CourseRepository's dependencies are unrelated to it.
    const courseRepo = new (CourseRepository as any)(db);
    service = new FeedbackExportService(
      courseRepo,
      new ItemRepository(db, courseRepo),
      new FeedbackRepository(db),
      container.get(USERS_TYPES.EnrollmentRepo),
      db,
    );
  });

  async function seed() {
    const tag = new ObjectId().toString();
    const ids = {
      course: new ObjectId(),
      version: new ObjectId(),
      group1: new ObjectId(),
      group2: new ObjectId(),
      v1: new ObjectId(),
      f1: new ObjectId(),
      v2: new ObjectId(),
      f2: new ObjectId(),
      fGeneral: new ObjectId(),
      asha: new ObjectId(),
      ravi: new ObjectId(),
      cohort: new ObjectId(),
    };
    await (
      await db.getCollection('newCourse')
    ).insertOne({_id: ids.course, name: `Gurusetu ${tag}`} as any);
    await (
      await db.getCollection('cohorts')
    ).insertOne({_id: ids.cohort, name: 'Batch A'} as any);
    await (
      await db.getCollection('newCourseVersion')
    ).insertOne({
      _id: ids.version,
      courseId: ids.course,
      cohorts: [ids.cohort],
      modules: [
        {
          moduleId: new ObjectId(),
          name: 'Module 1',
          order: 'a',
          sections: [
            {
              sectionId: new ObjectId(),
              name: 'Basics',
              order: 'a',
              itemsGroupId: ids.group1,
            },
            {
              sectionId: new ObjectId(),
              name: 'Wrap up',
              order: 'b',
              itemsGroupId: ids.group2,
            },
          ],
        },
      ],
    } as any);
    await (
      await db.getCollection('itemsGroup')
    ).insertMany([
      {
        _id: ids.group1,
        items: [
          {_id: ids.v1, type: 'VIDEO', order: 'a', name: 'Intro video'},
          {_id: ids.f1, type: 'FEEDBACK', order: 'b', name: 'Intro feedback'},
          {_id: ids.v2, type: 'VIDEO', order: 'c', name: 'Deep dive'},
          {
            _id: ids.f2,
            type: 'FEEDBACK',
            order: 'd',
            name: 'Deep dive feedback',
          },
        ],
      },
      {
        _id: ids.group2,
        items: [
          {
            _id: ids.fGeneral,
            type: 'FEEDBACK',
            order: 'a',
            name: 'Course feedback',
          },
        ],
      },
    ] as any);
    await (
      await db.getCollection('videos')
    ).insertMany([
      {
        _id: ids.v1,
        name: 'Intro video',
        details: {startTime: '00:00:00', endTime: '00:10:00'},
      },
      {
        _id: ids.v2,
        name: 'Deep dive',
        details: {startTime: '00:00:00', endTime: '00:05:00'},
      },
    ] as any);
    const useful = {
      type: 'string',
      title: 'How useful?',
      oneOf: [
        {const: 'v', title: 'Very useful'},
        {const: 'n', title: 'Not useful'},
      ],
    };
    await (
      await db.getCollection('feedback_forms')
    ).insertMany([
      {
        _id: ids.f1,
        name: 'Intro feedback',
        details: {jsonSchema: {properties: {Useful: useful}}, uiSchema: {}},
      },
      {
        _id: ids.f2,
        name: 'Deep dive feedback',
        details: {jsonSchema: {properties: {Useful: useful}}, uiSchema: {}},
      },
      {
        _id: ids.fGeneral,
        name: 'Course feedback',
        details: {
          jsonSchema: {
            properties: {Comments: {type: 'string', title: 'Any comments?'}},
          },
          uiSchema: {},
        },
      },
    ] as any);
    await (
      await db.getCollection('users')
    ).insertMany([
      {
        _id: ids.asha,
        firebaseUID: `a-${tag}`,
        firstName: 'Asha',
        lastName: 'Rao',
        email: `asha-${tag}@example.com`,
      },
      {
        _id: ids.ravi,
        firebaseUID: `r-${tag}`,
        firstName: 'Ravi',
        lastName: 'Kumar',
        email: `ravi-${tag}@example.com`,
      },
    ] as any);
    await (
      await db.getCollection('enrollment')
    ).insertMany([
      {
        userId: ids.asha,
        courseId: ids.course,
        courseVersionId: ids.version,
        role: 'STUDENT',
        status: 'ACTIVE',
        cohortId: ids.cohort,
        percentCompleted: 75,
      },
      {
        userId: ids.ravi,
        courseId: ids.course,
        courseVersionId: ids.version,
        role: 'STUDENT',
        status: 'ACTIVE',
        percentCompleted: 10,
      },
    ] as any);
    const t = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 1, h, m));
    await (
      await db.getCollection('watchTime')
    ).insertMany([
      {
        userId: ids.asha,
        courseVersionId: ids.version,
        itemId: ids.v1,
        startTime: t(9),
        endTime: t(9, 5),
      },
    ] as any);
    const sub = (
      user: ObjectId,
      form: ObjectId,
      prev: ObjectId | null,
      details: any,
      at: Date,
      cohort?: ObjectId,
    ) => ({
      userId: user,
      courseId: ids.course,
      courseVersionId: ids.version,
      feedbackFormId: form,
      previousItemId: prev,
      previousItemType: prev ? 'VIDEO' : null,
      details,
      createdAt: at,
      updatedAt: at,
      ...(cohort ? {cohortId: cohort} : {}),
    });
    await (
      await db.getCollection('feedback_submission')
    ).insertMany([
      sub(ids.asha, ids.f1, ids.v1, {Useful: 'n'}, t(9, 6), ids.cohort),
      sub(ids.asha, ids.f1, ids.v1, {Useful: 'v'}, t(9, 30), ids.cohort),
      sub(ids.ravi, ids.fGeneral, null, {Comments: 'Great'}, t(11)),
    ] as any);
    return {ids, tag};
  }

  it('builds Overview, a sheet per form and Watch + feedback', async () => {
    const {ids, tag} = await seed();
    const data = await service.buildCourseExport(
      ids.course.toString(),
      ids.version.toString(),
    );
    expect(data.courseName).toBe(`Gurusetu ${tag}`);
    expect(data.sheets.map(s => s.name)).toEqual([
      'Overview',
      'Intro feedback',
      'Deep dive feedback',
      'Course feedback',
      'Watch + feedback',
    ]);
    const [overview, intro, , general, watch] = data.sheets;
    expect(overview.rows).toEqual([
      [
        'Asha Rao',
        `asha-${tag}@example.com`,
        'Batch A',
        75,
        1,
        3,
        '2026-11-01 15:00',
      ],
      [
        'Ravi Kumar',
        `ravi-${tag}@example.com`,
        '',
        10,
        1,
        3,
        '2026-11-01 16:30',
      ],
    ]);
    // Latest answer only, with account name, cohort, place and about-lesson.
    expect(intro.rows).toEqual([
      [
        'Asha Rao',
        `asha-${tag}@example.com`,
        'Batch A',
        'Module 1',
        'Basics',
        'Intro feedback',
        'Intro video',
        '2026-11-01 15:00',
        '2026-11-01T09:30:00.000Z',
        'Very useful',
      ],
    ]);
    expect(general.rows[0].slice(4, 7)).toEqual([
      'Wrap up',
      'Course feedback',
      '',
    ]);
    expect(watch.header.slice(0, 14)).toEqual([
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
    ]);
    const ashaIntro = watch.rows.find(
      r => r[0] === 'Asha Rao' && r[5] === 'Intro video',
    )!;
    expect(ashaIntro.slice(6, 14)).toEqual([
      600,
      300,
      50,
      1,
      '2026-11-01 14:30',
      '2026-11-01 14:30',
      'Intro feedback',
      '2026-11-01 15:00',
    ]);
    expect(ashaIntro[watch.header.indexOf('How useful?')]).toBe('Very useful');
    expect(watch.rows.map(r => [r[0], r[5]])).toEqual([
      ['Asha Rao', 'Intro video'],
      ['Asha Rao', 'Deep dive'],
      ['Ravi Kumar', 'Intro video'],
      ['Ravi Kumar', 'Deep dive'],
    ]);
  });

  it('includes replaced answers on request and limits to a cohort', async () => {
    const {ids} = await seed();
    const all = await service.buildCourseExport(
      ids.course.toString(),
      ids.version.toString(),
      {history: 'all'},
    );
    expect(all.sheets[1].rows.map(r => r[9])).toEqual(['Current', 'Replaced']);
    const cohort = await service.buildCourseExport(
      ids.course.toString(),
      ids.version.toString(),
      {
        cohortIds: [ids.cohort.toString()],
      },
    );
    expect(cohort.sheets[0].rows.map(r => r[0])).toEqual(['Asha Rao']);
    expect(cohort.sheets[3].rows).toEqual([]);
    expect(cohort.allAnswers.rows.map(r => r[5])).toEqual(['Intro feedback']);
  });

  it('lists every form in course order with its current responses', async () => {
    const {ids} = await seed();
    const forms = await service.listForms(ids.version.toString());
    expect(
      forms.map(f => [
        f.name,
        f.moduleName,
        f.sectionName,
        f.aboutName,
        f.responses,
      ]),
    ).toEqual([
      ['Intro feedback', 'Module 1', 'Basics', 'Intro video', 1],
      ['Deep dive feedback', 'Module 1', 'Basics', 'Deep dive', 0],
      ['Course feedback', 'Module 1', 'Wrap up', '', 1],
    ]);
    const cohort = await service.listForms(ids.version.toString(), [
      ids.cohort.toString(),
    ]);
    expect(cohort.map(f => f.responses)).toEqual([1, 0, 0]);
  });

  it('exports one form and the workbook reads back', async () => {
    const {ids, tag} = await seed();
    const {sheet} = await service.buildFormExport(
      ids.course.toString(),
      ids.version.toString(),
      ids.f1.toString(),
    );
    expect(sheet.rows).toHaveLength(1);
    const {names, sheets} = readXlsx(await writeXlsx([sheet]));
    expect(names).toEqual(['Intro feedback']);
    expect(sheets[0][1][1]).toBe(`asha-${tag}@example.com`);
  });
});
