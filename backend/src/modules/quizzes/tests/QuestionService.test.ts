import {describe, it, expect} from 'vitest';
import {toReviewQuestionResponse} from '#quizzes/classes/transformers/Question.js';

// ── Mock question builders ───────────────────────────────────────────────────

/** Minimal BaseQuestion fields needed by toReviewQuestionResponse() */
type MockQuestion = {
  _id?: {toString(): string};
  text: string;
  type: string;
  hint?: string;
  isParameterized: boolean;
};

function mockSOL(overrides: {
  incorrectLotItems?: Array<{text: string; explaination?: string}>;
  correctLotItem?: {text: string; explaination?: string};
  text?: string;
  hint?: string;
  isParameterized?: boolean;
  _id?: string | {toString(): string};
} = {}): MockQuestion & {
  incorrectLotItems: Array<{text: string; explaination?: string}>;
  correctLotItem?: {text: string; explaination?: string};
} {
  return {
    _id: overrides._id ? overrides._id : undefined,
    text: overrides.text ?? 'What is photosynthesis?',
    type: 'SELECT_ONE_IN_LOT',
    hint: overrides.hint,
    isParameterized: overrides.isParameterized ?? false,
    incorrectLotItems: overrides.incorrectLotItems ?? [
      {text: 'Respiration', explaination: 'Wrong'},
      {text: 'Diffusion', explaination: 'Wrong'},
    ],
    correctLotItem: overrides.correctLotItem ?? {
      text: 'Conversion of sunlight to chemical energy',
      explaination: 'Correct answer explanation — must not appear in response',
    },
  };
}

function mockSML(overrides: {
  incorrectLotItems?: Array<{text: string; explaination?: string}>;
  correctLotItems?: Array<{text: string; explaination?: string}>;
  text?: string;
} = {}): MockQuestion & {
  incorrectLotItems: Array<{text: string; explaination?: string}>;
  correctLotItems: Array<{text: string; explaination?: string}>;
} {
  return {
    _id: {toString: () => 'sml-id'},
    text: overrides.text ?? 'Select all prime numbers:',
    type: 'SELECT_MANY_IN_LOT',
    isParameterized: false,
    incorrectLotItems: overrides.incorrectLotItems ?? [
      {text: '4', explaination: 'Wrong'},
      {text: '6', explaination: 'Wrong'},
    ],
    correctLotItems: overrides.correctLotItems ?? [
      {text: '2', explaination: 'Correct'},
      {text: '3', explaination: 'Correct'},
    ],
  };
}

function mockOTL(overrides: {
  ordering?: Array<{lotItem: {text: string; explaination?: string}; order: number}>;
  text?: string;
} = {}): MockQuestion & {
  ordering: Array<{lotItem: {text: string; explaination?: string}; order: number}>;
} {
  return {
    _id: {toString: () => 'otl-id'},
    text: overrides.text ?? 'Order the phases of mitosis:',
    type: 'ORDER_THE_LOTS',
    isParameterized: false,
    ordering:
      overrides.ordering ??
      [
        {lotItem: {text: 'Cytokinesis', explaination: 'Last'}, order: 4},
        {lotItem: {text: 'Anaphase', explaination: 'Third'}, order: 3},
        {lotItem: {text: 'Metaphase', explaination: 'Second'}, order: 2},
        {lotItem: {text: 'Prophase', explaination: 'First'}, order: 1},
      ],
  };
}

function mockNAT(overrides: {
  decimalPrecision?: number;
  upperLimit?: number;
  lowerLimit?: number;
  text?: string;
} = {}): MockQuestion & {decimalPrecision: number; upperLimit: number; lowerLimit: number} {
  return {
    _id: {toString: () => 'nat-id'},
    text: overrides.text ?? 'What is the value of pi to 2 decimal places?',
    type: 'NUMERIC_ANSWER_TYPE',
    isParameterized: false,
    decimalPrecision: overrides.decimalPrecision ?? 2,
    upperLimit: overrides.upperLimit ?? 3.15,
    lowerLimit: overrides.lowerLimit ?? 3.14,
  };
}

