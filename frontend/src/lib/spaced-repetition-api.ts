import {
  ReviewItem,
  CourseRetentionSummary,
  RecallQuality,
  SeedScheduleResponse,
  SubmitReviewResponse,
  UpdateOptOutResponse,
  BulkUpdateResponse,
  TeacherCourseSummary,
  EnrichedStudent,
  QuestionSummaryResponse,
} from '@/types/spaced-repetition.types';
import { recordReviewToday, clearStreak } from './streak';

// â”€â”€ Toggle this to false when the backend is ready â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const USE_MOCK = false;
const BASE_URL = import.meta.env.VITE_BASE_URL ?? '';

// â”€â”€ Mock state persistence (localStorage) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// In mock mode, teacher and student use the same browser session. We persist
// MOCK_REVIEW_ITEMS to localStorage so that:
//   1. A teacher mutation (boost, hint, reset, bulk opt-out, bulk exam-prep)
//      survives a logout/login cycle.
//   2. The student's dashboard reflects those mutations on next load.
// localStorage is per-origin so this also works across browser tabs on the
// same dev server. Bump the version key if the mock schema changes
// incompatibly â€” a stale payload would cause the hydration to fail and we'd
// silently reseed.
const MOCK_STORAGE_KEY = 'vibe_sr_mock_v2'; // v2: +2 helper students in mock-course-1 (was 6 items, now 8)

function loadMockState(): ReviewItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReviewItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch (err) {
    console.warn('[spaced-repetition-api] Failed to load mock state from localStorage, reseeding:', err);
    return null;
  }
}

function persistMockState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(MOCK_REVIEW_ITEMS));
  } catch (err) {
    // Quota exceeded, private mode, etc. â€” log and continue. The demo will
    // still work in-memory for this session; we just lose cross-logout
    // persistence until the user clears the issue.
    console.warn('[spaced-repetition-api] Failed to persist mock state to localStorage:', err);
  }
}

/** Dev-only escape hatch: clears localStorage and reloads the page. */
export function resetMockState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(MOCK_STORAGE_KEY);
    clearStreak(); // also wipe the daily-review streak (added 2026-08-03)
    window.location.reload();
  } catch (err) {
    console.warn('[spaced-repetition-api] Failed to reset mock state:', err);
  }
}

// â”€â”€ Mock data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

