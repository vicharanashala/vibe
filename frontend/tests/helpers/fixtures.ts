/**
 * Frontend test fixtures aligned with the API schema in `src/lib/api/schema.ts`.
 * Plain factories — no faker dependency to keep frontend dev bundle lean.
 */

let counter = 0;
const nextId = () => `id-${++counter}`;

export interface UserFixture {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

export function makeUser(overrides: Partial<UserFixture> = {}): UserFixture {
  return {
    id: nextId(),
    email: 'test@vibe.local',
    firstName: 'Test',
    lastName: 'User',
    roles: ['student'],
    ...overrides,
  };
}

export interface CourseFixture {
  id: string;
  name: string;
  description: string;
}

export function makeCourse(overrides: Partial<CourseFixture> = {}): CourseFixture {
  return {
    id: nextId(),
    name: 'Sample Course',
    description: 'A course for tests',
    ...overrides,
  };
}

export interface QuizFixture {
  id: string;
  itemId: string;
  questions: Array<{ id: string; type: 'mcq'; prompt: string; options: string[] }>;
  totalPoints: number;
}

export function makeQuiz(overrides: Partial<QuizFixture> = {}): QuizFixture {
  return {
    id: nextId(),
    itemId: nextId(),
    questions: [{ id: nextId(), type: 'mcq', prompt: 'Q1?', options: ['a', 'b', 'c', 'd'] }],
    totalPoints: 10,
    ...overrides,
  };
}

export interface EnrollmentFixture {
  id: string;
  userId: string;
  courseId: string;
  status: 'active' | 'completed' | 'ejected' | 'dropped';
}

export function makeEnrollment(overrides: Partial<EnrollmentFixture> = {}): EnrollmentFixture {
  return {
    id: nextId(),
    userId: nextId(),
    courseId: nextId(),
    status: 'active',
    ...overrides,
  };
}

export function resetFixtureCounter(): void {
  counter = 0;
}
