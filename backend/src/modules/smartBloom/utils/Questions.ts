/**
 * Question helpers for the Smart Bloom direct path: normalising what the model
 * returns, converting curated questions into the shape QuestionFactory accepts,
 * and sharing Bloom-level questions across a segment's quiz.
 */

export type BloomLevelKey =
  | 'knowledge'
  | 'understanding'
  | 'application'
  | 'analysis'
  | 'evaluation'
  | 'creation'
  | 'unclassified';

export const BLOOM_LEVELS: Exclude<BloomLevelKey, 'unclassified'>[] = [
  'knowledge',
  'understanding',
  'application',
  'analysis',
  'evaluation',
  'creation',
];

export type BloomDistribution = Partial<
  Record<Exclude<BloomLevelKey, 'unclassified'>, number>
>;

export type FactoryQuestionType =
  | 'SELECT_ONE_IN_LOT'
  | 'SELECT_MANY_IN_LOT'
  | 'ORDER_THE_LOTS'
  | 'NUMERIC_ANSWER_TYPE'
  | 'DESCRIPTIVE';

const BLOOM_ALIASES: Record<string, Exclude<BloomLevelKey, 'unclassified'>> = {
  knowledge: 'knowledge',
  remember: 'knowledge',
  remembering: 'knowledge',
  recall: 'knowledge',
  understanding: 'understanding',
  understand: 'understanding',
  comprehension: 'understanding',
  application: 'application',
  apply: 'application',
  applying: 'application',
  analysis: 'analysis',
  analyze: 'analysis',
  analyse: 'analysis',
  analyzing: 'analysis',
  analytical: 'analysis',
  evaluation: 'evaluation',
  evaluate: 'evaluation',
  evaluating: 'evaluation',
  creation: 'creation',
  create: 'creation',
  creating: 'creation',
  synthesis: 'creation',
};

export function normalizeBloomLevel(input: unknown): BloomLevelKey {
  if (typeof input === 'number' && input >= 1 && input <= 6) {
    return BLOOM_LEVELS[input - 1];
  }
  const key = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  const level = key.match(/^(?:l|level)?([1-6])$/);
  if (level) return BLOOM_LEVELS[Number(level[1]) - 1];
  return BLOOM_ALIASES[key] ?? 'unclassified';
}

export function extractBloomLevel(question: any): BloomLevelKey {
  const candidates = [
    question?.bloomLevel,
    question?.question?.bloomLevel,
    question?.level,
    question?.question?.level,
    question?.bloom,
    question?.metadata?.bloomLevel,
  ];
  for (const candidate of candidates) {
    const value =
      candidate && typeof candidate === 'object'
        ? ((candidate as any).level ?? (candidate as any).name)
        : candidate;
    const level = normalizeBloomLevel(value);
    if (level !== 'unclassified') return level;
  }
  return 'unclassified';
}

const TYPE_CODES: Record<string, FactoryQuestionType> = {
  SOL: 'SELECT_ONE_IN_LOT',
  BIN: 'SELECT_ONE_IN_LOT',
  SML: 'SELECT_MANY_IN_LOT',
  MUL: 'SELECT_MANY_IN_LOT',
  OTL: 'ORDER_THE_LOTS',
  NAT: 'NUMERIC_ANSWER_TYPE',
  DES: 'DESCRIPTIVE',
  SELECT_ONE_IN_LOT: 'SELECT_ONE_IN_LOT',
  SELECT_MANY_IN_LOT: 'SELECT_MANY_IN_LOT',
  ORDER_THE_LOTS: 'ORDER_THE_LOTS',
  NUMERIC_ANSWER_TYPE: 'NUMERIC_ANSWER_TYPE',
  DESCRIPTIVE: 'DESCRIPTIVE',
};

