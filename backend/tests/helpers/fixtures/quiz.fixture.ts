import { faker } from '@faker-js/faker';
import { ObjectId } from 'mongodb';

export interface QuestionFixture {
  _id: ObjectId;
  type: 'mcq' | 'msq' | 'short';
  prompt: string;
  options: string[];
  correctIndices: number[];
  points: number;
}

export function makeQuestion(overrides: Partial<QuestionFixture> = {}): QuestionFixture {
  return {
    _id: new ObjectId(),
    type: 'mcq',
    prompt: faker.lorem.sentence() + '?',
    options: Array.from({ length: 4 }, () => faker.lorem.words(2)),
    correctIndices: [0],
    points: 1,
    ...overrides,
  };
}

export interface QuizFixture {
  _id: ObjectId;
  itemId: ObjectId;
  questions: ObjectId[];
  totalPoints: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  attemptsAllowed: number;
}

export function makeQuiz(overrides: Partial<QuizFixture> = {}): QuizFixture {
  return {
    _id: new ObjectId(),
    itemId: new ObjectId(),
    questions: [],
    totalPoints: 10,
    shuffleQuestions: false,
    shuffleOptions: false,
    attemptsAllowed: 3,
    ...overrides,
  };
}

export interface AttemptFixture {
  _id: ObjectId;
  quizId: ObjectId;
  userId: ObjectId;
  answers: Array<{ questionId: ObjectId; selectedIndices: number[] }>;
  score: number;
  submittedAt: Date | null;
}

export function makeAttempt(overrides: Partial<AttemptFixture> = {}): AttemptFixture {
  return {
    _id: new ObjectId(),
    quizId: new ObjectId(),
    userId: new ObjectId(),
    answers: [],
    score: 0,
    submittedAt: null,
    ...overrides,
  };
}
