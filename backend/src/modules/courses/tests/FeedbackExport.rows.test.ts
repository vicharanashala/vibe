import {describe, it, expect} from 'vitest';
import {
  parseFeedbackFields,
  formatAnswer,
  summarizeAnswers,
} from '#courses/utils/feedbackFormFields.js';
import {
  allAnswersSheet,
  exportFileName,
  formSheet,
  formatIST,
  overviewSheet,
  toCsv,
  type ExportForm,
  type ExportSubmission,
} from '#courses/services/FeedbackExportService.js';
import {
  columnName,
  safeSheetNames,
  writeXlsx,
} from '#courses/utils/xlsxWriter.js';
import {readXlsx} from './helpers/readXlsx.js';

// A form using every kind the builders write, including the new ones.
const jsonSchema = {
  properties: {
    Intro: {type: 'null', title: 'About the lesson'},
    Useful: {
      type: 'string',
      title: 'How useful was it?',
      oneOf: [
        {const: 'v', title: 'Very useful'},
        {const: 'n', title: 'Not useful'},
      ],
    },
    Topics: {
      type: 'array',
      title: 'Which topics helped?',
      items: {type: 'string', enum: ['Arrays', 'Loops', 'Other']},
    },
    'Topics (other)': {type: 'string'},
    Scale: {type: 'integer', title: 'Pace', minimum: 1, maximum: 5},
    Stars: {
      type: 'string',
      title: 'Rating',
      oneOf: ['1', '2', '3'].map(v => ({const: v, title: v})),
    },
    Recommend: {type: 'boolean', title: 'Would you recommend it?'},
    Year: {type: 'string', title: 'Year of study'},
    old_enum: {type: 'string', enum: ['very_good', 'poor']},
  },
};
const uiSchema = {
  'ui:order': [
    'Intro',
    'Useful',
    'Topics',
    'Topics (other)',
    'Scale',
    'Stars',
    'Recommend',
    'Year',
    'old_enum',
  ],
  'Topics (other)': {'ui:options': {otherFor: 'Topics'}},
  Scale: {
    'ui:widget': 'radio',
    'ui:options': {
      display: 'scale',
      minLabel: 'Too slow',
      maxLabel: 'Too fast',
    },
  },
  Stars: {'ui:widget': 'radio', 'ui:options': {display: 'rating'}},
};
const fields = parseFeedbackFields(jsonSchema, uiSchema);

describe('parseFeedbackFields', () => {
  it('reads every kind in form order, folding "Other" text into its question', () => {
    expect(fields.map(f => [f.key, f.kind])).toEqual([
      ['Intro', 'heading'],
      ['Useful', 'choice'],
      ['Topics', 'multi'],
      ['Scale', 'scale'],
      ['Stars', 'rating'],
      ['Recommend', 'boolean'],
      ['Year', 'text'],
      ['old_enum', 'choice'],
    ]);
    expect(fields[2].otherKey).toBe('Topics (other)');
    expect(fields[3]).toMatchObject({
      min: 1,
      max: 5,
      minLabel: 'Too slow',
      maxLabel: 'Too fast',
    });
  });

  it('formats answers for people', () => {
    const details = {
      Useful: 'v',
      Topics: ['Arrays', 'Other'],
      'Topics (other)': ' Recursion ',
      Scale: 4,
      Stars: '3',
      Recommend: true,
      Year: '2nd',
      old_enum: 'very_good',
    };
    const by = Object.fromEntries(
      fields.map(f => [f.key, formatAnswer(f, details)]),
    );
    expect(by).toMatchObject({
      Intro: '',
      Useful: 'Very useful',
      Topics: 'Arrays; Other: Recursion',
      Scale: 4,
      Stars: 3,
      Recommend: 'Yes',
      Year: '2nd',
      old_enum: 'Very Good',
    });
  });

  it('summarises counts, averages and Other texts', () => {
    const summary = summarizeAnswers(fields, [
      {Useful: 'v', Topics: ['Other'], 'Topics (other)': 'Recursion', Scale: 5},
      {Useful: 'n', Topics: ['Arrays', 'Loops'], Scale: 3},
    ]);
    const by = Object.fromEntries(summary.map(q => [q.key, q]));
    expect(by.Useful.counts).toEqual({'Very useful': 1, 'Not useful': 1});
    expect(by.Topics.counts).toMatchObject({Arrays: 1, Loops: 1, Other: 1});
    expect(by.Topics.latestTexts).toEqual(['Recursion']);
    expect(by.Scale.average).toBe(4);
    expect(by.Scale.counts).toMatchObject({'1': 0, '3': 1, '5': 1});
    expect(summary.find(q => q.key === 'Intro')).toBeUndefined();
  });
});