function futureDate(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

// â”€â”€ Demo-mode student resolution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// In mock mode, the seed items are keyed to a *demo* student id. When the user
// signs in via the Firebase emulator (`student@test.com`), Firebase returns a
// different auto-generated uid. To make the demo work without seeding the
// emulator with the demo uid, consumers map the auth uid to DEMO_STUDENT_ID
// when the email matches a known demo credential.
export const DEMO_STUDENT_ID = 'dJDsxeP9kqOkHEygUHWu45DmJkQz';
export const DEMO_STUDENT_EMAILS: ReadonlySet<string> = new Set([
  'student@test.com',
]);
export function isDemoStudentEmail(email: string | null | undefined): boolean {
  return !!email && DEMO_STUDENT_EMAILS.has(email);
}

// Human-readable mock directory (added 2026-08-03)
// In mock mode the IDs in MOCK_REVIEW_ITEMS are opaque strings
// ('mock-course-1', 'stu-helper-A', Firebase UIDs). For the SR teacher
// dashboard we need to show real-looking names + emails instead of asking
// teachers to type IDs by hand. These maps provide that. Live mode will
// resolve names via the backend (see backend/src/modules/spacedRepetition).
// Adding a new mock student/course? Add the entry here AND add the
// corresponding item to MOCK_REVIEW_ITEMS. Missing entries fall back
// gracefully via studentDisplay() / courseDisplay() (id prefix).

export interface StudentDisplay {
  name: string;
  email: string;
}

export interface CourseDisplay {
  name: string;
}

export const MOCK_COURSE_DIRECTORY: Readonly<Record<string, CourseDisplay>> = Object.freeze({
  'mock-course-1': { name: 'Demo Spaced Repetition Course' },
  'mock-course-2': { name: 'CS Algorithms - Extended' },
});

export const MOCK_STUDENT_DIRECTORY: Readonly<Record<string, StudentDisplay>> = Object.freeze({
  [DEMO_STUDENT_ID]: { name: 'Riya Sharma', email: 'student@test.com' },
  'stu-helper-002':  { name: 'Arjun Mehta', email: 'arjun.m@test.com' },
  'stu-helper-A':    { name: 'Priya Iyer',  email: 'priya.i@test.com' },
  'stu-helper-B':    { name: 'Karthik Rao', email: 'karthik.r@test.com' },
  'NQTDHq8CSa0GDNpjzUv8IFjZAifM': {
    name: 'Demo (Knob Test)',
    email: 'knob-test@example.com',
  },
});

/** Resolves a student id to its display info; never throws. */
export function studentDisplay(studentId: string): StudentDisplay {
  return MOCK_STUDENT_DIRECTORY[studentId] ?? {
    name: `Student ${studentId.slice(0, 6)}`,
    email: `${studentId.slice(0, 6)}@unknown.local`,
  };
}

/** Resolves a course id to its display info; never throws. */
export function courseDisplay(courseId: string): CourseDisplay {
  return MOCK_COURSE_DIRECTORY[courseId] ?? {
    name: `Course ${courseId.slice(0, 8)}`,
  };
}

// ── Question body preview lookup (Day 2, 2026-08-04) ──────────────────────
//
// Mirrors the day-1 pattern (MOCK_COURSE_DIRECTORY / MOCK_STUDENT_DIRECTORY)
// but for question bodies. Used by the teacher dashboard per-card row to
// show human-readable question text instead of the raw `question_id.slice(0, 8)`.
//
// Source-of-truth for the body strings lives in `ReviewSession.tsx`'s
// `MOCK_QUESTIONS` — keep the two in sync when adding new mock questions.
// The duplication is intentional: these two pages consume different
// shapes (the student-side review card wants the full question +
// options + hint, the teacher-side cohort table just wants the body +
// type + bank titles), so a shared `MOCK_QUESTIONS_STORE` would force
// both pages to over-fetch.

export interface QuestionDisplay {
  body: string;
  type: string;
  bankTitles: string[];
}

export const MOCK_QUESTION_DIRECTORY: Readonly<Record<string, QuestionDisplay>> = Object.freeze({
  'mock-question-1': {
    body: 'Which of the following are linear data structures?',
    type: 'SELECT_MANY_IN_LOT',
    bankTitles: ['Data Structures'],
  },
  'mock-question-2': {
    body: 'What is the worst-case time complexity of binary search on a sorted array?',
    type: 'SELECT_ONE_IN_LOT',
    bankTitles: ['Algorithms'],
  },
  'mock-question-3': {
    body: 'How many bits are in a byte?',
    type: 'NUMERIC_ANSWER',
    bankTitles: ['CS Fundamentals'],
  },
  'mock-question-4': {
    body: 'Which layer of the OSI model is responsible for routing packets?',
    type: 'SELECT_ONE_IN_LOT',
    bankTitles: ['Networking & OS'],
  },
  // Cross-bank entries (matches ReviewSession.tsx Bug 2 fix). These are
  // only present in the schedule if a teacher triggered Knob 7 reassignment
  // for the demo student. The teacher dashboard sees them only when present.
  'mock-question-cross-1': {
    body: 'In a relational DB, a foreign key constraint enforces…',
    type: 'SELECT_ONE_IN_LOT',
    bankTitles: ['Sample Cross-Bank Collection'],
  },
  'mock-question-cross-2': {
    body: 'What does ACID stand for?',
    type: 'SELECT_MANY_IN_LOT',
    bankTitles: ['Sample Cross-Bank Collection'],
  },
});

/**
 * Looks up a question's display info by id. Returns `null` if the id
 * isn't in the mock directory — the caller (the teacher dashboard
 * per-card row) falls back to the raw `Q:${questionId.slice(0, 8)}`
 * slice in that case. This matches the fail-open posture of
 * `studentDisplay()` / `courseDisplay()`.
 */
export function questionDisplay(questionId: string): QuestionDisplay | null {
  return MOCK_QUESTION_DIRECTORY[questionId] ?? null;
}

// Seed array â€” the initial state used when localStorage has no mock payload
// yet (first run, after `resetMockState()`, or in SSR / private mode).
// Used to bootstrap `MOCK_REVIEW_ITEMS` on module init; thereafter the live
// array is the source of truth and `persistMockState()` writes it back to
// localStorage after every mutation.
function buildSeedItems(): ReviewItem[] {
  return [
    // â”€â”€ mock-course-1: mixed state (overdue + due soon + healthy) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      _id: 'mock-item-1',
      student_id: DEMO_STUDENT_ID, // Demo student
      course_id: 'mock-course-1',
      question_id: 'mock-question-1',
      n: 0,
      EF: 2.5,
      interval_days: 1,
      next_review_at: yesterday.toISOString(), // overdue â€” for testing
      last_reviewed_at: null,
      notification_opt_out: false,
    },
    {
      _id: 'mock-item-2',
      student_id: DEMO_STUDENT_ID, // Demo student
      course_id: 'mock-course-1',
      question_id: 'mock-question-2',
      n: 1,
      EF: 2.6,
      interval_days: 6,
      next_review_at: tomorrow.toISOString(), // due soon â€” for testing
      last_reviewed_at: yesterday.toISOString(),
      notification_opt_out: false,
    },
    {
      _id: 'mock-item-3',
      student_id: DEMO_STUDENT_ID, // Demo student (2nd card in this course)
      course_id: 'mock-course-1',
      question_id: 'mock-question-3',
      n: 2,
      EF: 2.7,
      interval_days: 16,
      next_review_at: yesterday.toISOString(), // overdue â€” for testing
      last_reviewed_at: yesterday.toISOString(),
      notification_opt_out: false,
    },
    {
      _id: 'mock-item-6',
      student_id: DEMO_STUDENT_ID, // Demo student
      course_id: 'mock-course-1',
      question_id: 'mock-question-4',
      n: 0,
      EF: 2.5,
      interval_days: 1,
      next_review_at: yesterday.toISOString(), // overdue â€” for testing
      last_reviewed_at: null,
      notification_opt_out: false,
    },
    {
      // Helper student A â€” visible only in teacher cohort view for mock-course-1.
      // The demo student's `getSchedule()` filters on `student_id` so this
      // never leaks into the student dashboard.
      _id: 'mock-item-7',
      student_id: 'stu-helper-A',
      course_id: 'mock-course-1',
      question_id: 'mock-question-2',
      n: 0,
      EF: 2.5,
      interval_days: 1,
      next_review_at: yesterday.toISOString(),
      last_reviewed_at: null,
      notification_opt_out: false,
    },
    {
      // Helper student B â€” same purpose as above.
      _id: 'mock-item-8',
      student_id: 'stu-helper-B',
      course_id: 'mock-course-1',
      question_id: 'mock-question-3',
      n: 1,
      EF: 2.6,
      interval_days: 6,
      next_review_at: yesterday.toISOString(),
      last_reviewed_at: yesterday.toISOString(),
      notification_opt_out: false,
    },

    // â”€â”€ mock-course-2: healthy / mastered state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      _id: 'mock-item-4',
      student_id: DEMO_STUDENT_ID, // Demo student enrolled in this course too
      course_id: 'mock-course-2',
      question_id: 'mock-question-1',
      n: 4,
      EF: 2.8,
      interval_days: 30,
      next_review_at: futureDate(20).toISOString(), // far away â€” mastered
      last_reviewed_at: yesterday.toISOString(),
      notification_opt_out: false,
    },
    {
      _id: 'mock-item-5',
      student_id: 'stu-helper-002', // Helper student â€” keeps teacher cohort UI varied
      course_id: 'mock-course-2',
      question_id: 'mock-question-2',
      n: 5,
      EF: 3.0,
      interval_days: 60,
      next_review_at: futureDate(45).toISOString(), // far away â€” mastered
      last_reviewed_at: yesterday.toISOString(),
      notification_opt_out: true, // opted out
    },
  ];
}

// Live, mutable mock state. Hydrated from localStorage on first load; on
// every mutation we call `persistMockState()` to write back. The helper
// students (stu-helper-002) live in this same array but are only visible to
// teacher cohort views, since `getSchedule()` filters by student_id.
const _hydrated = loadMockState();
const MOCK_REVIEW_ITEMS: ReviewItem[] = _hydrated ?? buildSeedItems();
if (!_hydrated) persistMockState(); // first-run: write seed into localStorage

/**
 * Derive a CourseRetentionSummary from the mock schedule.
 * Mirrors what SpacedRepetitionService.getCourseRetention computes on the
 * backend: totalItems + overdueCount (next_review_at < now) + dueSoonCount
 * (next_review_at within 7 days, not overdue) + averageEF across all items
 * for the course.
 */
