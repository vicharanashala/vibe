import {describe, it, expect} from 'vitest';
import {
  buildQuestionBankCsv,
  buildQuestionExportRow,
  QuestionExportContext,
} from '../utils/functions/questionBankCsv.js';

const ctx = (n = 1): QuestionExportContext => ({
  moduleName: 'Module 1',
  sectionName: 'Intro',
  quizName: 'Quiz 1',
  bankTitle: 'Bank',
  questionNumber: n,
});

// Minimal RFC 4180 parser: quoted fields may contain commas, quotes and newlines.
function parseCsv(csv: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const text = csv.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

describe('question bank CSV export', () => {
  it('exports a single-correct question in the quiz CSV import format', () => {
    const csv = buildQuestionBankCsv([
      buildQuestionExportRow(
        {
          _id: 'q1',
          type: 'SELECT_ONE_IN_LOT',
          text: 'What is AI, "really"?',
          hint: 'Think broadly',
          bloomLevel: 'knowledge',
          points: 1,
          incorrectLotItems: [
            {text: 'A toaster', explaination: 'No, that is an appliance.'},
            {text: 'Magic', explaination: 'No.'},
            {text: 'A database, only', explaination: 'Too narrow.'},
          ],
          correctLotItem: {
            text: 'Machines doing tasks that need intelligence',
            explaination: 'Standard definition.\nSee lecture 1.',
          },
        },
        ctx(),
      ),
    ]);

    expect(csv.startsWith('﻿')).toBe(true);
    const [row] = parseCsv(csv);
    expect(row['Question']).toBe('What is AI, "really"?');
    expect(row['Option A']).toBe('A toaster');
    expect(row['Option D']).toBe('Machines doing tasks that need intelligence');
    expect(row['Correct Answer']).toBe('D');
    expect(row['Correct Answer Text']).toBe(
      'Machines doing tasks that need intelligence',
    );
    expect(row['Explanation']).toBe('Standard definition.\nSee lecture 1.');
    expect(row['Expln-A']).toBe('No, that is an appliance.');
    expect(row['Hint']).toBe('Think broadly');
    expect(row['Question Type']).toBe('Single correct (MCQ)');
    expect(row['Module']).toBe('Module 1');
    expect(row['Question ID']).toBe('q1');
  });

  it('widens option columns to the largest question and lists multiple correct answers', () => {
    const csv = buildQuestionBankCsv([
      buildQuestionExportRow(
        {
          _id: 'q2',
          type: 'SELECT_MANY_IN_LOT',
          text: 'Pick the ML methods',
          incorrectLotItems: [
            {text: 'Sorting', explaination: 'Algorithm, not learning.'},
            {text: 'Hashing', explaination: 'Not learning.'},
            {text: 'Compiling', explaination: 'Not learning.'},
          ],
          correctLotItems: [
            {text: 'Regression', explaination: 'Supervised.'},
            {text: 'Clustering', explaination: 'Unsupervised.'},
          ],
        },
        ctx(),
      ),
    ]);
    const [row] = parseCsv(csv);
    expect(row['Option E']).toBe('Clustering');
    expect(row['Correct Answer']).toBe('D, E');
    expect(row['Correct Answer Text']).toBe('D) Regression\nE) Clustering');
    expect(row['Explanation']).toBe('D) Supervised.\nE) Unsupervised.');
  });

  it('describes ordering, numeric and descriptive answers', () => {
    const rows = parseCsv(
      buildQuestionBankCsv([
        buildQuestionExportRow(
          {
            _id: 'q3',
            type: 'ORDER_THE_LOTS',
            text: 'Order the pipeline',
            ordering: [
              {lotItem: {text: 'Train', explaination: ''}, order: 2},
              {lotItem: {text: 'Collect data', explaination: ''}, order: 1},
              {lotItem: {text: 'Evaluate', explaination: ''}, order: 3},
            ],
          },
          ctx(1),
        ),
        buildQuestionExportRow(
          {
            _id: 'q4',
            type: 'NUMERIC_ANSWER_TYPE',
            text: 'How many layers?',
            value: 3,
            lowerLimit: 3,
            upperLimit: 3,
            decimalPrecision: 0,
          },
          ctx(2),
        ),
        buildQuestionExportRow(
          {
            _id: 'q5',
            type: 'DESCRIPTIVE',
            text: 'Explain overfitting',
            solutionText: 'Model memorises training data.',
          },
          ctx(3),
        ),
      ]),
    );

    expect(rows[0]['Correct Answer']).toBe('B → A → C');
    expect(rows[0]['Correct Answer Text']).toBe('Collect data → Train → Evaluate');
    expect(rows[1]['Correct Answer']).toBe('3');
    expect(rows[1]['Correct Answer Text']).toBe(
      '3; accepted range 3 to 3; 0 decimal places',
    );
    expect(rows[1]['Option A']).toBe('');
    expect(rows[2]['Correct Answer Text']).toBe('Model memorises training data.');
    expect(rows.map(r => r['Q No.'])).toEqual(['1', '2', '3']);
  });

  it('produces a header-only CSV for a course with no quizzes', () => {
    const rows = parseCsv(buildQuestionBankCsv([]));
    expect(rows).toEqual([]);
  });
});