const form: ExportForm = {
  id: 'form1',
  name: 'Lesson 1 feedback',
  moduleName: 'Module 1',
  sectionName: 'Basics',
  aboutName: 'Intro video',
  fields,
};
const students = new Map([
  ['u1', {name: 'Asha Rao', email: 'asha@example.com', cohort: 'Batch A'}],
  ['u2', {name: 'Ravi Kumar', email: 'ravi@example.com', cohort: ''}],
]);
const itemNames = new Map([['vid1', 'Intro video (renamed)']]);
const subs: ExportSubmission[] = [
  {
    userId: 'u1',
    feedbackFormId: 'form1',
    previousItemId: 'vid1',
    details: {Useful: 'n'},
    createdAt: new Date('2026-11-01T09:00:00Z'),
    isCurrentVersion: false,
  },
  {
    userId: 'u1',
    feedbackFormId: 'form1',
    previousItemId: 'vid1',
    details: {Useful: 'v', Topics: ['Loops']},
    createdAt: new Date('2026-11-02T10:05:00Z'),
    isCurrentVersion: true,
  },
  {
    userId: 'u2',
    feedbackFormId: 'form1',
    previousItemId: null,
    details: {Year: '1st'},
    createdAt: new Date('2026-11-01T12:00:00Z'),
    isCurrentVersion: true,
  },
];

describe('formSheet', () => {
  it('has the fixed columns, then each question titled by its text', () => {
    const sheet = formSheet(form, subs, students, itemNames, 'latest');
    expect(sheet.header).toEqual([
      'Student',
      'Email',
      'Cohort',
      'Module',
      'Section',
      'Form',
      'About lesson',
      'Submitted (IST)',
      'Submitted (ISO)',
      'How useful was it?',
      'Which topics helped?',
      'Pace',
      'Rating',
      'Would you recommend it?',
      'Year of study',
      'old_enum',
    ]);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0].slice(0, 10)).toEqual([
      'Asha Rao',
      'asha@example.com',
      'Batch A',
      'Module 1',
      'Basics',
      'Lesson 1 feedback',
      'Intro video (renamed)',
      '2026-11-02 15:35',
      '2026-11-02T10:05:00.000Z',
      'Very useful',
    ]);
    // A general form (first in its section) is about no lesson.
    expect(sheet.rows[1][6]).toBe('');
  });

  it('includes replaced answers with a Version column on request', () => {
    const sheet = formSheet(form, subs, students, itemNames, 'all');
    expect(sheet.header[9]).toBe('Version');
    expect(sheet.rows.map(r => [r[0], r[9]])).toEqual([
      ['Asha Rao', 'Current'],
      ['Ravi Kumar', 'Current'],
      ['Asha Rao', 'Replaced'],
    ]);
  });
});