function deriveMockRetention(courseId: string, studentId?: string): CourseRetentionSummary {
  const items = MOCK_REVIEW_ITEMS.filter(
    i => i.course_id === courseId && (studentId ? i.student_id === studentId : true),
  );
  const now = Date.now();
  const inSevenDays = now + 7 * 24 * 60 * 60 * 1000;
  const overdueCount = items.filter(
    i => new Date(i.next_review_at).getTime() < now,
  ).length;
  const dueSoonCount = items.filter(i => {
    const t = new Date(i.next_review_at).getTime();
    return t >= now && t <= inSevenDays;
  }).length;
  const averageEF =
    items.length === 0
      ? 0
      : items.reduce((sum, i) => sum + i.EF, 0) / items.length;
  return {
    courseId,
    totalItems: items.length,
    overdueCount,
    dueSoonCount,
    averageEF: Number(averageEF.toFixed(2)),
    items,
  };
}

// â”€â”€ Helper â€” get auth token â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getToken(): string {
  return localStorage.getItem('firebase-auth-token') ?? '';
}

// â”€â”€ Helper â€” base fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

// â”€â”€ API functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Seed a review schedule for a student on course completion.
 * POST /api/spaced-repetition/:studentId/seed
 */
export async function seedSchedule(
  studentId: string,
  courseId: string,
  questionIds: string[],
): Promise<SeedScheduleResponse> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 400));
    return { seeded: questionIds.length };
  }
  return apiFetch(`/api/spaced-repetition/${studentId}/seed`, {
    method: 'POST',
    body: JSON.stringify({ courseId, questionIds }),
  });
}

/**
 * Submit a recall quality response for a single question.
 * POST /api/spaced-repetition/:studentId/review
 *
 * Knob 8c (2026-07-29): server-side quality integrity. The backend
 * (or the mock layer in USE_MOCK mode) caps the student's quality at
 * `unsure` when an objective answer signal shows the pick was wrong.
 * The response surfaces `qualityAdjusted` + `qualityAdjustedFrom` so
 * the frontend can show a small "downgraded" notice.
 *
 * Answer inputs:
 *   - MCQ: pass `selectedOptionIndices` (the indices into the
 *     review-mode `options[]` array the student saw). Omit
 *     `numericAnswer` in this case.
 *   - NUMERIC_ANSWER: pass `numericAnswer` (string the student typed).
 *     Omit `selectedOptionIndices` in this case.
 *   - Ungraded (DESCRIPTIVE, ORDER_THE_LOTS): omit both; quality is
 *     trusted as-is.
 *
 * Reveal-on-missed: when the (post-cap) quality is `missed` AND the
 * question is objectively gradable, the response includes
 * `canonicalAnswer` - a short human-readable rendering of the right
 * answer. Honest self-report gets rewarded; we never leak the answer
 * on `got_it` or `unsure`.
 */
export async function submitReview(
  studentId: string,
  questionId: string,
  quality: RecallQuality,
  selectedOptionIndices?: number[],
  numericAnswer?: string,
): Promise<SubmitReviewResponse> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 300));
    const idx = MOCK_REVIEW_ITEMS.findIndex(
      i => i.student_id === studentId && i.question_id === questionId,
    );
    if (idx === -1) throw new Error('Mock: review item not found');
    const item = MOCK_REVIEW_ITEMS[idx];

    // Knob 8c (mock): mirror backend's server-side integrity check.
    // Compute correctness first against the mock catalogue, then cap
    // the quality at `unsure` if the student rated `got_it` on a
    // wrong pick. Mirrors SpacedRepetitionService.submitReview.
    let isCorrect: boolean | undefined;
    let canonicalAnswer: string | undefined;
    const q = MOCK_QUESTIONS_CATALOG[questionId];

    if (selectedOptionIndices && selectedOptionIndices.length > 0) {
      // MCQ path: compare sets against the catalogue's correctIndices.
      const correct = q?.correctIndices;
      if (correct && correct.length > 0) {
        if (q?.type === 'SELECT_ONE_IN_LOT') {
          isCorrect =
            selectedOptionIndices.length === 1 &&
            selectedOptionIndices[0] === correct[0];
        } else if (q?.type === 'SELECT_MANY_IN_LOT') {
          const a = new Set(selectedOptionIndices);
          const b = new Set(correct);
          isCorrect = a.size === b.size && [...a].every(x => b.has(x));
        }
        if (isCorrect === false && q.correctAnswer) {
          canonicalAnswer = q.correctAnswer;
        }
      }
    } else if (numericAnswer !== undefined && q?.type === 'NUMERIC_ANSWER') {
      // NAT path: exact parseFloat match against the catalogue's
      // correctAnswer field. Mirrors backend's _evaluateNATCorrectness.
      const canonical = parseFloat(q.correctAnswer ?? '');
      const submitted = parseFloat(numericAnswer);
      if (!Number.isNaN(canonical) && !Number.isNaN(submitted)) {
        isCorrect = canonical === submitted;
        if (isCorrect === false && q.correctAnswer) {
          canonicalAnswer = q.correctAnswer;
        }
      }
    }

    // Server-side quality cap: wrong pick + got_it -> unsure.
    let effectiveQuality: RecallQuality = quality;
    let qualityAdjusted = false;
    let qualityAdjustedFrom: RecallQuality | undefined;
    if (isCorrect === false && quality === 'got_it') {
      effectiveQuality = 'unsure';
      qualityAdjusted = true;
      qualityAdjustedFrom = quality;
    }

    // Mutate in place so the change survives logout/login via localStorage.
    // Faithful-enough SM-2: q in {5,3,1}, EF delta formula, intervals.
    // Interval logic mirrors backend `_applySM2` — on a wrong answer
    // (newN === 0), reset to 1 day; otherwise the standard SM-2 progression
    // (1, 6, then round(interval * EF)).
    const q5 = effectiveQuality === 'got_it' ? 5 : effectiveQuality === 'unsure' ? 3 : 1;
    const newEF = Math.max(1.3, item.EF + (0.1 - (5 - q5) * (0.08 + (5 - q5) * 0.02)));
    let newN = q5 < 3 ? 0 : item.n + 1;
    let nextInterval: number;
    if (newN === 0) {
      // Wrong answer: reset interval to 1 day regardless of prior n.
      nextInterval = 1;
    } else if (newN === 1) {
      nextInterval = 1;
    } else if (newN === 2) {
      nextInterval = 6;
    } else {
      // Correct at n >= 3: compound the prior interval by EF.
      nextInterval = Math.round(item.interval_days * newEF);
    }
    // Regression guard (added 2026-08-01): SM-2 invariant — a missed
    // answer (newN === 0) MUST reset interval to 1 day. If this fires,
    // the interval-branching above has regressed; mirror backend
    // `_applySM2` in SpacedRepetitionService.ts. Stripped by bundler
    // in prod, but visible in devtools when running against USE_MOCK=true.
    console.assert(
      newN !== 0 || nextInterval === 1,
      '[SM-2 mock] missed answer did not reset interval to 1 day',
      { newN, nextInterval, priorInterval: item.interval_days, priorN: item.n },
    );
    // Wrong-answer override (2026-08-03): when the objective answer was
    // wrong (Knob 8c), force a full SM-2 reset (n=0, interval=1d) regardless
    // of which button the student pressed. Without this, a wrong pick +
    // `got_it` (capped to `unsure`, q=3) on an item with prior n>=2 still
    // produces interval = round(prior * EF) — e.g. 16 * 2.56 ≈ 41 days —
    // which contradicts the amber "Downgraded" notice shown to the user.
    // Mirrors the backend override in `SpacedRepetitionService.submitReview`.
    if (isCorrect === false) {
      newN = 0;
      nextInterval = 1;
    }
    const updated: ReviewItem = {
      ...item,
      n: newN,
      EF: Number(newEF.toFixed(2)),
      interval_days: nextInterval,
      last_reviewed_at: new Date().toISOString(),
      next_review_at: futureDate(nextInterval).toISOString(),
    };
    MOCK_REVIEW_ITEMS[idx] = updated;
    persistMockState();

    // Reveal-on-missed: only when (post-cap) quality is 'missed' AND we
    // have a correctness signal. canonicalAnswer was captured above.
    let revealedCanonical: string | undefined;
    if (
      effectiveQuality === 'missed' &&
      isCorrect !== undefined &&
      isCorrect === false &&
      canonicalAnswer
    ) {
      revealedCanonical = canonicalAnswer;
    }

    const response: SubmitReviewResponse = { item: updated };
    if (isCorrect !== undefined) response.isCorrect = isCorrect;
    if (qualityAdjusted) {
      response.qualityAdjusted = qualityAdjusted;
      response.qualityAdjustedFrom = qualityAdjustedFrom;
    }
    if (revealedCanonical !== undefined) {
      response.canonicalAnswer = revealedCanonical;
    }
    // Streak update (added 2026-08-03): record the day the student completed
    // a review. Side-effect-only; the returned state lives in localStorage
    // and is read by RetentionDashboard / ReviewSession via loadStreak().
    recordReviewToday();
    return response;
  }
  return apiFetch(`/api/spaced-repetition/${studentId}/review`, {
    method: 'POST',
    body: JSON.stringify({ questionId, quality, selectedOptionIndices, numericAnswer }),
  });
}

