/**
 * Reads a feedback form's stored schema ({jsonSchema, uiSchema}, the rjsf
 * shape both web apps write) into an ordered list of questions, and formats
 * answers for people: choice labels instead of stored values, multiple choices
 * joined by "; ", and "Other: <text>" for an Other choice with its text.
 *
 * Encodings understood (see v3 features/feedback/form-schema.ts):
 * - order: uiSchema['ui:order'], then any remaining properties
 * - choices: oneOf [{const, title}] (or enum for older forms)
 * - checkboxes: type 'array' with items.enum
 * - rating: radio over "1".."N" with ui:options.display = 'rating'
 * - linear scale: integer with ui:options.display = 'scale' (+ minLabel/maxLabel)
 * - section heading: type 'null' (no answer)
 * - "Other (please specify)": a sibling string property whose
 *   ui:options.otherFor names the choice question it belongs to
 */

export type FeedbackFieldKind =
  | 'heading'
  | 'choice'
  | 'multi'
  | 'rating'
  | 'scale'
  | 'number'
  | 'boolean'
  | 'text';

export interface FeedbackField {
  /** The property key answers are stored under. */
  key: string;
  /** The question as students see it now (title, falling back to the key). */
  title: string;
  kind: FeedbackFieldKind;
  /** Stored value -> label, for choices. */
  labels: Record<string, string>;
  /** Choices in form order (labels), for summaries. */
  options: string[];
  /** Key of the "Other (please specify)" text answer, when the question has one. */
  otherKey?: string;
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
}

export const OTHER_OPTION = 'Other';

type Schema = {properties?: Record<string, any>; required?: string[]};
type Ui = Record<string, any>;

