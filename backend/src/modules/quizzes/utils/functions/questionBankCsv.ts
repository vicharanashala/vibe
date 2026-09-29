import {createObjectCsvStringifier} from 'csv-writer';

/**
 * Builds the instructor-facing "question bank review" CSV for a course
 * version: one row per question, in course order (module → section → quiz →
 * bank → question).
 *
 * Column names deliberately reuse the quiz CSV import format (Question, Hint,
 * Option A–D, Expln-A–D, Correct Answer as a letter) so an exported
 * single-answer quiz can be edited and uploaded back through "Upload CSV".
 */

export interface QuestionExportContext {
  moduleName: string;
  sectionName: string;
  quizName: string;
  bankTitle: string;
  questionNumber: number;
}

interface ExportLotItem {
  text?: string;
  explaination?: string;
}

interface ExportRow {
  context: QuestionExportContext;
  questionId: string;
  question: string;
  hint: string;
  type: string;
  bloomLevel: string;
  points: string;
  source: string;
  reviewStatus: string;
  options: ExportLotItem[];
  correctAnswer: string;
  correctAnswerText: string;
  explanation: string;
}

const TYPE_LABELS: Record<string, string> = {
  SELECT_ONE_IN_LOT: 'Single correct (MCQ)',
  SELECT_MANY_IN_LOT: 'Multiple correct',
  ORDER_THE_LOTS: 'Ordering',
  NUMERIC_ANSWER_TYPE: 'Numeric',
  DESCRIPTIVE: 'Descriptive',
};

// The import format has exactly four options, so always emit at least A–D.
const MIN_OPTION_COLUMNS = 4;

export function optionLetter(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

function str(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function lettered(items: {letter: string; text: string}[]): string {
  return items
    .filter(i => i.text.trim().length > 0)
    .map(i => (items.length > 1 ? `${i.letter}) ${i.text}` : i.text))
    .join('\n');
}

export function buildQuestionExportRow(
  question: any,
  context: QuestionExportContext,
): ExportRow {
  let options: ExportLotItem[] = [];
  let correctAnswer = '';
  let correctAnswerText = '';
  let explanation = '';

  switch (question.type) {
    case 'SELECT_ONE_IN_LOT': {
      // Same order as the quiz editor: incorrect options, then the correct one.
      const incorrect: ExportLotItem[] = question.incorrectLotItems ?? [];
      const correct: ExportLotItem | undefined = question.correctLotItem;
      options = correct ? [...incorrect, correct] : [...incorrect];
      if (correct) {
        correctAnswer = optionLetter(options.length - 1);
        correctAnswerText = str(correct.text);
        explanation = str(correct.explaination);
      }
      break;
    }
    case 'SELECT_MANY_IN_LOT': {
      const incorrect: ExportLotItem[] = question.incorrectLotItems ?? [];
      const correct: ExportLotItem[] = question.correctLotItems ?? [];
      options = [...incorrect, ...correct];
      const correctLetters = correct.map((item, i) => ({
        letter: optionLetter(incorrect.length + i),
        item,
      }));
      correctAnswer = correctLetters.map(c => c.letter).join(', ');
      correctAnswerText = lettered(
        correctLetters.map(c => ({letter: c.letter, text: str(c.item.text)})),
      );
      explanation = lettered(
        correctLetters.map(c => ({
          letter: c.letter,
          text: str(c.item.explaination),
        })),
      );
      break;
    }
    case 'ORDER_THE_LOTS': {
      const ordering: {lotItem: ExportLotItem; order: number}[] =
        question.ordering ?? [];
      options = ordering.map(o => o.lotItem ?? {});
      const sequence = ordering
        .map((o, i) => ({letter: optionLetter(i), order: o.order, item: o.lotItem}))
        .sort((a, b) => a.order - b.order);
      correctAnswer = sequence.map(s => s.letter).join(' → ');
      correctAnswerText = sequence.map(s => str(s.item?.text)).join(' → ');
      break;
    }
    case 'NUMERIC_ANSWER_TYPE': {
      const answer =
        question.value !== undefined && question.value !== null
          ? str(question.value)
          : str(question.expression);
      const range =
        question.lowerLimit !== undefined || question.upperLimit !== undefined
          ? `accepted range ${str(question.lowerLimit)} to ${str(question.upperLimit)}`
          : '';
      const precision =
        question.decimalPrecision !== undefined
          ? `${question.decimalPrecision} decimal places`
          : '';
      correctAnswer = answer;
      correctAnswerText = [answer, range, precision].filter(Boolean).join('; ');
      break;
    }
    case 'DESCRIPTIVE': {
      correctAnswerText = str(question.solutionText);
      correctAnswer = correctAnswerText;
      break;
    }
  }

  return {
    context,
    questionId: str(question._id),
    question: str(question.text),
    hint: str(question.hint),
    type: TYPE_LABELS[question.type] ?? str(question.type),
    bloomLevel: str(question.bloomLevel),
    points: str(question.points),
    source: str(question.source),
    reviewStatus: str(question.reviewStatus),
    options,
    correctAnswer,
    correctAnswerText,
    explanation,
  };
}

export function buildQuestionBankCsv(rows: ExportRow[]): string {
  const optionCount = Math.max(
    MIN_OPTION_COLUMNS,
    ...rows.map(r => r.options.length),
  );
  const letters = Array.from({length: optionCount}, (_, i) => optionLetter(i));

  const header = [
    {id: 'module', title: 'Module'},
    {id: 'section', title: 'Section'},
    {id: 'quiz', title: 'Quiz'},
    {id: 'questionNumber', title: 'Q No.'},
    {id: 'question', title: 'Question'},
    ...letters.map(l => ({id: `option${l}`, title: `Option ${l}`})),
    {id: 'correctAnswer', title: 'Correct Answer'},
    {id: 'correctAnswerText', title: 'Correct Answer Text'},
    {id: 'explanation', title: 'Explanation'},
    ...letters.map(l => ({id: `expln${l}`, title: `Expln-${l}`})),
    {id: 'hint', title: 'Hint'},
    {id: 'type', title: 'Question Type'},
    {id: 'bloomLevel', title: 'Bloom Level'},
    {id: 'points', title: 'Points'},
    {id: 'source', title: 'Source'},
    {id: 'reviewStatus', title: 'Review Status'},
    {id: 'bank', title: 'Question Bank'},
    {id: 'questionId', title: 'Question ID'},
  ];

  const records = rows.map(r => {
    const record: Record<string, string> = {
      module: r.context.moduleName,
      section: r.context.sectionName,
      quiz: r.context.quizName,
      questionNumber: String(r.context.questionNumber),
      question: r.question,
      correctAnswer: r.correctAnswer,
      correctAnswerText: r.correctAnswerText,
      explanation: r.explanation,
      hint: r.hint,
      type: r.type,
      bloomLevel: r.bloomLevel,
      points: r.points,
      source: r.source,
      reviewStatus: r.reviewStatus,
      bank: r.context.bankTitle,
      questionId: r.questionId,
    };
    letters.forEach((l, i) => {
      record[`option${l}`] = str(r.options[i]?.text);
      record[`expln${l}`] = str(r.options[i]?.explaination);
    });
    return record;
  });

  const stringifier = createObjectCsvStringifier({header});
  // BOM so Excel opens non-ASCII text (Hindi, symbols, LaTeX) as UTF-8.
  // stringifyRecords([]) returns "\n", which would add a blank row.
  return (
    '﻿' +
    stringifier.getHeaderString() +
    (records.length ? stringifier.stringifyRecords(records) : '')
  );
}