export function normalizeQuestionType(
  input: unknown,
): FactoryQuestionType | null {
  const key = String(input ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return TYPE_CODES[key] ?? null;
}

interface ILotItemDraft {
  text: string;
  explaination: string;
}

function lotItem(value: any): ILotItemDraft | null {
  const text = typeof value === 'string' ? value : value?.text;
  const clean = String(text ?? '').trim();
  if (!clean) return null;
  const explanation = value?.explaination ?? value?.explanation ?? '';
  return {text: clean, explaination: String(explanation ?? '')};
}

function lotItems(values: unknown): ILotItemDraft[] {
  return (Array.isArray(values) ? values : [])
    .map(lotItem)
    .filter((item): item is ILotItemDraft => !!item);
}

/**
 * Normalise one model-generated question into the raw shape the Smart Bloom
 * page curates and later sends back for upload. Returns null for anything that
 * cannot become a valid question, so bad model output is dropped, not uploaded.
 */
export function normalizeGeneratedQuestion(
  item: any,
  segmentNumber: number,
): Record<string, any> | null {
  const text = String(
    item?.question?.text ??
      item?.text ??
      (typeof item?.question === 'string' ? item.question : '') ??
      '',
  ).trim();
  if (!text) return null;

  const bloomLevel = extractBloomLevel(item);
  const declaredType = normalizeQuestionType(
    item?.question?.type ?? item?.type ?? item?.questionType,
  );
  const solutionIn = item?.solution ?? {};

  let correct = lotItems(solutionIn.correctLotItems);
  if (!correct.length) {
    const single = lotItem(solutionIn.correctLotItem);
    if (single) correct = [single];
  }
  let incorrect = lotItems(solutionIn.incorrectLotItems);

  // Also accept the looser "options + answer" form some replies use.
  const options = lotItems(item?.options);
  if (!correct.length && options.length) {
    const answers = [
      item?.answer,
      item?.correctAnswer,
      item?.correctOption,
      item?.correct,
    ]
      .flat()
      .filter(value => value !== undefined && value !== null);
    const answerTexts = new Set(
      answers
        .map(answer =>
          typeof answer === 'number'
            ? options[answer]?.text
            : lotItem(answer)?.text,
        )
        .filter(Boolean)
        .map(value => String(value).toLowerCase()),
    );
    correct = options.filter(option =>
      answerTexts.has(option.text.toLowerCase()),
    );
    incorrect = options.filter(
      option => !answerTexts.has(option.text.toLowerCase()),
    );
  }

  const base = {
    segmentNumber,
    bloomLevel: bloomLevel === 'unclassified' ? undefined : bloomLevel,
  };
  const hint =
    typeof item?.question?.hint === 'string' ? item.question.hint : undefined;

  if (declaredType === 'NUMERIC_ANSWER_TYPE') {
    const value = Number(solutionIn.value ?? item?.answer);
    if (!Number.isFinite(value)) return null;
    const tolerance = Math.abs(Number(solutionIn.tolerance ?? 0)) || 0;
    return {
      ...base,
      question: {
        text,
        type: 'NUMERIC_ANSWER_TYPE',
        bloomLevel: base.bloomLevel,
        hint,
      },
      solution: {
        value,
        lowerLimit: Number.isFinite(Number(solutionIn.lowerLimit))
          ? Number(solutionIn.lowerLimit)
          : value - tolerance,
        upperLimit: Number.isFinite(Number(solutionIn.upperLimit))
          ? Number(solutionIn.upperLimit)
          : value + tolerance,
        decimalPrecision: Number.isInteger(solutionIn.decimalPrecision)
          ? solutionIn.decimalPrecision
          : 2,
      },
      options: [],
    };
  }

  if (declaredType === 'DESCRIPTIVE') {
    const solutionText = String(
      solutionIn.solutionText ?? item?.answer ?? '',
    ).trim();
    if (!solutionText) return null;
    return {
      ...base,
      question: {text, type: 'DESCRIPTIVE', bloomLevel: base.bloomLevel, hint},
      solution: {solutionText},
      options: [],
    };
  }

  // Lot-based (single, multiple, binary): needs one correct and one wrong option at least.
  const seen = new Set<string>();
  const dedupe = (items: ILotItemDraft[]) =>
    items.filter(option => {
      const key = option.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  correct = dedupe(correct);
  incorrect = dedupe(incorrect);
  if (!correct.length || !incorrect.length) return null;

  const type: FactoryQuestionType =
    correct.length > 1 ? 'SELECT_MANY_IN_LOT' : 'SELECT_ONE_IN_LOT';
  return {
    ...base,
    question: {text, type, bloomLevel: base.bloomLevel, hint},
    solution:
      type === 'SELECT_MANY_IN_LOT'
        ? {correctLotItems: correct, incorrectLotItems: incorrect}
        : {correctLotItem: correct[0], incorrectLotItems: incorrect},
    options: [...correct, ...incorrect].map(option => option.text),
  };
}

const MAX_HINT_LENGTH = 80;

/**
 * Convert a curated question (as the page sends it back) into the body
 * QuestionFactory.createQuestion expects. The type is inferred from the
 * solution rather than trusted, because editing on the page can turn a
 * single-answer question into a multi-answer one without changing its label.
 */
export function toFactoryBody(
  curated: any,
  bloomLevel: Exclude<BloomLevelKey, 'unclassified'>,
): {question: Record<string, any>; solution: Record<string, any>} | null {
  const questionIn = curated?.question ?? {};
  const text = String(questionIn.text ?? curated?.text ?? '').trim();
  if (!text) return null;

  const solution = curated?.solution ?? {};
  const declared = normalizeQuestionType(
    questionIn.type ?? curated?.questionType,
  );
  const correctMany = lotItems(solution.correctLotItems);
  const correctOne = lotItem(solution.correctLotItem);
  const incorrect = lotItems(solution.incorrectLotItems);

  let type: FactoryQuestionType | null = declared;
  let solutionOut: Record<string, any> | null = null;

  if (correctMany.length > 1) {
    type = 'SELECT_MANY_IN_LOT';
    solutionOut = {correctLotItems: correctMany, incorrectLotItems: incorrect};
  } else if (correctOne || correctMany.length === 1) {
    type = 'SELECT_ONE_IN_LOT';
    solutionOut = {
      correctLotItem: correctOne ?? correctMany[0],
      incorrectLotItems: incorrect,
    };
  } else if (
    declared === 'NUMERIC_ANSWER_TYPE' &&
    Number.isFinite(Number(solution.value))
  ) {
    solutionOut = {
      value: Number(solution.value),
      lowerLimit: Number(solution.lowerLimit ?? solution.value),
      upperLimit: Number(solution.upperLimit ?? solution.value),
      decimalPrecision: Number.isInteger(solution.decimalPrecision)
        ? solution.decimalPrecision
        : 2,
    };
  } else if (
    declared === 'DESCRIPTIVE' &&
    String(solution.solutionText ?? '').trim()
  ) {
    solutionOut = {solutionText: String(solution.solutionText).trim()};
  } else if (
    declared === 'ORDER_THE_LOTS' &&
    Array.isArray(solution.ordering) &&
    solution.ordering.length
  ) {
    solutionOut = {ordering: solution.ordering};
  }

  if (!type || !solutionOut) return null;
  if (
    (type === 'SELECT_ONE_IN_LOT' || type === 'SELECT_MANY_IN_LOT') &&
    !incorrect.length
  )
    return null;

  const hint =
    typeof questionIn.hint === 'string' &&
    questionIn.hint.length > MAX_HINT_LENGTH
      ? `${questionIn.hint.slice(0, MAX_HINT_LENGTH - 3)}...`
      : questionIn.hint;

  return {
    question: {
      text,
      type,
      isParameterized: false,
      parameters: [],
      hint,
      bloomLevel,
      timeLimitSeconds: Number(questionIn.timeLimitSeconds) || 60,
      points: Number(questionIn.points) || 5,
      priority: ['LOW', 'MEDIUM', 'HIGH'].includes(questionIn.priority)
        ? questionIn.priority
        : 'MEDIUM',
    },
    solution: solutionOut,
  };
}

/**
 * Put every question into a Bloom bucket. Untagged questions are shared out in
 * proportion to the instructor's distribution, then round-robin for any left.
 */
export function groupByBloom(
  questions: any[],
  distribution: BloomDistribution | undefined,
): Record<Exclude<BloomLevelKey, 'unclassified'>, any[]> {
  const buckets = Object.fromEntries(
    BLOOM_LEVELS.map(level => [level, [] as any[]]),
  ) as Record<Exclude<BloomLevelKey, 'unclassified'>, any[]>;
  const unclassified: any[] = [];
  for (const question of questions) {
    const level = extractBloomLevel(question);
    if (level === 'unclassified') unclassified.push(question);
    else buckets[level].push(question);
  }
  if (!unclassified.length) return buckets;

  const weights =
    distribution && Object.values(distribution).some(value => (value ?? 0) > 0)
      ? distribution
      : {knowledge: 40, understanding: 35, application: 25};
  const total = BLOOM_LEVELS.reduce(
    (sum, level) => sum + (weights[level] ?? 0),
    0,
  );

  let index = 0;
  for (const level of BLOOM_LEVELS) {
    const share = weights[level] ?? 0;
    if (!share) continue;
    const count = Math.round((share / total) * unclassified.length);
    for (let i = 0; i < count && index < unclassified.length; i++) {
      buckets[level].push(unclassified[index++]);
    }
  }
  const active = BLOOM_LEVELS.filter(level => (weights[level] ?? 0) > 0);
  for (let turn = 0; index < unclassified.length; turn++) {
    buckets[active[turn % active.length]].push(unclassified[index++]);
  }
  return buckets;
}

/**
 * How many questions each Bloom bank contributes to one quiz attempt: every
 * available question is shown, split by the instructor's percentages using the
 * largest-remainder method and capped by what each bank actually holds.
 */
export function allocateBloomCountsForAttempt(
  banks: Array<{
    bloomLevel: Exclude<BloomLevelKey, 'unclassified'>;
    availableCount: number;
  }>,
  distribution: BloomDistribution | undefined,
): Record<Exclude<BloomLevelKey, 'unclassified'>, number> {
  const allocations = Object.fromEntries(
    BLOOM_LEVELS.map(level => [level, 0]),
  ) as Record<Exclude<BloomLevelKey, 'unclassified'>, number>;
  const eligible = banks.filter(bank => bank.availableCount > 0);
  if (!eligible.length) return allocations;

  const total = eligible.reduce((sum, bank) => sum + bank.availableCount, 0);
  const activePercent = eligible.reduce(
    (sum, bank) => sum + (distribution?.[bank.bloomLevel] ?? 0),
    0,
  );

  const weighted = eligible.map(bank => {
    const share =
      activePercent > 0
        ? (distribution?.[bank.bloomLevel] ?? 0) / activePercent
        : 1 / eligible.length;
    const expected = total * share;
    return {
      ...bank,
      allocated: Math.min(bank.availableCount, Math.floor(expected)),
      remainder: expected - Math.floor(expected),
    };
  });

  let remaining =
    total - weighted.reduce((sum, bank) => sum + bank.allocated, 0);
  for (const bank of [...weighted].sort((a, b) => b.remainder - a.remainder)) {
    if (remaining <= 0) break;
    if (bank.allocated < bank.availableCount) {
      bank.allocated += 1;
      remaining -= 1;
    }
  }
  for (const bank of weighted) {
    while (remaining > 0 && bank.allocated < bank.availableCount) {
      bank.allocated += 1;
      remaining -= 1;
    }
  }
  for (const bank of weighted) allocations[bank.bloomLevel] = bank.allocated;
  return allocations;
}