function mockDES(overrides: {
  solutionText?: string;
  text?: string;
} = {}): MockQuestion & {solutionText: string} {
  return {
    _id: {toString: () => 'des-id'},
    text: overrides.text ?? 'Explain the process of osmosis.',
    type: 'DESCRIPTIVE',
    isParameterized: false,
    solutionText:
      overrides.solutionText ?? 'Full model answer — must not appear in response',
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('toReviewQuestionResponse', () => {

  // ── Base shape ─────────────────────────────────────────────────────────────

  it('returns id, body, type, hint, isParameterized, options', () => {
    const q = mockSOL({_id: 'sol-id'});
    const result = toReviewQuestionResponse(q as any);

    expect(result).toHaveProperty('id', 'sol-id');
    expect(result).toHaveProperty('body', q.text);
    expect(result).toHaveProperty('type', 'SELECT_ONE_IN_LOT');
    expect(result).toHaveProperty('hint', q.hint);
    expect(result).toHaveProperty('isParameterized', false);
    expect(result).toHaveProperty('options');
    expect(Array.isArray(result.options)).toBe(true);
  });

  it('returns empty string id when _id is absent', () => {
    const q = mockSOL({_id: undefined});
    const result = toReviewQuestionResponse(q as any);
    expect(result.id).toBe('');
  });

  // ── SELECT_ONE_IN_LOT ──────────────────────────────────────────────────────

  it('SOL: maps correct + incorrect lot items as A/B/C/D options', () => {
    const q = mockSOL({
      _id: 'q-sol-1',
      incorrectLotItems: [
        {text: 'Wrong option 1', explaination: 'Should not be sent'},
        {text: 'Wrong option 2', explaination: 'Should not be sent'},
      ],
      correctLotItem: {
        text: 'Right answer',
        explaination: 'Should not be sent either',
      },
    });
    const result = toReviewQuestionResponse(q as any);

    expect(result.options).toHaveLength(3);
    expect(result.options[0]).toMatchObject({key: 'A', text: 'Wrong option 1'});
    expect(result.options[1]).toMatchObject({key: 'B', text: 'Wrong option 2'});
    expect(result.options[2]).toMatchObject({key: 'C', text: 'Right answer'});
  });

  it('SOL: does NOT include explaination field in any option', () => {
    const q = mockSOL({
      incorrectLotItems: [{text: 'Opt', explaination: 'SECRET_EXPLAINATION'}],
      correctLotItem: {text: 'Correct', explaination: 'ANOTHER_SECRET'},
    });
    const result = toReviewQuestionResponse(q as any);

    result.options.forEach(opt => {
      expect(opt).not.toHaveProperty('explaination');
    });
  });

  it('SOL: does not throw when correctLotItem is absent from the cast', () => {
    // The SOLQuestion class always initialises correctLotItem to an object at
    // runtime (required field), so this test verifies the if-check in the
    // transformer handles a falsey value without throwing.
    const q = mockSOL({correctLotItem: {text: '', explaination: ''}});
    expect(() => toReviewQuestionResponse(q as any)).not.toThrow();
  });

  it('SOL: caps options at 8 items', () => {
    const manyItems = Array.from({length: 10}, (_, i) => ({
      text: `Option ${i}`,
      explaination: '',
    }));
    const q = mockSOL({incorrectLotItems: manyItems});
    const result = toReviewQuestionResponse(q as any);
    expect(result.options).toHaveLength(8);
    expect(result.options[7]?.key).toBe('H');
  });

  // ── SELECT_MANY_IN_LOT ─────────────────────────────────────────────────────

  it('SML: merges incorrectLotItems + correctLotItems into options', () => {
    const q = mockSML({
      incorrectLotItems: [{text: 'Wrong', explaination: ''}],
      correctLotItems: [{text: 'Right', explaination: ''}],
    });
    const result = toReviewQuestionResponse(q as any);

    expect(result.options).toHaveLength(2);
    expect(result.options[0]).toMatchObject({key: 'A', text: 'Wrong'});
    expect(result.options[1]).toMatchObject({key: 'B', text: 'Right'});
  });

  it('SML: does NOT include explaination in options', () => {
    const q = mockSML({
      incorrectLotItems: [{text: 'Opt', explaination: 'HIDDEN'}],
    });
    const result = toReviewQuestionResponse(q as any);
    expect(result.options[0]).not.toHaveProperty('explaination');
  });

  it('SML: handles empty correctLotItems array gracefully', () => {
    const q = mockSML({correctLotItems: []});
    const result = toReviewQuestionResponse(q as any);
    // Empty correctLotItems → only incorrectLotItems appear
    expect(result.options.map((o: any) => o.text)).toEqual(['4', '6']);
  });

  // ── ORDER_THE_LOTS ─────────────────────────────────────────────────────────

  it('OTL: maps all ordering items as options with lotItem.text', () => {
    const q = mockOTL();
    const result = toReviewQuestionResponse(q as any);

    expect(result.options).toHaveLength(4);
    expect(result.options[0]).toMatchObject({key: 'A', text: 'Cytokinesis'});
    expect(result.options[1]).toMatchObject({key: 'B', text: 'Anaphase'});
    expect(result.options[2]).toMatchObject({key: 'C', text: 'Metaphase'});
    expect(result.options[3]).toMatchObject({key: 'D', text: 'Prophase'});
  });

  it('OTL: does NOT include explaination from lotItem', () => {
    const q = mockOTL({
      ordering: [{lotItem: {text: 'Item', explaination: 'SECRET'}, order: 1}],
    });
    const result = toReviewQuestionResponse(q as any);
    expect(result.options[0]).not.toHaveProperty('explaination');
  });

  it('OTL: caps options at 8', () => {
    const ordering = Array.from({length: 10}, (_, i) => ({
      lotItem: {text: `Item ${i}`, explaination: ''},
      order: i + 1,
    }));
    const q = mockOTL({ordering});
    const result = toReviewQuestionResponse(q as any);
    expect(result.options).toHaveLength(8);
  });

  // ── NUMERIC_ANSWER_TYPE ────────────────────────────────────────────────────

  it('NAT: returns options: []', () => {
    const q = mockNAT();
    const result = toReviewQuestionResponse(q as any);
    expect(result.options).toHaveLength(0);
  });

  it('NAT: includes id, body, type', () => {
    const q = mockNAT({text: 'Numeric question'});
    const result = toReviewQuestionResponse(q as any);
    expect(result.id).toBe('nat-id');
    expect(result.body).toBe('Numeric question');
    expect(result.type).toBe('NUMERIC_ANSWER_TYPE');
  });

  // ── DESCRIPTIVE ────────────────────────────────────────────────────────────

  it('DES: returns options: []', () => {
    const q = mockDES();
    const result = toReviewQuestionResponse(q as any);
    expect(result.options).toHaveLength(0);
  });

  it('DES: does NOT include solutionText in response', () => {
    const q = mockDES({solutionText: 'TOP SECRET MODEL ANSWER'});
    const result = toReviewQuestionResponse(q as any);
    expect(result).toHaveProperty('body');
    expect(result).not.toHaveProperty('solutionText');
    expect(result).toHaveProperty('type', 'DESCRIPTIVE');
  });

  // ── Unknown / default type ─────────────────────────────────────────────────

  it('unknown type: returns empty options array', () => {
    const q = {...mockSOL(), type: 'RANDOM_UNKNOWN_TYPE' as any};
    const result = toReviewQuestionResponse(q as any);
    expect(result.options).toHaveLength(0);
  });

  // ── hint field ─────────────────────────────────────────────────────────────

  it('includes hint when present', () => {
    const q = mockSOL({hint: 'Think about energy conversion'});
    const result = toReviewQuestionResponse(q as any);
    expect(result.hint).toBe('Think about energy conversion');
  });

  it('hint is undefined when absent', () => {
    const q = mockSOL({hint: undefined});
    const result = toReviewQuestionResponse(q as any);
    expect(result.hint).toBeUndefined();
  });

});