/**
 * Skip a review card whose question isn't findable in the mock set.
 * Added 2026-07-31 as the second half of the missing-question
 * fail-open flow (see also ReviewSession.tsx's MISSING_QUESTION_RESPONSE
 * sentinel + amber "Question unavailable" card).
 *
 * Mock behavior: pushes `next_review_at` 30 days into the future and
 * stamps `skipped_at` with the current timestamp. EF / n / interval
 * are intentionally untouched — the student didn't fail; the data is
 * bad. The student-side "due" filter (next_review_at <= now) excludes
 * the item; the teacher-side cohort view still sees it (so they can
 * notice and fix the underlying mock data).
 *
 * Live behavior: the backend doesn't expose this yet. Fail-open:
 * warn in dev and return { ok: true } so the UI flow isn't blocked.
 * The skip will NOT persist across reloads in live mode — callers
 * should treat the live response as best-effort.
 */
export async function skipReview(
  studentId: string,
  questionId: string,
): Promise<{ ok: true }> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 100));
    const idx = MOCK_REVIEW_ITEMS.findIndex(
      i => i.student_id === studentId && i.question_id === questionId,
    );
    if (idx === -1) {
      // Already gone — silent no-op. Refreshing the schedule would
      // have removed it; no need to throw.
      return { ok: true };
    }
    const item = MOCK_REVIEW_ITEMS[idx];
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    MOCK_REVIEW_ITEMS[idx] = {
      ...item,
      next_review_at: new Date(Date.now() + thirtyDays).toISOString(),
      skipped_at: new Date().toISOString(),
    };
    persistMockState();
    return { ok: true };
  }
  // Live path: backend has no skip endpoint. Fail-open so the UI
  // isn't blocked; warn in dev so the gap is visible.
  if (import.meta.env.DEV) {
    console.warn(
      '[spaced-repetition-api] skipReview: live backend has no skip endpoint yet; UI skip will not persist across reloads.',
    );
  }
  return { ok: true };
}

/**
 * Get the full review schedule for a student across all courses.
 * GET /api/spaced-repetition/:studentId/schedule
 */
export async function getSchedule(studentId: string): Promise<ReviewItem[]> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 500));
    // Filter mock data by student so the demo student sees only their own
    // schedule. Mirrors the backend's `find({ student_id })` behaviour.
    // Other mock students (e.g. stu-helper-002) remain in the source array
    // for teacher cohort views on /teacher/spaced-repetition.
    return MOCK_REVIEW_ITEMS.filter(i => i.student_id === studentId);
  }
  return apiFetch(`/api/spaced-repetition/${studentId}/schedule`);
}

/**
 * Get retention health summary for a student in a specific course.
 * GET /api/spaced-repetition/:studentId/course/:courseId
 */
export async function getCourseRetention(
  studentId: string,
  courseId: string,
): Promise<CourseRetentionSummary> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 400));
    // Derive from mock schedule so any courseId yields a realistic summary.
    // Filter by student_id so the demo student only sees their own cards'
    // retention health (not helper students' data leaking in).
    return deriveMockRetention(courseId, studentId);
  }
  return apiFetch(`/api/spaced-repetition/${studentId}/course/${courseId}`);
}

/**
 * Toggle notification opt-out for all items in a course.
 * PATCH /api/spaced-repetition/:studentId/notifications
 */
export async function updateNotificationPreference(
  studentId: string,
  courseId: string,
  optOut: boolean,
): Promise<UpdateOptOutResponse> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 300));
    let count = 0;
    MOCK_REVIEW_ITEMS.forEach((item, idx) => {
      if (item.course_id === courseId) {
        MOCK_REVIEW_ITEMS[idx] = { ...item, notification_opt_out: optOut };
        count++;
      }
    });
    if (count > 0) persistMockState();
    return { updatedCount: count };
  }
  return apiFetch(`/api/spaced-repetition/${studentId}/notifications`, {
    method: 'PATCH',
    body: JSON.stringify({ courseId, optOut }),
  });
}

/**
 * Force a question to be due immediately.
 * POST /api/spaced-repetition/:studentId/boost
 */
