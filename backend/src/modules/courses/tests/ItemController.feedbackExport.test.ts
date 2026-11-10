import {describe, it, expect, vi} from 'vitest';
import {ForbiddenError} from 'routing-controllers';
import {ObjectId} from 'mongodb';
import {ItemController} from '#courses/controllers/ItemController.js';
import {readXlsx} from './helpers/readXlsx.js';

const COURSE = new ObjectId().toString();
const VERSION = new ObjectId().toString();
const FORM = new ObjectId().toString();
const COHORT = '6af000000000000000000001';

const sheet = {
  name: 'Intro feedback',
  header: ['Student', 'How useful?'],
  rows: [['Asha Rao', 'Very useful']],
};

function setup(staff = true) {
  const c: any = Object.create(ItemController.prototype);
  c.itemService = {findItemVersionId: async () => VERSION};
  c.cohortScopeService = {
    resolve: vi.fn(() => ({cohortIds: [new ObjectId(COHORT)]})),
  };
  c.feedbackExportService = {
    buildCourseExport: vi.fn(async () => ({
      courseName: 'Gurusetu: Pilot',
      sheets: [
        {name: 'Overview', header: ['Student'], rows: [['Asha Rao']]},
        sheet,
      ],
      allAnswers: {
        name: 'All answers',
        header: ['Student', 'Form'],
        rows: [['Asha Rao', 'Intro feedback']],
      },
      watch: {
        name: 'Watch + feedback',
        header: ['Student', 'Video'],
        rows: [['Asha Rao', 'Intro']],
      },
    })),
    buildFormExport: vi.fn(async () => ({courseName: 'Gurusetu', sheet})),
  };
  const res: any = {headers: {} as Record<string, string>, body: undefined};
  res.setHeader = (k: string, v: string) => (res.headers[k] = v);
  res.send = (b: unknown) => ((res.body = b), res);
  return {c, res, who: {ability: {can: () => staff}, authenticatedUser: {}}};
}

describe('course feedback export route', () => {
  it('refuses students', async () => {
    const {c, res, who} = setup(false);
    await expect(
      c.exportCourseFeedback(
        {courseId: COURSE, versionId: VERSION},
        {},
        who,
        res,
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it('sends a workbook named after the course, within the caller’s cohorts', async () => {
    const {c, res, who} = setup();
    await c.exportCourseFeedback(
      {courseId: COURSE, versionId: VERSION},
      {history: 'all'},
      who,
      res,
    );
    expect(c.feedbackExportService.buildCourseExport).toHaveBeenCalledWith(
      COURSE,
      VERSION,
      {cohortIds: [COHORT], history: 'all'},
    );
    expect(res.headers['Content-Type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['Content-Disposition']).toMatch(
      /^attachment; filename="Gurusetu Pilot-feedback-\d{4}-\d{2}-\d{2}\.xlsx"/,
    );
    expect(readXlsx(res.body).names).toEqual(['Overview', 'Intro feedback']);
  });

  it('sends every answer, or the watch rows, as CSV', async () => {
    const {c, res, who} = setup();
    await c.exportCourseFeedback(
      {courseId: COURSE, versionId: VERSION},
      {format: 'csv'},
      who,
      res,
    );
    expect(res.body).toBe('﻿Student,Form\r\nAsha Rao,Intro feedback\r\n');
    expect(res.headers['Content-Disposition']).toMatch(
      /-feedback-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    await c.exportCourseFeedback(
      {courseId: COURSE, versionId: VERSION},
      {format: 'csv', type: 'watch'},
      who,
      res,
    );
    expect(res.body).toBe('﻿Student,Video\r\nAsha Rao,Intro\r\n');
    expect(res.headers['Content-Disposition']).toMatch(/-watch-feedback-/);
  });
});

describe('course feedback forms list', () => {
  it('lists forms for staff, within their cohorts, and refuses students', async () => {
    const {c, who} = setup();
    c.feedbackExportService.listForms = vi.fn(async () => [
      {id: FORM, name: 'Intro feedback', responses: 3},
    ]);
    expect(
      await c.listFeedbackForms(
        {courseId: COURSE, versionId: VERSION},
        {},
        who,
      ),
    ).toEqual({
      forms: [{id: FORM, name: 'Intro feedback', responses: 3}],
    });
    expect(c.feedbackExportService.listForms).toHaveBeenCalledWith(VERSION, [
      COHORT,
    ]);
    const student = setup(false);
    await expect(
      student.c.listFeedbackForms(
        {courseId: COURSE, versionId: VERSION},
        {},
        student.who,
      ),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe('per-form export routes', () => {
  it('refuses students', async () => {
    const {c, res, who} = setup(false);
    await expect(
      c.exportFeedbackForm({courseId: COURSE, feedbackId: FORM}, {}, who, res),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      c.exportFeedbackSubmissions(
        {courseId: COURSE, feedbackId: FORM},
        who,
        res,
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it('the old CSV route now returns the rich per-form CSV', async () => {
    const {c, res, who} = setup();
    await c.exportFeedbackSubmissions(
      {courseId: COURSE, feedbackId: FORM},
      who,
      res,
    );
    expect(c.feedbackExportService.buildFormExport).toHaveBeenCalledWith(
      COURSE,
      VERSION,
      FORM,
      {cohortIds: [COHORT], history: undefined},
    );
    expect(res.body).toBe('﻿Student,How useful?\r\nAsha Rao,Very useful\r\n');
    expect(res.headers['Content-Type']).toBe('text/csv; charset=utf-8');
  });

  it('sends one form as a workbook', async () => {
    const {c, res, who} = setup();
    await c.exportFeedbackForm(
      {courseId: COURSE, feedbackId: FORM},
      {format: 'xlsx', history: 'all'},
      who,
      res,
    );
    expect(readXlsx(res.body).sheets[0]).toEqual([sheet.header, sheet.rows[0]]);
    expect(res.headers['Content-Disposition']).toMatch(
      /Gurusetu Intro feedback-responses-/,
    );
  });
});