describe('course sheets', () => {
  const other: ExportForm = {
    ...form,
    id: 'form2',
    name: 'Lesson 2 feedback',
    fields: parseFeedbackFields(
      {properties: {'Year of study': {type: 'string'}}},
      {},
    ),
  };
  it('puts every answer in one table, sharing columns with the same question text', () => {
    const sheet = allAnswersSheet(
      [form, other],
      new Map([
        ['form1', subs],
        [
          'form2',
          [
            {
              userId: 'u2',
              feedbackFormId: 'form2',
              details: {'Year of study': '3rd'},
              createdAt: new Date('2026-11-03T00:00:00Z'),
              isCurrentVersion: true,
            },
          ],
        ],
      ]),
      students,
      itemNames,
      'latest',
    );
    const year = sheet.header.indexOf('Year of study');
    expect(sheet.header.filter(h => h === 'Year of study')).toHaveLength(1);
    expect(sheet.rows.map(r => [r[5], r[year]])).toEqual([
      ['Lesson 1 feedback', ''],
      ['Lesson 1 feedback', '1st'],
      ['Lesson 2 feedback', '3rd'],
    ]);
  });

  it('lists every enrolled student on Overview, including those who answered nothing', () => {
    const sheet = overviewSheet(
      [
        {
          userId: 'u2',
          name: 'Ravi Kumar',
          email: 'ravi@example.com',
          cohort: '',
          progress: 40,
        },
        {
          userId: 'u3',
          name: 'Zara',
          email: 'z@example.com',
          cohort: '',
          progress: null,
        },
        {
          userId: 'u1',
          name: 'Asha Rao',
          email: 'asha@example.com',
          cohort: 'Batch A',
          progress: 100,
        },
      ],
      [form, other],
      subs.filter(s => s.isCurrentVersion),
    );
    expect(sheet.rows).toEqual([
      [
        'Asha Rao',
        'asha@example.com',
        'Batch A',
        100,
        1,
        2,
        '2026-11-02 15:35',
      ],
      ['Ravi Kumar', 'ravi@example.com', '', 40, 1, 2, '2026-11-01 17:30'],
      ['Zara', 'z@example.com', '', '', 0, 2, ''],
    ]);
  });
});

describe('files', () => {
  it('writes CSV with a BOM and quoting', () => {
    const csv = toCsv({
      name: 'x',
      header: ['A', 'B'],
      rows: [
        ['say "hi", ok', 3],
        ['हिंदी', ''],
      ],
    });
    expect(csv).toBe('﻿A,B\r\n"say ""hi"", ok",3\r\nहिंदी,\r\n');
  });

  it('writes a workbook that reads back with the same sheets, headers and values', async () => {
    const sheet = formSheet(form, subs, students, itemNames, 'latest');
    const buf = await writeXlsx([
      sheet,
      {name: 'Lesson 1 feedback', header: ['A'], rows: [['dup <&> name']]},
    ]);
    const {names, sheets, files} = readXlsx(buf);
    expect(names).toEqual(['Lesson 1 feedback', 'Lesson 1 feedback (2)']);
    expect(sheets[0][0]).toEqual(sheet.header);
    expect(sheets[0][1].slice(0, 10)).toEqual(sheet.rows[0].slice(0, 10));
    expect(sheets[1][1]).toEqual(['dup <&> name']);
    const xml = files.get('xl/worksheets/sheet1.xml')!.toString();
    expect(xml).toContain('state="frozen"');
    expect(xml).toContain('<autoFilter ref="A1:P3"/>');
  });

  it('cleans sheet names and names files by course and date', () => {
    expect(
      safeSheetNames(['a/b:c', 'x'.repeat(40), 'x'.repeat(40), '']),
    ).toEqual(['a b c', 'x'.repeat(31), 'x'.repeat(27) + ' (2)', 'Sheet']);
    expect(columnName(0)).toBe('A');
    expect(columnName(27)).toBe('AB');
    expect(
      exportFileName(
        'Guru: Setu/Pilot',
        'feedback',
        'xlsx',
        new Date('2026-11-10T20:00:00Z'),
      ),
    ).toBe('Guru Setu Pilot-feedback-2026-11-11.xlsx');
    expect(formatIST('2026-11-10T18:45:00Z')).toBe('2026-11-11 00:15');
  });
});