export async function boostReview(
  studentId: string,
  questionId: string,
  targetEF?: number,
): Promise<{ boosted: boolean; message: string }> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 300));
    const idx = MOCK_REVIEW_ITEMS.findIndex(
      i => i.student_id === studentId && i.question_id === questionId,
    );
    if (idx === -1) throw new Error('Mock: review item not found for boost');
    // Boost: lower EF (default 1.3 = weakest possible), push next_review_at
    // to now so the student sees the question at the top of the session.
    const newEF = targetEF ?? 1.3;
    MOCK_REVIEW_ITEMS[idx] = {
      ...MOCK_REVIEW_ITEMS[idx],
      EF: newEF,
      n: 0,
      interval_days: 1,
      next_review_at: new Date().toISOString(),
      last_reviewed_at: null,
    };
    persistMockState();
    return { boosted: true, message: `Mock: Boosted question ${questionId}` };
  }
  return apiFetch(`/api/spaced-repetition/${studentId}/boost`, {
    method: 'POST',
    body: JSON.stringify({ questionId, targetEF }),
  });
}

/**
 * Set a remediation hint for a specific question.
 * PATCH /api/spaced-repetition/:studentId/remediation-hint
 *
 * Response mirrors the backend `SetRemediationHintResponse` exactly:
 * `questionId` (the question this hint is attached to),
 * `remediation_hint` (the canonical stored value after this write —
 * identical to the `hint` arg unless the BE applies normalization),
 * `message` (human-readable summary). FE callers today only read
 * `message`; the other two are surfaced for type-honesty and any
 * future "echo back the saved value" UX.
 */
export async function setRemediationHint(
  studentId: string,
  questionId: string,
  hint: string | null,
): Promise<{
  questionId: string;
  remediation_hint: string | null;
  message: string;
}> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 300));
    const idx = MOCK_REVIEW_ITEMS.findIndex(
      i => i.student_id === studentId && i.question_id === questionId,
    );
    if (idx === -1) throw new Error('Mock: review item not found for hint');
    MOCK_REVIEW_ITEMS[idx] = {
      ...MOCK_REVIEW_ITEMS[idx],
      remediation_hint: hint,
    };
    persistMockState();
    return {
      questionId,
      remediation_hint: hint,
      message: `Mock: Hint ${hint ? 'set' : 'cleared'} for ${questionId}`,
    };
  }
  return apiFetch(`/api/spaced-repetition/${studentId}/remediation-hint`, {
    method: 'PATCH',
    body: JSON.stringify({ questionId, hint }),
  });
}

/**
 * Bulk toggle notification opt-out for a cohort.
 * PATCH /api/spaced-repetition/bulk/notifications
 *
 * Returns `BulkUpdateResponse` (Bug 3 fix, 2026-08-01): distinct student
 * count AND item count are reported separately so the teacher UI can
 * say "Updated for 3 students" instead of mislabelling item counts as
 * student counts. See `BulkUpdateResponse` in
 * `spaced-repetition.types.ts` for the full shape rationale.
 */
export async function bulkUpdateNotificationPreference(
  courseId: string,
  studentIds: string[],
  optOut: boolean,
): Promise<BulkUpdateResponse> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 400));
    const studentIdSet = new Set(studentIds);
    const distinctStudentsTouched = new Set<string>();
    let itemsChanged = 0;
    MOCK_REVIEW_ITEMS.forEach((item, idx) => {
      if (item.course_id === courseId && studentIdSet.has(item.student_id)) {
        MOCK_REVIEW_ITEMS[idx] = { ...item, notification_opt_out: optOut };
        distinctStudentsTouched.add(item.student_id);
        itemsChanged++;
      }
    });
    if (itemsChanged > 0) persistMockState();
    const studentsAffected = distinctStudentsTouched.size;
    const trailing =
      itemsChanged !== studentsAffected
        ? ` (${itemsChanged} review item${itemsChanged === 1 ? '' : 's'})`
        : '';
    return {
      updatedCount: itemsChanged,
      studentsAffected,
      itemsAffected: itemsChanged,
      message: `Updated notifications for ${studentsAffected} student${studentsAffected === 1 ? '' : 's'}${trailing}.`,
    };
  }
  return apiFetch(`/api/spaced-repetition/bulk/notifications`, {
    method: 'PATCH',
    body: JSON.stringify({ courseId, studentIds, optOut }),
  }) as unknown as Promise<BulkUpdateResponse>;
}

/**
 * Bulk toggle exam-prep mode for a cohort.
 * PATCH /api/spaced-repetition/bulk/exam-prep
 *
 * Returns `BulkUpdateResponse` (Bug 3 fix, 2026-08-01). See
 * `bulkUpdateNotificationPreference` for the dual-count rationale.
 */
export async function bulkUpdateExamPrepMode(
  courseId: string,
  studentIds: string[],
  enabled: boolean,
): Promise<BulkUpdateResponse> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 400));
    const studentIdSet = new Set(studentIds);
    const distinctStudentsTouched = new Set<string>();
    let itemsChanged = 0;
    MOCK_REVIEW_ITEMS.forEach((item, idx) => {
      if (item.course_id === courseId && studentIdSet.has(item.student_id)) {
        MOCK_REVIEW_ITEMS[idx] = { ...item, exam_prep_mode: enabled };
        distinctStudentsTouched.add(item.student_id);
        itemsChanged++;
      }
    });
    if (itemsChanged > 0) persistMockState();
    const studentsAffected = distinctStudentsTouched.size;
    const trailing =
      itemsChanged !== studentsAffected
        ? ` (${itemsChanged} review item${itemsChanged === 1 ? '' : 's'})`
        : '';
    return {
      updatedCount: itemsChanged,
      studentsAffected,
      itemsAffected: itemsChanged,
      message: `${enabled ? 'Enabled' : 'Disabled'} exam-prep mode for ${studentsAffected} student${studentsAffected === 1 ? '' : 's'}${trailing}.`,
    };
  }
  return apiFetch(`/api/spaced-repetition/bulk/exam-prep`, {
    method: 'PATCH',
    body: JSON.stringify({ courseId, studentIds, enabled }),
  }) as unknown as Promise<BulkUpdateResponse>;
}

/**
 * Per-student wrapper for the exam-prep bulk toggle (added 2026-08-04).
 * The frontend teacher dashboard has a single "Enable/Disable Exam-Prep Mode"
 * button per student (no cohort-wide flow), so we wrap the bulk endpoint
 * with a single-element `studentIds` array. Same backend, cleaner FE API.
 *
 * Backs `PATCH /api/spaced-repetition/bulk/exam-prep` with `studentIds: [studentId]`.
 */
export async function setExamPrepMode(
  studentId: string,
  courseId: string,
  enabled: boolean,
): Promise<BulkUpdateResponse> {
  return bulkUpdateExamPrepMode(courseId, [studentId], enabled);
}

/**
 * Per-student wrapper for the pause bulk toggle (added 2026-08-04).
 * The frontend teacher dashboard has a single "Pause/Resume All Reviews"
 * button per student, so we wrap the bulk endpoint with a single-element
 * `studentIds` array.
 *
 * Backs `PATCH /api/spaced-repetition/bulk/pause` with `studentIds: [studentId]`.
 */
