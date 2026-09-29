import {describe, it, expect} from 'vitest';
import {QuestionFactory} from '#root/modules/quizzes/classes/index.js';
import {parseModelJson, ModelJsonError} from '../utils/ModelJson.js';
import {
  allocateBloomCountsForAttempt,
  groupByBloom,
  normalizeBloomLevel,
  normalizeGeneratedQuestion,
  normalizeQuestionType,
  toFactoryBody,
} from '../utils/Questions.js';

const USER_ID = '64b7f0c2a1b2c3d4e5f60718';

describe('parseModelJson', () => {
  it('strips reasoning blocks and code fences', () => {
    const raw =
      '<think>Let me plan the boundaries…</think>\n```json\n{"boundaries": [120, 300,]}\n```';
    expect(parseModelJson(raw)).toEqual({boundaries: [120, 300]});
  });

  it('ignores braces inside strings and prose after the JSON', () => {
    const raw =
      'Here you go: {"questions": [{"question": {"text": "What does {x} mean?"}}]} Hope this helps!';
    expect(parseModelJson(raw)).toEqual({
      questions: [{question: {text: 'What does {x} mean?'}}],
    });
  });

  it('reports truncated output instead of guessing', () => {
    expect(() => parseModelJson('{"questions": [{"question": ')).toThrow(
      ModelJsonError,
    );
    expect(() => parseModelJson('')).toThrow(ModelJsonError);
  });
});

describe('normalizers', () => {
  it('maps Bloom aliases and numbers', () => {
    expect(normalizeBloomLevel('Remember')).toBe('knowledge');
    expect(normalizeBloomLevel('level 4')).toBe('analysis');
    expect(normalizeBloomLevel(6)).toBe('creation');
    expect(normalizeBloomLevel('vibes')).toBe('unclassified');
  });

  it('maps short type codes to the names QuestionFactory accepts', () => {
    expect(normalizeQuestionType('SOL')).toBe('SELECT_ONE_IN_LOT');
    expect(normalizeQuestionType('bin')).toBe('SELECT_ONE_IN_LOT');
    expect(normalizeQuestionType('SML')).toBe('SELECT_MANY_IN_LOT');
    expect(normalizeQuestionType('NAT')).toBe('NUMERIC_ANSWER_TYPE');
    expect(normalizeQuestionType('XYZ')).toBeNull();
  });
});

describe('normalizeGeneratedQuestion', () => {
  it('keeps a well-formed single-answer question', () => {
    const q = normalizeGeneratedQuestion(
      {
        bloomLevel: 'application',
        question: {text: 'A clinic nurse sees X. What next?', type: 'SOL'},
        solution: {
          correctLotItem: {text: 'Escalate', explanation: 'because'},
          incorrectLotItems: [{text: 'Wait'}, {text: 'Ignore'}],
        },
      },
      2,
    );
    expect(q).toMatchObject({
      segmentNumber: 2,
      bloomLevel: 'application',
      question: {type: 'SELECT_ONE_IN_LOT'},
      solution: {correctLotItem: {text: 'Escalate', explaination: 'because'}},
      options: ['Escalate', 'Wait', 'Ignore'],
    });
  });

  it('accepts the "options + answer index" form', () => {
    const q = normalizeGeneratedQuestion(
      {
        question: {text: 'Pick one', type: 'SOL'},
        options: ['A', 'B', 'C'],
        answer: 1,
      },
      1,
    );
    expect(q?.solution).toEqual({
      correctLotItem: {text: 'B', explaination: ''},
      incorrectLotItems: [
        {text: 'A', explaination: ''},
        {text: 'C', explaination: ''},
      ],
    });
  });

  it('turns several correct answers into a multi-answer question', () => {
    const q = normalizeGeneratedQuestion(
      {
        question: {text: 'Which apply?', type: 'SOL'},
        solution: {correctLotItems: ['A', 'B'], incorrectLotItems: ['C']},
      },
      1,
    );
    expect(q?.question.type).toBe('SELECT_MANY_IN_LOT');
  });

  it('drops questions with no text, no correct answer, or no distractor', () => {
    expect(normalizeGeneratedQuestion({question: {text: ''}}, 1)).toBeNull();
    expect(
      normalizeGeneratedQuestion(
        {question: {text: 'Q'}, solution: {incorrectLotItems: ['A']}},
        1,
      ),
    ).toBeNull();
    expect(
      normalizeGeneratedQuestion(
        {question: {text: 'Q'}, solution: {correctLotItem: 'A'}},
        1,
      ),
    ).toBeNull();
  });

  it('builds numeric and descriptive questions', () => {
    expect(
      normalizeGeneratedQuestion(
        {
          question: {text: 'How many?', type: 'NAT'},
          solution: {value: 4, tolerance: 0.5},
        },
        1,
      )?.solution,
    ).toEqual({
      value: 4,
      lowerLimit: 3.5,
      upperLimit: 4.5,
      decimalPrecision: 2,
    });
    expect(
      normalizeGeneratedQuestion(
        {
          question: {text: 'Explain', type: 'DES'},
          solution: {solutionText: 'Because…'},
        },
        1,
      )?.question.type,
    ).toBe('DESCRIPTIVE');
  });
});