/** Old builder: enum-only values like "very_good" read as "Very Good". */
function prettyEnum(value: string): string {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function parseFeedbackFields(
  jsonSchema: Schema | undefined | null,
  uiSchema: Ui | undefined | null,
): FeedbackField[] {
  const props = jsonSchema?.properties ?? {};
  const ui = uiSchema ?? {};
  const order: string[] = Array.isArray(ui['ui:order'])
    ? ui['ui:order'].filter((k: string) => k in props)
    : [];
  const names = [
    ...order,
    ...Object.keys(props).filter(k => !order.includes(k)),
  ];

  // "Other" text properties belong to their choice question, not a column of their own.
  const otherFor: Record<string, string> = {};
  for (const name of names) {
    const target = ui[name]?.['ui:options']?.otherFor;
    if (typeof target === 'string' && target in props) otherFor[target] = name;
  }
  const otherKeys = new Set(Object.values(otherFor));

  const fields: FeedbackField[] = [];
  for (const key of names) {
    if (otherKeys.has(key)) continue;
    const p = props[key] ?? {};
    const options = ui[key]?.['ui:options'] ?? {};
    const display = options.display;
    const title = String(p.title ?? key);
    const labels: Record<string, string> = {};
    let choiceOrder: string[] = [];

    if (Array.isArray(p.oneOf) && p.oneOf.length) {
      for (const o of p.oneOf)
        labels[String(o.const)] = String(o.title ?? o.const);
      choiceOrder = p.oneOf.map((o: any) => String(o.title ?? o.const));
    } else if (Array.isArray(p.enum) && p.enum.length) {
      for (const v of p.enum) labels[String(v)] = prettyEnum(String(v));
      choiceOrder = p.enum.map((v: any) => prettyEnum(String(v)));
    } else if (p.type === 'array' && Array.isArray(p.items?.enum)) {
      for (const v of p.items.enum) labels[String(v)] = String(v);
      choiceOrder = p.items.enum.map(String);
    }

    let kind: FeedbackFieldKind = 'text';
    if (p.type === 'null') kind = 'heading';
    else if (display === 'rating') kind = 'rating';
    else if (display === 'scale') kind = 'scale';
    else if (p.type === 'array') kind = 'multi';
    else if (p.type === 'boolean') kind = 'boolean';
    else if (p.type === 'number' || p.type === 'integer') kind = 'number';
    else if (choiceOrder.length) kind = 'choice';

    fields.push({
      key,
      title,
      kind,
      labels,
      options: choiceOrder,
      ...(otherFor[key] ? {otherKey: otherFor[key]} : {}),
      ...(typeof p.minimum === 'number' ? {min: p.minimum} : {}),
      ...(typeof p.maximum === 'number' ? {max: p.maximum} : {}),
      ...(options.minLabel ? {minLabel: String(options.minLabel)} : {}),
      ...(options.maxLabel ? {maxLabel: String(options.maxLabel)} : {}),
    });
  }
  return fields;
}

/** Questions that take an answer (headings don't). */
export function answerFields(fields: FeedbackField[]): FeedbackField[] {
  return fields.filter(f => f.kind !== 'heading');
}

function label(field: FeedbackField, value: unknown): string {
  const s = String(value);
  return field.labels[s] ?? s;
}

/**
 * One answer as people should read it. Numbers stay numbers (so spreadsheets
 * can add them up); everything else is text. Empty answers are ''.
 */
export function formatAnswer(
  field: FeedbackField,
  details: Record<string, unknown> | undefined | null,
): string | number {
  const value = details?.[field.key];
  const otherText = field.otherKey ? details?.[field.otherKey] : undefined;
  const withOther = (text: string) =>
    text === OTHER_OPTION && typeof otherText === 'string' && otherText.trim()
      ? `${OTHER_OPTION}: ${otherText.trim()}`
      : text;

  if (value === undefined || value === null || value === '') return '';
  switch (field.kind) {
    case 'heading':
      return '';
    case 'multi':
      return (Array.isArray(value) ? value : [value])
        .map(v => withOther(label(field, v)))
        .join('; ');
    case 'boolean':
      return value === true || value === 'true' ? 'Yes' : 'No';
    case 'number':
    case 'scale': {
      const n = Number(value);
      return Number.isFinite(n) ? n : String(value);
    }
    case 'rating': {
      const n = Number(label(field, value));
      return Number.isFinite(n) ? n : label(field, value);
    }
    case 'choice':
      return withOther(label(field, value));
    default:
      return Array.isArray(value) ? value.join('; ') : String(value);
  }
}

export interface QuestionSummary {
  key: string;
  title: string;
  kind: FeedbackFieldKind;
  answered: number;
  /** Choices, ratings and scales: label (or value) -> how many picked it. */
  counts?: Record<string, number>;
  /** Ratings, scales and numbers. */
  average?: number;
  /** Text answers (and "Other" texts), newest first, at most 20. */
  latestTexts?: string[];
}

/**
 * Per-question counts, averages and latest texts over current answers.
 * `answers` are newest first.
 */
export function summarizeAnswers(
  fields: FeedbackField[],
  answers: Record<string, unknown>[],
): QuestionSummary[] {
  return answerFields(fields).map(field => {
    const summary: QuestionSummary = {
      key: field.key,
      title: field.title,
      kind: field.kind,
      answered: 0,
    };
    const counts: Record<string, number> = {};
    const texts: string[] = [];
    let sum = 0;
    let numbers = 0;
    if (['choice', 'multi', 'rating', 'scale'].includes(field.kind)) {
      for (const option of field.options) counts[option] = 0;
      if (
        field.kind === 'scale' &&
        field.min !== undefined &&
        field.max !== undefined
      )
        for (let n = field.min; n <= field.max; n++) counts[String(n)] = 0;
    }

    for (const details of answers) {
      const value = details?.[field.key];
      if (
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && !value.length)
      )
        continue;
      summary.answered += 1;
      if (field.kind === 'choice' || field.kind === 'multi') {
        for (const v of Array.isArray(value) ? value : [value]) {
          const l = label(field, v);
          counts[l] = (counts[l] ?? 0) + 1;
        }
        const other = field.otherKey ? details?.[field.otherKey] : undefined;
        if (typeof other === 'string' && other.trim() && texts.length < 20)
          texts.push(other.trim());
      } else if (
        field.kind === 'rating' ||
        field.kind === 'scale' ||
        field.kind === 'number'
      ) {
        const n = Number(field.kind === 'rating' ? label(field, value) : value);
        if (Number.isFinite(n)) {
          sum += n;
          numbers += 1;
        }
        if (field.kind !== 'number')
          counts[String(n)] = (counts[String(n)] ?? 0) + 1;
      } else if (field.kind === 'boolean') {
        const l = value === true || value === 'true' ? 'Yes' : 'No';
        counts[l] = (counts[l] ?? 0) + 1;
      } else if (texts.length < 20) {
        texts.push(String(value));
      }
    }
    if (Object.keys(counts).length) summary.counts = counts;
    if (numbers) summary.average = Math.round((sum / numbers) * 100) / 100;
    if (texts.length) summary.latestTexts = texts;
    return summary;
  });
}