export async function setPaused(
  studentId: string,
  courseId: string,
  paused: boolean,
): Promise<BulkUpdateResponse> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 400));
    const studentIdMatch = studentId;
    const distinctStudentsTouched = new Set<string>();
    let itemsChanged = 0;
    MOCK_REVIEW_ITEMS.forEach((item, idx) => {
      if (item.course_id === courseId && item.student_id === studentIdMatch) {
        MOCK_REVIEW_ITEMS[idx] = { ...item, is_paused: paused };
        distinctStudentsTouched.add(item.student_id);
        itemsChanged++;
      }
    });
    if (itemsChanged > 0) persistMockState();
    const studentsAffected = distinctStudentsTouched.size;
    const trailing =
      itemsChanged !== studentsAffected
        ? ` (${itemsChanged} review item${itemsChanged === 1 ? '' : 's'})`
        : '';
    return {
      updatedCount: itemsChanged,
      studentsAffected,
      itemsAffected: itemsChanged,
      message: `${paused ? 'Paused' : 'Resumed'} reviews for ${studentsAffected} student${studentsAffected === 1 ? '' : 's'}${trailing}.`,
    };
  }
  return apiFetch(`/api/spaced-repetition/bulk/pause`, {
    method: 'PATCH',
    body: JSON.stringify({ courseId, studentIds: [studentId], paused }),
  }) as unknown as Promise<BulkUpdateResponse>;
}

/**
 * Get all unique students who have review schedules for a specific course.
 * GET /api/spaced-repetition/courses/:courseId/students
 */
export async function getCourseStudents(courseId: string): Promise<{ studentIds: string[] }> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 400));
    // Find all unique students in the mock array for this course
    // MOCK_REVIEW_ITEMS uses 'mock-student'
    const students = Array.from(new Set(
      MOCK_REVIEW_ITEMS.filter(i => i.course_id === courseId).map(i => i.student_id)
    ));
    return { studentIds: students };
  }
  return apiFetch(`/api/spaced-repetition/courses/${courseId}/students`);
}

/**
 * List courses the teacher can manage (added 2026-08-03).
 * In mock mode we derive the list from the unique course_ids in
 * MOCK_REVIEW_ITEMS (the teacher's view sees everything with a schedule).
 * Live mode hits GET /api/spaced-repetition/courses which returns courses
 * filtered by instructor ownership.
 */
export async function getCourses(): Promise<TeacherCourseSummary[]> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 300));
    const counts = new Map<string, Set<string>>();
    MOCK_REVIEW_ITEMS.forEach((item) => {
      const set = counts.get(item.course_id) ?? new Set<string>();
      set.add(item.student_id);
      counts.set(item.course_id, set);
    });
    return Array.from(counts.entries()).map(([id, students]) => ({
      id,
      name: courseDisplay(id).name,
      studentCount: students.size,
    }));
  }
  const res = await apiFetch<{ courses: TeacherCourseSummary[] }>(
    '/api/spaced-repetition/courses',
  );
  return res.courses ?? [];
}

/**
 * Rich variant of getCourseStudents (added 2026-08-03).
 * Returns human-readable student info instead of raw IDs. Backward-compat
 * note: getCourseStudents above is unchanged; new UI components consume
 * this rich variant instead.
 */
export async function getCourseStudentsRich(
  courseId: string,
): Promise<{ students: EnrichedStudent[] }> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 400));
    const ids = Array.from(new Set(
      MOCK_REVIEW_ITEMS.filter(i => i.course_id === courseId).map(i => i.student_id),
    ));
    return {
      students: ids.map((id) => {
        const d = studentDisplay(id);
        return { id, name: d.name, email: d.email };
      }),
    };
  }
  const res = await apiFetch<{ students: EnrichedStudent[] }>(
    `/api/spaced-repetition/courses/${courseId}/students-rich`,
  );
  return { students: res.students ?? [] };
}

/**
 * Get a question summary by id (added 2026-08-04).
 * Backs `GET /api/spaced-repetition/questions/:questionId/summary` (Day 2).
 * Used by the teacher dashboard per-card row to show the question body
 * instead of a raw id slice.
 *
 * Mock path: synchronously resolves via `MOCK_QUESTION_DIRECTORY`. The
 * simulated 200ms delay matches the other rich lookups so the loading
 * skeleton shows briefly during demo.
 *
 * Live path: hits the new backend endpoint. The backend returns 404 when
 * the question id doesn't exist; we re-throw so the caller (`useQueries`
 * in the dashboard) can mark the individual card as errored rather than
 * masking the failure.
 */
export async function getQuestionSummary(
  questionId: string,
): Promise<QuestionSummaryResponse> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 200));
    const d = questionDisplay(questionId);
    if (!d) {
      // Mirror the backend 404 contract so the dashboard's per-card
      // error state fires in both mock and live modes.
      throw new Error(`Question ${questionId} not found in mock directory`);
    }
    return {
      question: {
        id: questionId,
        body: d.body,
        type: d.type,
        bankTitles: d.bankTitles,
      },
    };
  }
  return apiFetch<QuestionSummaryResponse>(
    `/api/spaced-repetition/questions/${questionId}/summary`,
  );
}

/**
 * Reset a specific question's review history.
 * POST /api/spaced-repetition/:studentId/reset
 */
export async function resetReview(
  studentId: string,
  questionId: string,
): Promise<{ reset: boolean; message: string }> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 300));
    const idx = MOCK_REVIEW_ITEMS.findIndex(
      i => i.student_id === studentId && i.question_id === questionId,
    );
    if (idx === -1) throw new Error('Mock: review item not found for reset');
    // Reset to seed defaults: weakest possible, due immediately, no hint.
    MOCK_REVIEW_ITEMS[idx] = {
      ...MOCK_REVIEW_ITEMS[idx],
      n: 0,
      EF: 1.3,
      interval_days: 1,
      next_review_at: new Date().toISOString(),
      last_reviewed_at: null,
      remediation_hint: null,
    };
    persistMockState();
    return { reset: true, message: `Mock: Reset history for question ${questionId}` };
  }
  return apiFetch(`/api/spaced-repetition/${studentId}/reset`, {
    method: 'POST',
    body: JSON.stringify({ questionId }),
  });
}

// ── SR-disabled (Knob 6, Phase C, 2026-07-21) ──────────────────────────

/**
 * Per-student SR-disabled flag storage.
 *
 * Lives in its own localStorage key because it is denormalised onto the
 * `users` collection on the backend, not onto `review_items`. Keeping it
 * separate from `vibe_sr_mock_v2` means a teacher disabling SR for a
 * student doesn't dirty the review-items store (and vice versa).
 */
