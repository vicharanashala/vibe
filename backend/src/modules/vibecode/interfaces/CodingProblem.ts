import { ObjectId } from 'mongodb';

export interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface LanguageTemplate {
  language: string; // 'java', 'python', 'cpp', 'javascript'
  studentBoilerplate: string;
  executionWrapper: string;
}

export interface CodingProblem {
  _id?: ObjectId | string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  supportedLanguages: string[]; // e.g., ['java', 'python', 'cpp', 'javascript']
  templates?: LanguageTemplate[]; // Making optional for backwards compatibility
  testCases: TestCase[];
  timeLimitMs: number;
  memoryLimitMb: number;
  createdAt?: Date;
  updatedAt?: Date;
}