describe('toFactoryBody', () => {
  it('produces a body QuestionFactory accepts', () => {
    const generated = normalizeGeneratedQuestion(
      {
        question: {text: 'Q?', type: 'SOL', hint: 'x'.repeat(200)},
        solution: {correctLotItem: 'A', incorrectLotItems: ['B']},
      },
      1,
    );
    const body = toFactoryBody({...generated, segmentId: 300}, 'knowledge');
    expect(body?.question.hint).toHaveLength(80);
    const created = QuestionFactory.createQuestion(body as any, USER_ID) as any;
    expect(created.type).toBe('SELECT_ONE_IN_LOT');
    expect(created.bloomLevel).toBe('knowledge');
    expect(created.correctLotItem.text).toBe('A');
  });

  it('infers multi-answer when an edit added a second correct option', () => {
    // What the page sends after an instructor marks two options correct on a SOL question.
    const edited = {
      segmentId: 300,
      question: {text: 'Q?', type: 'SELECT_ONE_IN_LOT'},
      solution: {
        correctLotItem: undefined,
        correctLotItems: [
          {text: 'A', explaination: ''},
          {text: 'B', explaination: ''},
        ],
        incorrectLotItems: [{text: 'C', explaination: ''}],
      },
    };
    const body = toFactoryBody(edited, 'analysis');
    expect(body?.question.type).toBe('SELECT_MANY_IN_LOT');
    const created = QuestionFactory.createQuestion(body as any, USER_ID) as any;
    expect(created.correctLotItems).toHaveLength(2);
  });

  it('accepts the legacy short type codes the page defaults to', () => {
    const body = toFactoryBody(
      {
        question: {text: 'Q?', type: 'SOL'},
        solution: {
          correctLotItem: {text: 'A'},
          incorrectLotItems: [{text: 'B'}],
        },
      },
      'knowledge',
    );
    expect(() =>
      QuestionFactory.createQuestion(body as any, USER_ID),
    ).not.toThrow();
  });

  it('rejects a question it cannot make valid', () => {
    expect(
      toFactoryBody(
        {question: {text: 'Q?', type: 'SOL'}, solution: {}},
        'knowledge',
      ),
    ).toBeNull();
  });
});

describe('Bloom grouping and quiz allocation', () => {
  it('shares untagged questions by the distribution', () => {
    const questions = [
      {bloomLevel: 'knowledge', id: 1},
      ...Array.from({length: 4}, (_, i) => ({id: i + 2})),
    ];
    const buckets = groupByBloom(questions, {knowledge: 50, application: 50});
    expect(buckets.knowledge.map(q => q.id)).toEqual([1, 2, 3]);
    expect(buckets.application.map(q => q.id)).toEqual([4, 5]);
    expect(buckets.understanding).toEqual([]);
  });

  it('shows every question, split by percentage and capped by bank size', () => {
    const counts = allocateBloomCountsForAttempt(
      [
        {bloomLevel: 'knowledge', availableCount: 2},
        {bloomLevel: 'understanding', availableCount: 5},
        {bloomLevel: 'application', availableCount: 3},
        {bloomLevel: 'analysis', availableCount: 0},
      ],
      {knowledge: 40, understanding: 35, application: 25},
    );
    expect(counts.knowledge + counts.understanding + counts.application).toBe(
      10,
    );
    expect(counts.knowledge).toBeLessThanOrEqual(2);
    expect(counts.analysis).toBe(0);
  });
});