const SR_DISABLED_STORAGE_KEY = 'vibe_sr_disabled_mock_v1';

/** Read the persisted SR-disabled set. */
function loadSRDisabledState(): Set<string> {
  try {
    const raw = localStorage.getItem(SR_DISABLED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((s): s is string => typeof s === 'string'));
  } catch {
    return new Set();
  }
}

/** Persist the SR-disabled set. */
function persistSRDisabledState(set: Set<string>): void {
  try {
    localStorage.setItem(SR_DISABLED_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage may be unavailable (e.g. SSR); fail-open
  }
}

/**
 * Module-level mutable set, hydrated from localStorage on first import.
 * Mirrors the `users.sr_disabled` field on the backend.
 */
const MOCK_SR_DISABLED: Set<string> = loadSRDisabledState();

/**
 * Check whether SR is disabled for a student.
 * GET /api/spaced-repetition/students/:studentId/status
 *
 * In mock mode, reads from the in-memory set hydrated from localStorage.
 */
export async function getStudentSRStatus(
  studentId: string,
): Promise<{ studentId: string; sr_disabled: boolean }> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 80));
    return { studentId, sr_disabled: MOCK_SR_DISABLED.has(studentId) };
  }
  return apiFetch(
    `/api/spaced-repetition/students/${studentId}/status`,
  );
}

/**
 * Enable or disable SR for a student.
 * PATCH /api/spaced-repetition/students/:studentId/sr-disabled
 */
export async function setStudentSRDisabled(
  studentId: string,
  sr_disabled: boolean,
): Promise<{ studentId: string; sr_disabled: boolean; message: string }> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 200));
    if (sr_disabled) {
      MOCK_SR_DISABLED.add(studentId);
    } else {
      MOCK_SR_DISABLED.delete(studentId);
    }
    persistSRDisabledState(MOCK_SR_DISABLED);
    return {
      studentId,
      sr_disabled,
      message: sr_disabled
        ? `Mock: SR disabled for ${studentId}.`
        : `Mock: SR re-enabled for ${studentId}.`,
    };
  }
  return apiFetch(
    `/api/spaced-repetition/students/${studentId}/sr-disabled`,
    {
      method: 'PATCH',
      body: JSON.stringify({ sr_disabled }),
    },
  );
}

/**
 * Bulk enable or disable SR for an array of students.
 * PATCH /api/spaced-repetition/bulk/sr-disabled
 *
 * Returns `BulkUpdateResponse` (Bug 3 fix, 2026-08-01, applied to the
 * 4th bulk endpoint 2026-08-06 by audit R-15): dual-count shape so the
 * teacher UI can say "Disabled SR for 3 students (0 state changes)"
 * instead of the misleading "Disabled SR for 0 students" that the
 * pre-fix `modifiedCount`-only return shape produced when the values
 * were already correct.
 *
 * Mock path: `studentsAffected = studentIds.length`,
 * `itemsAffected = studentIds.length` (mock has no notion of
 * "already-disabled" → always treats each id as a transition).
 */
export async function bulkSetStudentSRDisabled(
  studentIds: string[],
  sr_disabled: boolean,
): Promise<BulkUpdateResponse> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 250));
    for (const id of studentIds) {
      if (sr_disabled) {
        MOCK_SR_DISABLED.add(id);
      } else {
        MOCK_SR_DISABLED.delete(id);
      }
    }
    persistSRDisabledState(MOCK_SR_DISABLED);
    return {
      studentsAffected: studentIds.length,
      itemsAffected: studentIds.length,
      updatedCount: studentIds.length,
      message: sr_disabled
        ? `Mock: SR disabled for ${studentIds.length} student(s) (${studentIds.length} state change${studentIds.length === 1 ? '' : 's'}).`
        : `Mock: SR re-enabled for ${studentIds.length} student(s) (${studentIds.length} state change${studentIds.length === 1 ? '' : 's'}).`,
    };
  }
  return apiFetch(`/api/spaced-repetition/bulk/sr-disabled`, {
    method: 'PATCH',
    body: JSON.stringify({ studentIds, sr_disabled }),
  }) as unknown as Promise<BulkUpdateResponse>;
}

// ── Manual Review Assignment (Knob 7, Phase C, 2026-07-21) ───────────────

/**
 * One entry returned by GET /courses/:courseId/assignable-questions.
 * Mirrors the AssignableQuestionItem backend DTO.
 *
 * `fromCourse: true` flags questions whose bank belongs to the requested
 * course — these are sorted to the top of the picker. `fromCourse: false`
 * entries are cross-bank questions (still allowed per the Knob 7 UX rule
 * locked with Emie).
 */
export type AssignableQuestion = {
  id: string;
  body: string;
  type: string;
  hint: string | null;
  bankIds: string[];
  bankTitles: (string | null)[];
  fromCourse: boolean;
};

/**
 * Knob 8 (Phase D prep, 2026-07-21): Mock correctness catalogue.
 * Maps questionId → indices into the corresponding `MOCK_QUESTIONS[].options[]`
 * array (defined in `ReviewSession.tsx`) that represent the canonical
 * correct answer. Used by `submitReview()` to compute `isCorrect` in
 * mock mode, mirroring the backend's `_evaluateMCQCorrectness`.
 *
 * Numeric/descriptive questions have no correctIndices (they're not
 * MCQs, so the click-feedback UX doesn't apply).
 *
 * Single source of truth for the demo content's correctness:
 *   - mock-question-1 (SML): 'Array' (idx 0), 'Linked List' (1), 'Stack' (3) — linear
 *   - mock-question-2 (SOL): 'O(log n)' (idx 1) — binary search worst case
 *   - mock-question-3 (NUMERIC): no options, n/a
 *   - mock-question-4 (SOL): 'Network' (idx 2) — OSI routing layer
 */
const MOCK_QUESTIONS_CATALOG: Record<
  string,
  {
    type: string;
    correctIndices: number[];
    /**
     * Knob 9 (2026-07-29): short human-readable canonical answer,
     * surfaced only when the student honestly self-reports `missed`
     * (the `reveal-on-missed` affordance). For SELECT_MANY_IN_LOT
     * this is the comma-joined option text; for SELECT_ONE_IN_LOT
     * it's the single correct option text; for NUMERIC_ANSWER it's
     * the numeric string (so we can parseFloat-compare against the
     * student's input).
     */
    correctAnswer: string;
  }
