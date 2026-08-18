/**
 * Labelled test set for the crowd-question screening filter (brief §4/§8).
 *
 * Deliberately loaded with the hard traps:
 *  - no-word-overlap duplicates ("describe ai" vs "what is the meaning of ai")
 *  - shared-words-but-different pairs ("what is ai" vs "who invented ai" → NOT dup)
 *  - gibberish, vague, off-topic, wrong-answer
 *
 * `expect` is the primary decision; `alsoOk` lists other acceptable decisions for
 * genuinely borderline cases (so confident-vs-unsure model calls both count).
 */
export type Decision = 'pass' | 'reject' | 'hold';

export interface ScreeningCase {
  id: string;
  trap: string;
  question: string;
  options?: string[];
  correctOptionIndex?: number;
  existingQuestions?: string[];
  context?: string;
  expect: Decision;
  alsoOk?: Decision[];
}

const AI_CTX = 'Introduction to Artificial Intelligence — what AI is, machine learning basics, neural networks, training data.';

export const SCREENING_CASES: ScreeningCase[] = [
  // ── gibberish / spam (local rules, free) ──
  {id: 'gib1', trap: 'gibberish', question: 'r5ytrwe5twe45tw3456tw4', expect: 'reject'},
  {id: 'gib2', trap: 'gibberish', question: 'asdkjh!!! @@@ ###', expect: 'reject'},
  {id: 'gib3', trap: 'spam-repeat', question: 'aaaaaaaaa what', expect: 'reject'},
  {id: 'gib4', trap: 'symbols-only', question: '?!?!?!?! ###', expect: 'reject'},

  // ── vague / incomplete (LLM meaningful) ──
  {id: 'vag1', trap: 'vague', question: 'what is that', expect: 'reject', alsoOk: ['hold']},
  {id: 'vag2', trap: 'vague', question: 'explain', expect: 'reject', alsoOk: ['hold']},
  {id: 'vag3', trap: 'vague', question: 'why?', expect: 'reject', alsoOk: ['hold']},
  {id: 'vag4', trap: 'vague', question: 'tell me more', expect: 'reject', alsoOk: ['hold']},

  // ── duplicate with NO word overlap (the hard case) ──
  {id: 'dup1', trap: 'no-overlap-dup', question: 'describe ai',
   existingQuestions: ['what is the meaning of ai'], expect: 'reject', alsoOk: ['hold']},
  {id: 'dup2', trap: 'no-overlap-dup', question: 'what does the term artificial intelligence refer to',
   existingQuestions: ['define ai'], expect: 'reject', alsoOk: ['hold']},
  {id: 'dup3', trap: 'reworded-dup', question: 'at what temperature does water start boiling',
   existingQuestions: ['what is the boiling point of water'], expect: 'reject', alsoOk: ['hold']},
  {id: 'dup4', trap: 'reworded-dup', question: 'who is credited with inventing the telephone',
   existingQuestions: ['who invented the telephone'], expect: 'reject', alsoOk: ['hold']},

  // ── shared words but DIFFERENT (must NOT be flagged duplicate) ──
  {id: 'nd1', trap: 'shared-words-not-dup', question: 'who invented ai',
   existingQuestions: ['what is ai'], context: AI_CTX, expect: 'pass'},
  {id: 'nd2', trap: 'shared-words-not-dup', question: 'what are the risks of ai',
   existingQuestions: ['what is ai'], context: AI_CTX, expect: 'pass'},
  {id: 'nd3', trap: 'shared-words-not-dup', question: 'how is a neural network trained',
   existingQuestions: ['what is a neural network'], context: AI_CTX, expect: 'pass'},

  // ── off-topic (context vs transcript) ──
  {id: 'ctx1', trap: 'off-topic', question: 'what is the offside rule in football',
   context: AI_CTX, expect: 'reject', alsoOk: ['hold']},
  {id: 'ctx2', trap: 'off-topic', question: 'who won the 2018 world cup',
   context: AI_CTX, expect: 'reject', alsoOk: ['hold']},
  {id: 'ctx3', trap: 'on-topic-ok', question: 'what kind of data is used to train a machine learning model',
   context: AI_CTX, expect: 'pass'},

  // ── wrong marked answer (MCQ) ──
  {id: 'ans1', trap: 'wrong-answer', question: 'what is the capital of japan',
   options: ['Tokyo', 'Beijing', 'Seoul', 'Osaka'], correctOptionIndex: 1, expect: 'reject', alsoOk: ['hold']},
  {id: 'ans2', trap: 'wrong-answer', question: 'which language runs natively in a web browser',
   options: ['Python', 'C++', 'JavaScript', 'Rust'], correctOptionIndex: 0,
   context: AI_CTX, expect: 'reject', alsoOk: ['hold']},
  {id: 'ans3', trap: 'right-answer', question: 'what is the capital of japan',
   options: ['Tokyo', 'Beijing', 'Seoul', 'Osaka'], correctOptionIndex: 0, expect: 'pass'},

  // ── clean, unique, on-topic (must PASS) ──
  {id: 'ok1', trap: 'clean', question: 'what is supervised learning in machine learning',
   context: AI_CTX, existingQuestions: ['what is ai'], expect: 'pass'},
  {id: 'ok2', trap: 'clean-mcq', question: 'which of these is a type of machine learning',
   options: ['Supervised learning', 'Photosynthesis', 'Mitosis', 'Erosion'], correctOptionIndex: 0,
   context: AI_CTX, expect: 'pass'},
  {id: 'ok3', trap: 'clean', question: 'what is the difference between training data and test data',
   context: AI_CTX, existingQuestions: ['what is a neural network'], expect: 'pass'},
  {id: 'ok4', trap: 'clean-mcq', question: 'what does a neural network loosely mimic',
   options: ['The human brain', 'A car engine', 'A database', 'A web server'], correctOptionIndex: 0,
   context: AI_CTX, expect: 'pass'},
];