> = {
  'mock-question-1': {
    type: 'SELECT_MANY_IN_LOT',
    correctIndices: [0, 1, 3], // Array, Linked List, Stack
    correctAnswer: 'Array, Linked List, Stack',
  },
  'mock-question-2': {
    type: 'SELECT_ONE_IN_LOT',
    correctIndices: [1], // O(log n)
    correctAnswer: 'O(log n)',
  },
  'mock-question-3': {
    type: 'NUMERIC_ANSWER',
    correctIndices: [],
    correctAnswer: '8',
  },
  'mock-question-4': {
    type: 'SELECT_ONE_IN_LOT',
    correctIndices: [2], // Network
    correctAnswer: 'Network',
  },
};

/**
 * Mock catalogue used when USE_MOCK = true. The four fromCourse entries
 * cover the questions already referenced by MOCK_REVIEW_ITEMS, plus a
 * pair of cross-bank entries to demonstrate the picker tier. Mirrors the
 * backend's `getAssignableQuestions` contract — left in this file rather
 * than ReviewSession.tsx because it's an API mock, not session data.
 */
const MOCK_ASSIGNABLE_QUESTIONS: AssignableQuestion[] = [
  {
    id: 'mock-question-1',
    body: 'Which of the following are linear data structures?',
    type: 'SELECT_MANY_IN_LOT',
    hint: 'Linear means each element has at most one predecessor and one successor.',
    bankIds: ['mock-bank-cs1'],
    bankTitles: ['Mock CS Question Bank'],
    fromCourse: true,
  },
  {
    id: 'mock-question-2',
    body: 'What is the worst-case time complexity of binary search on a sorted array?',
    type: 'SELECT_ONE_IN_LOT',
    hint: 'Divide-and-conquer halves the search space each step.',
    bankIds: ['mock-bank-cs1'],
    bankTitles: ['Mock CS Question Bank'],
    fromCourse: true,
  },
  {
    id: 'mock-question-3',
    body: 'Which sorting algorithm is stable?',
    type: 'SELECT_ONE_IN_LOT',
    hint: 'Stability preserves the relative order of equal elements.',
    bankIds: ['mock-bank-cs1'],
    bankTitles: ['Mock CS Question Bank'],
    fromCourse: true,
  },
  {
    id: 'mock-question-4',
    body: 'What port does DNS use by default?',
    type: 'SELECT_ONE_IN_LOT',
    hint: 'It is an application-layer service running over UDP.',
    bankIds: ['mock-bank-cs1'],
    bankTitles: ['Mock CS Question Bank'],
    fromCourse: true,
  },
  // Cross-bank examples (locked with Emie: cross-bank is allowed, course's
  // banks sorted to top). These use a different bankId/bankTitle so the
  // picker can render a visible "Other banks" section header.
  {
    id: 'mock-question-cross-1',
    body: 'In a relational DB, a foreign key constraint enforces…',
    type: 'SELECT_ONE_IN_LOT',
    hint: 'It links rows across tables.',
    bankIds: ['mock-bank-cross'],
    bankTitles: ['Sample Cross-Bank Collection'],
    fromCourse: false,
  },
  {
    id: 'mock-question-cross-2',
    body: 'What does ACID stand for?',
    type: 'SELECT_MANY_IN_LOT',
    hint: 'Atomicity, Consistency, Isolation, Durability.',
    bankIds: ['mock-bank-cross'],
    bankTitles: ['Sample Cross-Bank Collection'],
    fromCourse: false,
  },
];

/**
 * GET /api/spaced-repetition/courses/:courseId/assignable-questions
 *
 * Returns the question catalogue the teacher assigns from. Sorted so the
 * course's banks come first, then cross-bank entries (the picker tier
 * the Knob 7 UX relies on).
 *
 * In mock mode we ignore courseId entirely — every demo course has the
 * same set of mock questions, and the demo only has one teacher anyway.
 * In live mode this hits the backend.
 */
export async function getAssignableQuestions(
  courseId: string,
): Promise<{ courseId: string; count: number; questions: AssignableQuestion[] }> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 150));
    return {
      courseId,
      count: MOCK_ASSIGNABLE_QUESTIONS.length,
      questions: MOCK_ASSIGNABLE_QUESTIONS,
    };
  }
  return apiFetch(
    `/api/spaced-repetition/courses/${courseId}/assignable-questions`,
  );
}

/**
 * POST /api/spaced-repetition/:studentId/assign
 *
 * Assigns a question manually to a student's next-review queue.
 *
 * Conflict policy: when the (student, question) pair already exists, the
 * backend returns 409. We surface that to the caller as a thrown Error
 * whose `.status === 409` so the UI can swap to the "Boost instead" flow.
 *
 * Mock behaviour: append a new ReviewItem to the local MOCK_REVIEW_ITEMS
 * for the student, mirroring what the backend would persist. Persist the
 * updated state to localStorage so the change survives a reload.
 */
export async function assignReview(args: {
  studentId: string;
  questionId: string;
  courseId: string;
}): Promise<{ item: ReviewItem; autoEnabled: boolean; message: string }> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 200));

    // The mock store keeps every active student schedule in a flat array.
    // Block (student, question) duplicates to mirror the backend's unique
    // (student_id, question_id) index.
    const existing = MOCK_REVIEW_ITEMS.find(
      i =>
        i.student_id === args.studentId &&
        i.question_id === args.questionId,
    );
    if (existing) {
      const err = new Error(
        'A review item already exists for this question. Use Boost to surface it as overdue.',
      ) as Error & { status?: number };
      err.status = 409;
      throw err;
    }

    // If the student was SR-disabled, the mock auto-re-enables (matches
    // the backend behaviour locked with Emie). Mirror it on the mock
    // store so subsequent reads see the new flag.
    const wasDisabled = MOCK_SR_DISABLED.has(args.studentId);
    if (wasDisabled) {
      MOCK_SR_DISABLED.delete(args.studentId);
      persistSRDisabledState(MOCK_SR_DISABLED);
    }

    const inserted: ReviewItem = {
      _id: `mock-assign-${Date.now()}`,
      student_id: args.studentId,
      course_id: args.courseId,
      question_id: args.questionId,
      n: 0,
      EF: 2.5,
      interval_days: 0,
      next_review_at: new Date().toISOString(),
      last_reviewed_at: null,
      remediation_hint: undefined,
      notification_opt_out: false,
      source: 'manual',
    };
    MOCK_REVIEW_ITEMS.push(inserted);
    persistMockState();

    return {
      item: inserted,
      autoEnabled: wasDisabled,
      message: wasDisabled
        ? 'Assigned. Note: SR was disabled for this student; it has been re-enabled to make the assignment actionable.'
        : `Assigned ${args.questionId} to ${args.studentId}'s review queue.`,
    };
  }

  return apiFetch(`/api/spaced-repetition/${args.studentId}/assign`, {
    method: 'POST',
    body: JSON.stringify({
      questionId: args.questionId,
      courseId: args.courseId,
    }),
  });
}
