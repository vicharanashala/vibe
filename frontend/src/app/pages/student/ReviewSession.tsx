'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Check,
  HelpCircle,
  X,
  Brain,
  Sparkles,
  ChevronRight,
  BookOpen,
  TrendingUp,
  Flame,
  Ban, // Added for SR-disabled empty state (Knob 6, Phase C, 2026-07-21)
  AlertTriangle, // Added for the missing-question fallback card (2026-07-31)
  Lightbulb, // Added for remediation-hint card (Bug 1, 2026-08-01)
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { Link, useSearch } from '@tanstack/react-router';
import {
  useGetSchedule,
  useGetCourseRetention,
  useSubmitReview,
  useGetStudentSRStatus,
  spacedRepetitionKeys,
} from '@/hooks/spaced-repetition-hooks';
// Knob 8b (Phase D prep, 2026-07-22): honest quality gating helper.
// Kept in a separate lib file so it stays pure and unit-testable; this
// component just imports the function.
import { canRateAsGotIt } from '@/lib/spaced-repetition-rating';
import {
  ReviewItem,
  RecallQuality,
} from '@/types/spaced-repetition.types';
import { DEMO_STUDENT_ID, isDemoStudentEmail, skipReview } from '@/lib/spaced-repetition-api';
// Streak badge (added 2026-08-03): reads/writes the daily-review streak in
// localStorage. Update fires inside the useSubmitReview onSuccess callback so
// the badge increments the moment a card is committed.
import { loadStreak, recordReviewToday } from '@/lib/streak';

// ── Local mock question body — replaces GET /api/quizzes/questions/:id/review
// while the backend is offline. Mirrors the ReviewQuestionResponse shape:
// { id, body, type, hint, options[], quizTitle, quizId } per
// vibe_review_question_endpoint_prompt.md.
//
// quizTitle/quizId are best-effort metadata added in 2026-07-08 (quiz-title
// attribution). Backend's `getForReview` resolves the parent quiz via a
// Question → QuestionBanks → Quizzes join and returns the FIRST match. When
// the question isn't referenced by any quiz (orphaned / bank-only), these
// are null and the attribution line falls back to course + question index.

interface ReviewQuestionResponse {
  id: string;
  body: string;
  type: 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT' | 'NUMERIC_ANSWER';
  hint?: string;
  options: string[];
  quizTitle: string | null;
  quizId: string | null;
  /**
   * Knob 8 (Phase D prep, 2026-07-21): indices into `options[]` that
   * represent the canonical correct answer. Used by the frontend to
   * self-check in mock mode (the backend uses the question's solution
   * field directly). Omitted for numeric/descriptive question types.
   *
   * Lives in this file (not shared/spaced-repetition.types.ts) because
   * it's mock-only data; the production code path doesn't expose
   * correctIndices to the frontend at all (security boundary).
   */
  correctIndices?: number[];
  /**
   * Knob 8c (2026-07-29): mock-only canonical answer used for the
   * reveal-on-missed affordance (mirrors backend's
   * `_formatCanonicalAnswer`). For NUMERIC_ANSWER questions this is
   * the canonical numeric value as a string (e.g. `"8"`). For MCQ
   * questions this is the comma-joined text of the correct option(s)
   * (e.g. `"Network"` for single-select, or `"A, B"` for multi).
   *
   * Mock-only: the production code path returns `canonicalAnswer` from
   * the backend's response shape (`SubmitReviewResponse.canonicalAnswer`).
   */
  correctAnswer?: string;
}

// Demo content (2026-07-21): CS fundamentals across all four mock cards so
// the demo has a coherent subject narrative that matches the
// "Demo Spaced Repetition Course" / "Algorithms & Data Structures" course
// labels referenced by RetentionDashboard. Each card exercises a different
// question type so the demo showcases the full UX surface:
//   - mock-question-1 → SELECT_MANY_IN_LOT (multi-select UX)
//   - mock-question-2 → SELECT_ONE_IN_LOT (single-choice UX)
//   - mock-question-3 → NUMERIC_ANSWER   (numeric-input UX)
//   - mock-question-4 → SELECT_ONE_IN_LOT (extra card added so the
//     existing MOCK_REVIEW_ITEMS.mock-item-6 (which references
//     'mock-question-4' from 2026-07-18 teacher-control cohort work)
//     no longer crashes with "No mock question for mock-question-4")
const MOCK_QUESTIONS: Record<string, ReviewQuestionResponse> = {
  'mock-question-1': {
    id: 'mock-question-1',
    body: 'Which of the following are linear data structures?',
    type: 'SELECT_MANY_IN_LOT',
    hint: 'Linear means each element has at most one predecessor and one successor.',
    options: ['Array', 'Linked List', 'Binary Tree', 'Stack'],
    quizTitle: 'Data Structures',
    quizId: 'mock-quiz-1',
    correctIndices: [0, 1, 3], // Array, Linked List, Stack
  },
  'mock-question-2': {
    id: 'mock-question-2',
    body: 'What is the worst-case time complexity of binary search on a sorted array?',
    type: 'SELECT_ONE_IN_LOT',
    hint: 'Divide-and-conquer halves the search space each step.',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    quizTitle: 'Algorithms',
    quizId: 'mock-quiz-1',
    correctIndices: [1], // O(log n)
  },
  'mock-question-3': {
    id: 'mock-question-3',
    body: 'How many bits are in a byte?',
    type: 'NUMERIC_ANSWER',
    hint: 'A nibble is half of this.',
    options: [],
    quizTitle: 'CS Fundamentals',
    quizId: 'mock-quiz-2',
    correctIndices: [], // n/a for numeric
    correctAnswer: '8',
  },
  'mock-question-4': {
    id: 'mock-question-4',
    body: 'Which layer of the OSI model is responsible for routing packets?',
    type: 'SELECT_ONE_IN_LOT',
    hint: 'It sits between Transport and Data Link.',
    options: ['Application', 'Transport', 'Network', 'Data Link'],
    quizTitle: 'Networking & OS',
    quizId: 'mock-quiz-2',
    correctIndices: [2], // Network
    correctAnswer: 'Network',
  },
  // ── Cross-bank entries (Bug 2 fix, 2026-08-01) ─────────────────
  // Teacher's "Manual Reassignment" picker exposes these via
  // MOCK_ASSIGNABLE_QUESTIONS in spaced-repetition-api.ts. When the
  // teacher reassigns one, the resulting ReviewItem carries the
  // question ID, and the student side must be able to render it.
  // Previously these IDs were missing here, so fetchQuestionForReview
  // returned the MISSING_QUESTION_RESPONSE sentinel and the render
  // path showed a "Question unavailable — Skip" card.
  'mock-question-cross-1': {
    id: 'mock-question-cross-1',
    body: 'In a relational DB, a foreign key constraint enforces…',
    type: 'SELECT_ONE_IN_LOT',
    hint: 'It links rows across tables.',
    options: [
      'Uniqueness within a column',
      'Referential integrity across tables',
      'NULL is always allowed',
      'Cascading triggers fire automatically',
    ],
    quizTitle: 'Sample Cross-Bank Collection',
    quizId: 'mock-quiz-cross',
    correctIndices: [1], // Referential integrity across tables
  },
  'mock-question-cross-2': {
    id: 'mock-question-cross-2',
    body: 'What does ACID stand for?',
    type: 'SELECT_MANY_IN_LOT',
    hint: 'Atomicity, Consistency, Isolation, Durability.',
    options: ['Atomicity', 'Consistency', 'Isolation', 'Durability'],
    quizTitle: 'Sample Cross-Bank Collection',
    quizId: 'mock-quiz-cross',
    correctIndices: [0, 1, 2, 3], // All four
  },
};

/**
 * Sentinel returned by `fetchQuestionForReview` when a review item
 * references a question ID that isn't in MOCK_QUESTIONS. The render
 * path detects this (via `question.id === MISSING_QUESTION_ID`) and
 * shows a "Question unavailable — Skip" card with a Skip button
 * that advances to the next item. No throw, no crash.
 *
 * Shape: looks like a single-choice question with one option
 * ("Skip") so the type union is satisfied and any code that reads
 * `options[0]` or `correctIndices[0]` won't NPE. The render layer
 * short-circuits before any of that code runs.
 */
const MISSING_QUESTION_ID = '__missing__';
const MISSING_QUESTION_RESPONSE: ReviewQuestionResponse = {
  id: MISSING_QUESTION_ID,
  body: 'This question is not in the current mock set.',
  type: 'SELECT_ONE_IN_LOT',
  options: ['Skip'],
  quizTitle: null,
  quizId: null,
  correctIndices: [0],
  correctAnswer: 'Skip',
  hint: 'The backend review queue may reference a question the mock layer doesn\u2019t know about. Add it to MOCK_QUESTIONS in ReviewSession.tsx to populate this card.',
};

async function fetchQuestionForReview(
  questionId: string,
): Promise<ReviewQuestionResponse> {
  // TODO Step 14: replace with `api('/api/quizzes/questions/${questionId}/review')`
  // once the backend is wired through openapi-fetch gen-schema.
  await new Promise(r => setTimeout(r, 200));
  const q = MOCK_QUESTIONS[questionId];
  // Fail-open (2026-07-31): if a review item references a question
  // ID that isn't in MOCK_QUESTIONS (e.g. mock-question-cross-2 from
  // spaced-repetition-api.ts's catalogue, or any future ID added
  // to MOCK_REVIEW_ITEMS without a matching MOCK_QUESTIONS entry),
  // we DON'T throw. The previous behavior was a thrown Error that
  // surfaced a toast and crashed the render layer (the
  // question-load-failed reducer case set phase=showing-feedback
  // without a currentQuestion, leaving the page half-rendered).
  //
  // Instead, return MISSING_QUESTION_RESPONSE — a sentinel that the
  // render path can detect and show a "Question unavailable — Skip"
  // card. The reducer stays happy because the shape is type-
  // compatible with ReviewQuestionResponse. The student advances
  // past the broken card with one click instead of getting stuck.
  if (!q) {
    // Honest breadcrumb in dev only — avoids spamming the console
    // during repeated demo reloads.
    if (import.meta.env.DEV) {
      console.warn(
        `[ReviewSession] No mock question for "${questionId}" — rendering fallback card. Add it to MOCK_QUESTIONS in ReviewSession.tsx to fix.`,
      );
    }
    return MISSING_QUESTION_RESPONSE;
  }
  return q;
}

// ── Session state machine ────────────────────────────────────────────────

type Phase =
  | 'loading-schedule'
  | 'loading-question'
  | 'awaiting-response'
  | 'showing-feedback'
  | 'session-complete'
  | 'empty';

interface SessionState {
  phase: Phase;
  dueQueue: ReviewItem[];
  currentIndex: number;
  currentQuestion: ReviewQuestionResponse | null;
  lastResponse: {
    quality: RecallQuality;
    nextReviewAt: string;
    /**
     * Knob 8b (Phase D prep, 2026-07-22): mirrored from the most recent
     * submit response. Drives the `Got it` rate-button gate. Undefined
     * for numeric/descriptive questions, MCQs without selection, or
     * backend fail-open.
     */
    isCorrect?: boolean;
    /**
     * Knob 8c (2026-07-29): true when the server capped the student's
     * quality (e.g. wrong pick + `got_it` → `unsure`). Drives the
     * "downgraded" notice in the feedback panel.
     */
    qualityAdjusted?: boolean;
    /**
     * Knob 8c (2026-07-29): the quality the student claimed before the
     * server cap. Only set when `qualityAdjusted === true`. Today always
     * `"got_it"`.
     */
    qualityAdjustedFrom?: RecallQuality;
    /**
     * Knob 8c (2026-07-29): short human-readable canonical answer,
     * populated ONLY when the (post-cap) quality is `missed` AND the
     * question was objectively gradable. Drives the reveal-on-missed
     * CTA in the feedback panel.
     */
    canonicalAnswer?: string;
  } | null;
  answeredCount: number;
  qualityCounts: Record<RecallQuality, number>;
  /**
   * Knob 8 (Phase D prep, 2026-07-21): indices into `currentQuestion.options[]`
   * the student has clicked but not yet submitted. Reset on every new
   * question load and on advance. For SELECT_ONE_IN_LOT this is 0 or 1
   * element; for SELECT_MANY_IN_LOT it can be many. For numeric
   * questions it's always [].
   */
  selectedOptionIndices: number[];
  /**
   * Knob 8c (2026-07-29): numeric input the student typed for a
   * NUMERIC_ANSWER question. Reset on every new question load and on
   * advance. Only meaningful when the current question is a NAT; for
   * MCQ questions it's an empty string.
   */
  numericAnswerInput: string;
  /**
   * True once the student has clicked at least one option (MCQ only).
   * Captured for the green/red feedback render - we don't reset this on
   * `submit` so the feedback stays visible during the
   * `showing-feedback` phase; only `advance` clears it.
   */
  answeredOption: boolean;
}

type Action =
  | { type: 'schedule-loaded'; items: ReviewItem[] }
  | { type: 'question-loaded'; question: ReviewQuestionResponse }
  | { type: 'question-load-failed' }
  | {
      type: 'submit';
      quality: RecallQuality;
      nextReviewAt: string;
      /** Knob 8b: threaded from the submitReview response so the rate
       * button + keyboard handler can gate `Got it` on a wrong MCQ pick. */
      isCorrect?: boolean;
      /** Knob 8c: server capped the student's quality (wrong pick +
       * `got_it` → `unsure`). Drives the "downgraded" notice. */
      qualityAdjusted?: boolean;
      /** Knob 8c: the quality the student claimed before the cap. */
      qualityAdjustedFrom?: RecallQuality;
      /** Knob 8c: short human-readable canonical answer for the
       * reveal-on-missed affordance. */
      canonicalAnswer?: string;
    }
  | { type: 'advance' }
  | { type: 'restart'; items: ReviewItem[] }
  | { type: 'no-due' }
  /**
   * Knob 8: toggle an MCQ option. For SELECT_ONE_IN_LOT this replaces
   * the current selection with [idx]. For SELECT_MANY_IN_LOT it adds
   * or removes idx from the set. For numeric questions the reducer
   * ignores the action.
   */
  | { type: 'toggle-option'; idx: number }
  /** Knob 8: clear selectedOptionIndices and answeredOption (called on advance / new question). */
  | { type: 'reset-options' }
  /** MSQ commit (2026-07-31): flips `answeredOption` to true when
   *  the student hits the "Confirm selection" button on a
   *  SELECT_MANY_IN_LOT card. SOL cards don't dispatch this —
   *  they auto-commit on first click via `toggle-option`. */
  | { type: 'commit-answer' }
  /** Knob 8c: set the numeric input the student typed for a NAT question. */
  | { type: 'set-numeric-input'; value: string };

const SESSION_CAP = 10;

const PHASE_LABELS: Record<Phase, string> = {
  'loading-schedule': 'Loading your review queue…',
  'loading-question': 'Loading question…',
  'awaiting-response': 'How well did you remember?',
  'showing-feedback': 'Nice work!',
  'session-complete': "That's all for today!",
  empty: 'No reviews due right now.',
};

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'schedule-loaded':
      if (action.items.length === 0) {
        return { ...state, phase: 'empty' };
      }
      return {
        ...state,
        dueQueue: action.items.slice(0, SESSION_CAP),
        phase: 'loading-question',
      };
    case 'question-loaded':
      return {
        ...state,
        currentQuestion: action.question,
        phase: 'awaiting-response',
        // Knob 8: fresh question — no selection yet.
        selectedOptionIndices: [],
        // Knob 8c: reset numeric input for new NAT questions.
        numericAnswerInput: '',
        answeredOption: false,
      };
    case 'question-load-failed':
      return { ...state, phase: 'showing-feedback' };
    case 'submit': {
      // Knob 8c (2026-08-01): when the backend caps a wrong-answer
      // `got_it` to `unsure`, the chip color + description must reflect
      // the EFFECTIVE quality (what was actually recorded for SM-2),
      // not the button the student pressed. Otherwise a downgrade
      // renders the green "Confident and fast" copy despite the
      // student having gotten it wrong. The amber "Downgraded"
      // notice below still surfaces what was originally clicked.
      const effectiveQuality: RecallQuality = action.qualityAdjusted
        ? 'unsure'
        : action.quality;
      const lastResponse: NonNullable<SessionState['lastResponse']> = {
        quality: effectiveQuality,
        nextReviewAt: action.nextReviewAt,
        // Knob 8b: threaded through so the rate-button `Got it` gate
        // and the keyboard-`1` shortcut can read it without an
        // extra fetch.
        isCorrect: action.isCorrect,
      };
      // Knob 8c: pass through integrity + reveal metadata.
      if (action.qualityAdjusted) {
        lastResponse.qualityAdjusted = action.qualityAdjusted;
        lastResponse.qualityAdjustedFrom = action.qualityAdjustedFrom;
      }
      if (action.canonicalAnswer !== undefined) {
        lastResponse.canonicalAnswer = action.canonicalAnswer;
      }
      return {
        ...state,
        lastResponse,
        answeredCount: state.answeredCount + 1,
        qualityCounts: {
          ...state.qualityCounts,
          // Use effectiveQuality so the session summary counts
          // downgrades under the right bucket.
          [effectiveQuality]: state.qualityCounts[effectiveQuality] + 1,
        },
        phase: 'showing-feedback',
        // Knob 8: `answeredOption` stays true so the green/red
        // feedback keeps rendering during `showing-feedback`.
      };
    }
    case 'advance': {
      const next = state.currentIndex + 1;
      if (next >= state.dueQueue.length) {
        return { ...state, phase: 'session-complete' };
      }
      return {
        ...state,
        currentIndex: next,
        currentQuestion: null,
        lastResponse: null,
        phase: 'loading-question',
        // Knob 8: clear MCQ selection for the next question.
        selectedOptionIndices: [],
        answeredOption: false,
      };
    }
    case 'restart':
      return {
        phase: action.items.length === 0 ? 'empty' : 'loading-question',
        dueQueue: action.items.slice(0, SESSION_CAP),
        currentIndex: 0,
        currentQuestion: null,
        lastResponse: null,
        answeredCount: 0,
        qualityCounts: { got_it: 0, unsure: 0, missed: 0 },
        selectedOptionIndices: [],
        answeredOption: false,
        // Knob 9 (2026-07-29): clear NAT input on restart.
        numericAnswerInput: '',
      };
    case 'no-due':
      return { ...state, phase: 'empty' };
    // Knob 8: toggle / replace selection. SOL replaces, SML adds or
    // removes. We read the question type off state.currentQuestion
    // because the action is intentionally minimal (no question payload).
    case 'toggle-option': {
      if (!state.currentQuestion) return state;
      const qType = state.currentQuestion.type;
      if (qType === 'NUMERIC_ANSWER') return state; // not applicable
      if (qType === 'SELECT_ONE_IN_LOT') {
        // Replace selection with the new index (single-choice semantics).
        return {
          ...state,
          selectedOptionIndices: [action.idx],
          answeredOption: true,
        };
      }
      // SELECT_MANY_IN_LOT — toggle membership. We deliberately do
      // NOT flip `answeredOption` here: the student needs to keep
      // toggling options across multiple clicks. `answeredOption`
      // flips to true only when the student explicitly commits via
      // the new "Confirm selection" button (see `commit-answer`),
      // which gates the rate buttons. This is the bug fix for the
      // MSQ review-card lockout (2026-07-31): previously the first
      // click set answeredOption=true, disabling the remaining
      // options and un-gating the rate buttons prematurely.
      const has = state.selectedOptionIndices.includes(action.idx);
      return {
        ...state,
        selectedOptionIndices: has
          ? state.selectedOptionIndices.filter(i => i !== action.idx)
          : [...state.selectedOptionIndices, action.idx],
        // Intentionally NOT setting answeredOption: true here.
      };
    }
    case 'reset-options':
      return {
        ...state,
        selectedOptionIndices: [],
        // Knob 8c: also clear numeric input on advance / new question.
        numericAnswerInput: '',
        answeredOption: false,
      };
    case 'commit-answer':
      // MSQ only: flips `answeredOption` to true when the student
      // explicitly hits the "Confirm selection" button. SOL questions
      // don't dispatch this — they auto-commit on first click.
      // Result: rate buttons un-gate, green/red feedback renders,
      // option buttons lock.
      return { ...state, answeredOption: true };
    case 'set-numeric-input':
      return { ...state, numericAnswerInput: action.value };
    default:
      return state;
  }
}

const initialState: SessionState = {
  phase: 'loading-schedule',
  dueQueue: [],
  currentIndex: 0,
  currentQuestion: null,
  lastResponse: null,
  answeredCount: 0,
  qualityCounts: { got_it: 0, unsure: 0, missed: 0 },
  // Knob 8 (Phase D prep, 2026-07-21): initial MCQ selection state.
  selectedOptionIndices: [],
  // Knob 8c (2026-07-29): initial numeric input.
  numericAnswerInput: '',
  answeredOption: false,
};

// ── Helpers ──────────────────────────────────────────────────────────────

function dayDelta(nextReviewAt: string): number {
  const ms = new Date(nextReviewAt).getTime() - Date.now();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

// Knob 8 (Phase D prep, 2026-07-21): MCQ answer feedback helpers.
//
// The frontend renders three visual states per option AFTER the student
// clicks (i.e. after `answeredOption === true`):
//   - 'correct' (green)  -> the student picked this option AND it was right
//   - 'wrong'   (red)    -> the student picked this option AND it was wrong
//   - 'idle'    (neutral) -> the student did not pick this option
//
// We never reveal which option(s) are correct when the student got it
// wrong - per the 2026-07-21 UX rule. So non-picked options stay
// `idle` regardless of whether they would have been correct.

type OptionFeedback = 'idle' | 'correct' | 'wrong';

function evaluateAnswer(
  selectedIndices: number[],
  correctIndices: number[],
  questionType: 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT' | 'NUMERIC_ANSWER',
): boolean {
  // Same logic as backend's _evaluateMCQCorrectness + the mock
  // submitReview in spaced-repetition-api.ts. Sets compare equal size
  // and mutual membership for SML; single-element match for SOL.
  if (questionType === 'SELECT_ONE_IN_LOT') {
    return (
      selectedIndices.length === 1 &&
      correctIndices.length === 1 &&
      selectedIndices[0] === correctIndices[0]
    );
  }
  if (questionType === 'SELECT_MANY_IN_LOT') {
    if (selectedIndices.length !== correctIndices.length) return false;
    const a = new Set(selectedIndices);
    for (const idx of correctIndices) {
      if (!a.has(idx)) return false;
    }
    return true;
  }
  // Numeric / descriptive: not an MCQ; treat as not-correct via this helper.
  return false;
}

function optionFeedbackFor(
  idx: number,
  selectedIndices: number[],
  correctIndices: number[],
  questionType: 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT' | 'NUMERIC_ANSWER',
): OptionFeedback {
  if (!selectedIndices.includes(idx)) return 'idle';
  // Student picked this one - was it correct?
  return evaluateAnswer(selectedIndices, correctIndices, questionType)
    ? 'correct'
    : 'wrong';
}

/**
 * Map a raw EF (typically 1.3–3.0) to a 0–100 retention health %.
 * Mirrors `efToRetentionPercent` in RetentionDashboard.tsx so the two
 * pages read identically. EF 1.3 → 0, EF 3.0 → 100, clamped.
 */
function efToRetentionPercent(ef: number): number {
  const clamped = Math.max(1.3, Math.min(3.0, ef));
  return Math.round(((clamped - 1.3) / (3.0 - 1.3)) * 100);
}

function retentionBand(percent: number): {
  label: string;
  chipClass: string;
} {
  if (percent >= 75) {
    return { label: 'Strong', chipClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }
  if (percent >= 50) {
    return { label: 'Steady', chipClass: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
  return { label: 'Needs work', chipClass: 'bg-rose-100 text-rose-700 border-rose-200' };
}

/**
 * Pick the dominant course from this session's due queue — i.e. the
 * course_id that appears most often. Single-course sessions return that
 * course; multi-course sessions return the leader with a note.
 */
function dominantCourse(items: ReviewItem[]): {
  courseId: string;
  uniqueCount: number;
} | null {
  if (items.length === 0) return null;
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.course_id, (counts.get(item.course_id) ?? 0) + 1);
  }
  let leaderId = items[0].course_id;
  let leaderCount = 0;
  for (const [courseId, count] of counts) {
    if (count > leaderCount) {
      leaderId = courseId;
      leaderCount = count;
    }
  }
  return { courseId: leaderId, uniqueCount: counts.size };
}

// Friendly course name lookup. Mirrors the dashboard's COURSE_LABELS for the
// mock layer; production will resolve via course-catalog hook.
const COURSE_LABELS: Record<string, string> = {
  'mock-course-1': 'Algebra Foundations',
  'mock-course-2': 'World History 101',
};

function courseLabel(courseId: string): string {
  return COURSE_LABELS[courseId] ?? courseId;
}

// Format raw question IDs for human display. Mock IDs follow the
// `mock-question-N` pattern; unknowns are returned as-is.
function formatQuestionLabel(qid: string): string {
  const match = /^mock-question-(\d+)$/.exec(qid);
  if (match) return `Question ${match[1]}`;
  return qid;
}

// Build the attribution line shown above the question body. Composes:
//   1. Course name (always; required for context)
//   2. Parent quiz title (when backend resolved one — 2026-07-08 backend
//      change to `getForReview` adds `quizTitle`/`quizId` to the response.
//      Resolved via Question → QuestionBanks → Quizzes join; "first quiz"
//      when ambiguous.)
//   3. Question index (only when no quiz title is available — the title
//      is more informative than "Question 3", so we drop the index to
//      avoid line noise.)
function attributionFor(
  item: ReviewItem,
  question: ReviewQuestionResponse | null,
): string {
  const course = courseLabel(item.course_id);
  const quizTitle = question?.quizTitle;
  if (quizTitle) {
    return `From ${course} · ${quizTitle}`;
  }
  return `From ${course} · ${formatQuestionLabel(item.question_id)}`;
}

const QUALITY_META: Record<
  RecallQuality,
  { label: string; icon: typeof Check; chipClass: string; description: string }
> = {
  got_it: {
    label: 'Got it',
    icon: Check,
    chipClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    description: 'Confident and fast — interval compounds.',
  },
  unsure: {
    label: 'Unsure',
    icon: HelpCircle,
    chipClass: 'bg-amber-100 text-amber-700 border-amber-200',
    description: 'Recalled with effort — short bump.',
  },
  missed: {
    label: 'Missed it',
    icon: X,
    chipClass: 'bg-rose-100 text-rose-700 border-rose-200',
    description: "Interval resets — you'll see this tomorrow.",
  },
};

// ── Component ────────────────────────────────────────────────────────────

export default function ReviewSession() {
  const { user } = useAuthStore();
  // See RetentionDashboard for rationale. Demo email -> seeded DEMO_STUDENT_ID.
  const studentId =
    isDemoStudentEmail(user?.email) ? DEMO_STUDENT_ID : (user?.uid ?? '');

  // Intercept the URL parameter to route targeted reviews
  const search = useSearch({ strict: false });
  const targetCourseId = (search as any).courseId as string | undefined;

  const {
    data: schedule,
    isLoading: isScheduleLoading,
    refetch: refetchSchedule,
  } = useGetSchedule(studentId);

  // F3 fix: used by handleRestart to read fresh schedule data after an
  // explicit refetch (TanStack Query's data param hasn't updated yet
  // because React hasn't re-rendered).
  const queryClient = useQueryClient();

  // Knob 6: detect whether this student has SR turned off by a teacher.
  // When true, the review session shows a distinct empty state — no
  // cards to walk, no call to action.
  const { data: srStatus } = useGetStudentSRStatus(studentId);
  const srDisabled = srStatus?.sr_disabled === true;

  const submitReview = useSubmitReview(studentId);

  const [state, dispatch] = useReducer(reducer, initialState);

  // Streak state (added 2026-08-03): shown in the progress header. The mock
  // submitReview also writes to localStorage; this useState mirrors the
  // value so the badge re-renders the moment a card is committed. (Real
  // backend integration would subscribe to a GET /streak endpoint here.)
  const [streak, setStreak] = useState(() => loadStreak());

  // Resolve due items (those whose next_review_at is now or earlier).
  const dueItems = useMemo(() => {
    if (!schedule) return [];
    const now = Date.now();
    
    // 1. Filter out opted-out, future items, skipped, AND non-matching courses
    //    `skipped_at` (2026-07-31) means the student explicitly hit
    //    "Skip" on the fail-open "Question unavailable" card; the
    //    underlying item's next_review_at was pushed 30 days into
    //    the future by skipReview(), but we also filter here as
    //    belt-and-braces in case the push failed or wasn't applied.
    const filtered = schedule.filter(
      item =>
        !item.notification_opt_out &&
        !item.skipped_at &&
        new Date(item.next_review_at).getTime() <= now &&
        (!targetCourseId || item.course_id === targetCourseId)
    );

    // 2. Sort: Exam Prep items FIRST, then chronological
    return filtered.sort((a, b) => {
      if (a.exam_prep_mode && !b.exam_prep_mode) return -1;
      if (!a.exam_prep_mode && b.exam_prep_mode) return 1;
      return new Date(a.next_review_at).getTime() - new Date(b.next_review_at).getTime();
    });
  }, [schedule, targetCourseId]);

  const totalDueCount = dueItems.length;

  // Dominant course for the summary screen. We compute it from the queue
  // captured at session start (state.dueQueue) so the leader is stable
  // even if the schedule refetches mid-session.
  const sessionSummary = useMemo(() => {
    if (state.dueQueue.length === 0) return null;
    return dominantCourse(state.dueQueue);
  }, [state.dueQueue]);

  // Fetch fresh retention for the dominant course once the session is
  // complete — by that point `useSubmitReview` has invalidated the
  // schedule cache, so averageEF reflects post-SM-2 values.
  const retentionQuery = useGetCourseRetention(
    studentId,
    sessionSummary?.courseId ?? '',
  );

  // 1. Boot: load schedule.
  useEffect(() => {
    if (!user) return;
    if (isScheduleLoading) return;
    if (state.phase !== 'loading-schedule') return;
    dispatch({ type: 'schedule-loaded', items: dueItems });
  }, [user, isScheduleLoading, dueItems, state.phase]);

  // 2. When entering a new card, fetch the question body.
  useEffect(() => {
    if (state.phase !== 'loading-question') return;
    const item = state.dueQueue[state.currentIndex];
    if (!item) {
      dispatch({ type: 'no-due' });
      return;
    }
    let cancelled = false;
    fetchQuestionForReview(item.question_id)
      .then(question => {
        if (cancelled) return;
        dispatch({ type: 'question-loaded', question });
      })
      .catch(err => {
        if (cancelled) return;
        toast.error(`Couldn't load question: ${err.message}`);
        dispatch({ type: 'question-load-failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [state.phase, state.dueQueue, state.currentIndex]);

  function handleResponse(quality: RecallQuality) {
    const item = state.dueQueue[state.currentIndex];
    if (!item) return;
    // Knob 8: include the student's MCQ selection so the backend can
    // compute `isCorrect` and we can light up the picked option(s).
    // Empty array for numeric/descriptive questions (no selection).
    const selectedOptionIndices =
      state.selectedOptionIndices.length > 0
        ? state.selectedOptionIndices
        : undefined;
    // Knob 8c: pass through the numeric input for NAT questions. Empty
    // string is treated as "no answer provided" by the service (NAT
    // grader only fires when numericAnswer is a non-empty string).
    const numericAnswer =
      state.currentQuestion?.type === 'NUMERIC_ANSWER'
        ? state.numericAnswerInput
        : undefined;
    submitReview.mutate(
      { questionId: item.question_id, quality, selectedOptionIndices, numericAnswer },
      {
        // Knob 8: backend now returns {item, isCorrect}; previous shape
        // was the bare ReviewItem. Extract via `.item` for the next-review
        // display; `isCorrect` is already reflected in the green/red
        // feedback rendered above (driven by state.selectedOptionIndices).
        onSuccess: updated => {
          dispatch({
            type: 'submit',
            quality,
            nextReviewAt: updated.item.next_review_at,
            // Knob 8b: pass through so the reducer stores it on
            // `lastResponse.isCorrect`. The rate-button `Got it` gate
            // reads this directly.
            isCorrect: updated.isCorrect,
            // Knob 8c: integrity + reveal metadata from the response.
            qualityAdjusted: updated.qualityAdjusted,
            qualityAdjustedFrom: updated.qualityAdjustedFrom,
            canonicalAnswer: updated.canonicalAnswer,
          });
          // Streak update (added 2026-08-03): fire after the dispatch so the
          // badge updates on the same render cycle as the feedback card.
          setStreak(recordReviewToday());
        },
        onError: err => {
          toast.error(
            err instanceof Error
              ? `Couldn't save your response: ${err.message}`
              : "Couldn't save your response.",
          );
        },
      },
    );
  }

  function handleAdvance() {
    dispatch({ type: 'advance' });
  }

  // Fail-open handler (2026-07-31): wired to the amber "Question
  // unavailable" card's Skip button. Calls skipReview() to push
  // next_review_at 30 days into the future and stamp skipped_at,
  // then refetches the schedule and advances the local index. The
  // 3 steps (mutate -> refetch -> advance) are sequential so the
  // next-card display reflects the post-skip state, not the stale
  // snapshot.
  async function handleSkip() {
    const item = state.dueQueue[state.currentIndex];
    if (!item) return;
    try {
      await skipReview(studentId, item.question_id);
    } catch (err) {
      // Fail-open: even if the mutation throws, advance the card so
      // the student isn't stuck on the broken card forever.
      console.warn('[ReviewSession] skipReview threw, advancing anyway:', err);
    }
    await refetchSchedule();
    dispatch({ type: 'advance' });
  }

  async function handleRestart() {
    // F3 fix: refetch first, then read fresh `schedule` from the React
    // Query cache. Without this, we dispatched with the closure-captured
    // `dueItems` snapshot — newly-boosted cards from the same session
    // wouldn't appear in the restart until a full page reload.
    await refetchSchedule();
    const freshSchedule =
      queryClient.getQueryData<ReviewItem[]>(
        spacedRepetitionKeys.schedule(studentId),
      ) ?? [];
    const now = Date.now();
    const freshDue = freshSchedule.filter(
      item =>
        !item.notification_opt_out &&
        new Date(item.next_review_at).getTime() <= now &&
        (!targetCourseId || item.course_id === targetCourseId),
    );
    dispatch({ type: 'restart', items: freshDue });
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────────
  // 1 / 2 / 3 → rate card. Space / Enter / ArrowRight → advance. Disabled
  // when focus is in a text input so future text fields don't break.
  //
  // F6 (audit 2026-07-24): verified clean. Guards in order:
  //   1. Modifier guard — skip when Cmd/Ctrl/Alt held (don't hijack
  //      browser shortcuts).
  //   2. Typing guard — skip when focus is in INPUT/TEXTAREA/SELECT
  //      or a contentEditable element (future text fields won't break).
  //   3. Rate path: phase must be 'awaiting-response', submitReview
  //      must not be pending, MCQ must have an answered option (Knob 8),
  //      and `1` (`got_it`) must pass the honest-quality check (Knob 8b).
  //   4. Advance path: phase must be 'showing-feedback', bounds check
  //      (defensive), and skip if a button is focused so the native
  //      onClick handles it.
  // The dependency array re-registers the effect on phase/index/queue
  // changes; closures capture the latest state values on each run.

  const gotItRef = useRef<HTMLButtonElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    function isTyping(): boolean {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (el as HTMLElement).isContentEditable
      );
    }

    function onKey(e: KeyboardEvent): void {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping()) return;
      const k = e.key;
      // Rate (1/2/3 map to quality)
      if (k === '1' || k === '2' || k === '3') {
        if (state.phase !== 'awaiting-response') return;
        if (submitReview.isPending) return;
        // Knob 8: gate the keyboard shortcuts behind "must answer
        // first" for MCQs, mirroring the rate-button disabled state.
        const isMCQ =
          state.currentQuestion !== null &&
          state.currentQuestion.type !== 'NUMERIC_ANSWER';
        if (isMCQ && !state.answeredOption) return;
        // Knob 8b: gate keyboard `1` (`got_it`) on the same honest-quality
        // rule as the button. Mirrors the disabled state so the
        // shortcut doesn't bypass the gate. `2` and `3` are unaffected.
        if (
          k === '1' &&
          !canRateAsGotIt(
            state.currentQuestion?.type,
            state.lastResponse?.isCorrect,
          )
        ) {
          return;
        }
        e.preventDefault();
        handleResponse(
          k === '1' ? 'got_it' : k === '2' ? 'unsure' : 'missed',
        );
        return;
      }
      // Advance (Space/Enter/ArrowRight). Don't double-fire on Space when
      // the Next button itself has focus — the browser will handle it via
      // the button's native onClick.
      if (k === ' ' || k === 'Enter' || k === 'ArrowRight') {
        if (state.phase !== 'showing-feedback') return;
        if (state.currentIndex + 1 > state.dueQueue.length) return; // redundant guard
        // Skip if a button is focused (let the native button handle it)
        if (
          document.activeElement &&
          (document.activeElement as HTMLElement).tagName === 'BUTTON'
        )
          return;
        e.preventDefault();
        handleAdvance();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // handleResponse and handleAdvance close over current state/props — they
    // capture the latest values each time `state` changes (the effect
    // re-registers). submitReview.isPending is read directly so mutates
    // during the same tick will not double-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.currentIndex, state.dueQueue.length]);

  // ── Focus management ────────────────────────────────────────────────

  useEffect(() => {
    // When a new card lands and we're ready for a response, drop focus on
    // the rating button so keyboard users can hit 1/2/3 immediately.
    if (state.phase === 'awaiting-response') {
      gotItRef.current?.focus();
    } else if (state.phase === 'showing-feedback') {
      nextRef.current?.focus();
    } else if (state.phase === 'session-complete') {
      // No-op — Refresh button is the only call to action and may not be
      // needed for the user's flow. Leaving focus where it is.
    }
  }, [state.phase]);

  // ── Render guards ────────────────────────────────────────────────────

  if (!user) {
    return (
      <Card className="max-w-xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>Review session</CardTitle>
          <CardDescription>Sign in to start a review session.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (state.phase === 'loading-schedule') {
    return (
      <Card className="max-w-xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" /> Review session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────

  if (state.phase === 'empty') {
    // Race guard: the schedule query drives both the reducer's transition
    // to `empty` and the total schedule length we use here. If the query
    // hasn't settled yet, render a skeleton rather than flashing the wrong
    // empty state (e.g. "all caught up" at a brand-new student).
    if (isScheduleLoading) {
      return (
        <div className="max-w-xl mx-auto mt-8">
          <Skeleton className="h-40 w-full" />
        </div>
      );
    }

    const hasNoScheduleAtAll = !schedule || schedule.length === 0;

    if (hasNoScheduleAtAll) {
      // Knob 6: when SR has been disabled by a teacher for this student,
      // surface a distinct empty state that names the cause and offers no
      // CTA. Precedes the brand-new-student branch so the right message
      // shows even when both conditions hold.
      if (srDisabled) {
        return (
          <Card className="max-w-xl mx-auto mt-8 border-2 border-dashed border-amber-300/60 bg-gradient-to-br from-amber-50/40 via-background to-background">
            <CardContent className="flex flex-col items-center gap-4 py-12 px-6 text-center">
              <div className="rounded-full bg-amber-100 p-4 ring-1 ring-amber-300/40 dark:bg-amber-950/40 dark:ring-amber-700/40">
                <Ban className="h-8 w-8 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-base font-semibold tracking-tight">
                  Spaced repetition is paused for your account
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your teacher has disabled this for you. If you’d like it
                  re-enabled, please reach out to them directly.
                </p>
              </div>
            </CardContent>
          </Card>
        );
      }

      // Brand-new student: mirror the dashboard's empty state so the two
      // pages render consistently. Same Card styling, icon, copy, and CTA.
      return (
        <Card className="max-w-xl mx-auto mt-8 border-2 border-dashed border-muted/60 bg-gradient-to-br from-muted/30 via-background to-background">
          <CardContent className="flex flex-col items-center gap-4 py-12 px-6 text-center">
            <div className="rounded-full bg-primary/10 p-4 ring-1 ring-primary/20">
              <BookOpen className="h-8 w-8 text-primary" aria-hidden="true" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-base font-semibold tracking-tight">
                No review schedules yet
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Complete a quiz in any course and we'll automatically seed a
                spaced-repetition schedule for the questions you attempted.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link
                to="/student/courses"
                aria-label="Browse courses to start learning"
              >
                Browse courses
                <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    // Existing student with a schedule but nothing currently due.
    return (
      <Card className="max-w-xl mx-auto mt-8 border-emerald-200/60 bg-emerald-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            You're all caught up
          </CardTitle>
          <CardDescription>
            No reviews due right now. We'll ping you when the next one unlocks.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // ── Session complete ─────────────────────────────────────────────────

  if (state.phase === 'session-complete') {
    const moreRemaining = Math.max(0, totalDueCount - state.answeredCount);
    const gotItCount = state.qualityCounts.got_it;
    const unsureCount = state.qualityCounts.unsure;
    const missedCount = state.qualityCounts.missed;

    // Retention readout for the dominant course (only when the course
    // retention summary is available — `averageEF` is undefined while the
    // mock-first API is warming up).
    const retentionPercent =
      retentionQuery.data && typeof retentionQuery.data.averageEF === 'number'
        ? efToRetentionPercent(retentionQuery.data.averageEF)
        : null;
    const retentionBandInfo =
      retentionPercent == null ? null : retentionBand(retentionPercent);

    const multiCourseNote =
      sessionSummary && sessionSummary.uniqueCount > 1
        ? `Top of ${sessionSummary.uniqueCount} courses this session`
        : null;

    return (
      <Card className="max-w-xl mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" /> Session complete
          </CardTitle>
          <CardDescription>
            You reviewed {state.answeredCount} card
            {state.answeredCount === 1 ? '' : 's'} today.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Headline score */}
          <div className="text-center">
            <div className="text-5xl font-extrabold tracking-tight">
              {gotItCount}
              <span className="text-2xl text-muted-foreground font-semibold">
                {' / '}{state.answeredCount}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              remembered confidently
            </p>
          </div>

          {/* Quality breakdown */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
              <div className="text-lg font-bold text-emerald-700">
                {gotItCount}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-emerald-700/80">
                Got it
              </div>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
              <div className="text-lg font-bold text-amber-700">
                {unsureCount}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-amber-700/80">
                Unsure
              </div>
            </div>
            <div className="rounded-md border border-rose-200 bg-rose-50 p-2">
              <div className="text-lg font-bold text-rose-700">
                {missedCount}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-rose-700/80">
                Missed
              </div>
            </div>
          </div>

          {/* Retention readout (per dominant course) */}
          {retentionPercent != null && sessionSummary && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TrendingUp
                    className="h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                  Retention on {courseLabel(sessionSummary.courseId)}
                </div>
                {retentionBandInfo && (
                  <Badge
                    variant="outline"
                    className={retentionBandInfo.chipClass}
                  >
                    {retentionBandInfo.label}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Your retention on this course is now{' '}
                <strong className="text-foreground">{retentionPercent}%</strong>.
              </p>
              <Progress
                value={retentionPercent}
                className="h-2"
                aria-label={`Retention health ${retentionPercent} percent`}
              />
              {multiCourseNote && (
                <p className="text-[11px] text-muted-foreground">
                  {multiCourseNote}
                </p>
              )}
            </div>
          )}

          {moreRemaining > 0 ? (
            <p className="text-sm text-muted-foreground">
              <strong>{moreRemaining}</strong> more waiting for you tomorrow.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing else waiting — see you at the next unlock.
            </p>
          )}
          <Button onClick={handleRestart} variant="outline" className="w-full">
            Refresh schedule
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Active card phase ────────────────────────────────────────────────

  const item = state.dueQueue[state.currentIndex];
  const question = state.currentQuestion;
  const progress =
    state.dueQueue.length === 0
      ? 0
      : ((state.currentIndex + 1) / state.dueQueue.length) * 100;

  return (
    <div className="max-w-2xl mx-auto mt-6 space-y-4">
      {/* Progress header */}
      <Card>
        <CardContent className="py-4 space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Card {state.currentIndex + 1} of {state.dueQueue.length}
            </span>
            <div className="flex items-center gap-3">
              {/* Streak badge (added 2026-08-03; made always-visible 2026-08-03
                  after Emie reported "nothing's visible" — the previous
                  count>0 guard hid the badge until the first review of the
                  day, which made the feature feel invisible. Now shows
                  either a "Start your streak today!" CTA when count=0 or
                  the active count when >0. 🔥 emoji at text-sm (14px) on
                  bg-orange-100 — high contrast vs the prior bg-orange-50
                  that nearly hid the small Lucide Flame outline. */}
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  streak.count > 0
                    ? 'bg-orange-100 border-orange-300 text-orange-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
                title={
                  streak.count > 0
                    ? `Last review: ${streak.lastDate ?? 'unknown'} (Asia/Kolkata)`
                    : 'Complete a review today to start your streak'
                }
                aria-label={
                  streak.count > 0
                    ? `${streak.count} day review streak`
                    : 'No active streak yet'
                }
              >
                <span aria-hidden="true">{streak.count > 0 ? '🔥' : '✨'}</span>
                {streak.count > 0
                  ? `${streak.count} day${streak.count === 1 ? '' : 's'}`
                  : 'Start your streak today!'}
              </span>
              <span>
                {totalDueCount > state.dueQueue.length
                  ? `${totalDueCount - state.dueQueue.length} more tomorrow`
                  : 'Last card in queue'}
              </span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Question card */}
      <Card className="min-h-[280px]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="uppercase tracking-wide">
                {question?.type.replace(/_/g, ' ') ?? '…'}
              </Badge>
              {item?.exam_prep_mode && (
                <Badge className="bg-amber-100 hover:bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0 h-5 border border-amber-200 flex items-center gap-1">
                  <Flame className="h-3 w-3" /> Priority
                </Badge>
              )}
            </div>
            {item && (
              <span
                className="text-xs text-muted-foreground inline-flex items-center gap-1"
                aria-label={`Question origin: ${attributionFor(item, question)}`}
              >
                <BookOpen className="h-3 w-3" aria-hidden="true" />
                {attributionFor(item, question)}
              </span>
            )}
          </div>
          {state.phase === 'loading-question' || !question ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-6 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <CardTitle className="text-lg leading-relaxed pt-2">
              {question.body}
            </CardTitle>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Fail-open (2026-07-31): if fetchQuestionForReview returned
              the missing-question sentinel, show a Skip card instead of
              the option list. The student clicks Skip to advance past
              the broken card — the rest of the session continues
              normally. Triggered by any review item whose question_id
              isn't in MOCK_QUESTIONS (e.g. mock-question-cross-2 from
              the spaced-repetition catalogue, or any future ID added
              to MOCK_REVIEW_ITEMS without a matching MOCK_QUESTIONS
              entry). */}
          {question?.id === MISSING_QUESTION_ID && (
            <div
              className="rounded-lg border border-amber-300/60 bg-amber-50/60 dark:border-amber-700/40 dark:bg-amber-950/20 p-4 space-y-3"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className="h-4 w-4 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium">Question unavailable</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    This card references a question the demo mock set
                    doesn’t know about. The original review queue entry
                    is still on file — only the local demo data is
                    missing.
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { void handleSkip(); }}
                className="w-full"
              >
                Skip and continue
              </Button>
            </div>
          )}
          {question && question.id !== MISSING_QUESTION_ID && question.options.length > 0 && (
            // Knob 8 (Phase D prep, 2026-07-21): MCQ option list is now
            // interactive. Each option is a `<button type="button">` that
            // dispatches `toggle-option`. After `answeredOption === true`
            // (i.e. the student has clicked at least one option) the
            // picked option(s) light up green (correct) or red (wrong);
            // non-picked options stay neutral. Per the 2026-07-21 UX
            // rule, we never reveal the correct option to the student
            // when they got it wrong - non-picked options stay idle even
            // when they would have been correct.
            <div className="space-y-2" role="group" aria-label="Answer options">
              {question.options.map((opt, idx) => {
                const letter = String.fromCharCode(65 + idx); // A, B, C, D
                const isSelected = state.selectedOptionIndices.includes(idx);
                const isMulti =
                  question.type === 'SELECT_MANY_IN_LOT';
                const feedback = state.answeredOption
                  ? optionFeedbackFor(
                      idx,
                      state.selectedOptionIndices,
                      question.correctIndices ?? [],
                      question.type,
                    )
                  : 'idle';
                // Map feedback -> Tailwind classes.
                const baseIdle =
                  'border-border bg-muted/30 hover:bg-muted/50';
                const baseSelected =
                  'border-sky-500 bg-sky-50 ring-1 ring-sky-200';
                const baseCorrect =
                  'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200';
                const baseWrong =
                  'border-rose-500 bg-rose-50 ring-2 ring-rose-200';
                const visualClass =
                  feedback === 'correct'
                    ? baseCorrect
                    : feedback === 'wrong'
                    ? baseWrong
                    : isSelected
                    ? baseSelected
                    : baseIdle;
                return (
                  <button
                    key={`${question.id}-${idx}`}
                    type="button"
                    onClick={() =>
                      dispatch({ type: 'toggle-option', idx })
                    }
                    disabled={state.answeredOption}
                    aria-pressed={isSelected}
                    aria-label={`Option ${letter}: ${opt}`}
                    data-feedback={feedback}
                    className={`w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-default ${visualClass}`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                        feedback === 'correct'
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : feedback === 'wrong'
                          ? 'bg-rose-500 text-white border-rose-500'
                          : isSelected
                          ? 'bg-sky-500 text-white border-sky-500'
                          : 'bg-background'
                      }`}
                    >
                      {feedback === 'correct' ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : feedback === 'wrong' ? (
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        letter
                      )}
                    </span>
                    <span className="text-sm flex-1">{opt}</span>
                    {isMulti && isSelected && feedback === 'idle' && (
                      <span
                        className="ml-auto h-5 w-5 rounded border-2 border-sky-500 bg-sky-500 flex items-center justify-center"
                        aria-hidden="true"
                      >
                        <Check className="h-3 w-3 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {question && question.type === 'NUMERIC_ANSWER' && (
            <div className="mt-3 flex items-center gap-2">
              <label
                htmlFor="numeric-input"
                className="text-sm text-muted-foreground"
              >
                Your answer:
              </label>
              <input
                id="numeric-input"
                type="text"
                inputMode="decimal"
                value={state.numericAnswerInput}
                onChange={e =>
                  dispatch({
                    type: 'set-numeric-input',
                    value: e.target.value,
                  })
                }
                disabled={state.answeredOption}
                placeholder="e.g. 8"
                aria-label="Numeric answer input"
                className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          )}

          {state.phase === 'showing-feedback' && state.lastResponse && (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={`mt-4 rounded-md border p-3 ${
                QUALITY_META[state.lastResponse.quality].chipClass
              }`}
            >
              <div className="text-sm font-medium">
                Next review in {dayDelta(state.lastResponse.nextReviewAt)} day
                {dayDelta(state.lastResponse.nextReviewAt) === 1 ? '' : 's'}.
              </div>
              <div className="text-xs opacity-80 mt-1">
                {QUALITY_META[state.lastResponse.quality].description}
              </div>
              {/* Knob 8c (2026-07-29): server-side integrity notice.
                  Surfaced when the server capped the student's quality
                  (wrong pick + `got_it` → `unsure`). */}
              {state.lastResponse.qualityAdjusted && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900"
                >
                  <strong className="font-semibold">Downgraded:</strong> your
                  pick didn’t match the canonical answer, so we recorded{' '}
                  {state.lastResponse.qualityAdjustedFrom === 'got_it'
                    ? '“Got it” as “Unsure”'
                    : 'your recall quality at “Unsure”'}{' '}
                  for SM-2 scheduling.
                </div>
              )}
              {/* Knob 8c (2026-07-29): reveal-on-missed affordance.
                  Surfaced only when the (post-cap) quality is `missed`
                  AND the question was objectively gradable. */}
              {state.lastResponse.canonicalAnswer && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-2 rounded border border-sky-300 bg-sky-50 px-2 py-1 text-xs text-sky-900"
                >
                  <strong className="font-semibold">Correct answer:</strong>{' '}
                  {state.lastResponse.canonicalAnswer}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action area */}
      <Card>
        <CardContent className="py-4">
          {state.phase === 'awaiting-response' && (
            <div>
              {/* MSQ commit button (2026-07-31): only rendered for
                  SELECT_MANY_IN_LOT questions while the student is
                  still building their selection. Once they have at
                  least one option picked, "Confirm selection (N
                  chosen)" becomes the bridge to the rate buttons.
                  SOL cards skip this entirely — they auto-confirm on
                  first click via the toggle-option reducer. */}
              {question &&
                question.type === 'SELECT_MANY_IN_LOT' &&
                !state.answeredOption && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => dispatch({ type: 'commit-answer' })}
                    disabled={state.selectedOptionIndices.length === 0}
                    className="mb-3 w-full"
                    aria-label="Confirm multi-select selection"
                  >
                    Confirm selection
                    {state.selectedOptionIndices.length > 0 &&
                      ` (${state.selectedOptionIndices.length} chosen)`}
                  </Button>
                )}
              <p
                id="rating-prompt"
                className="text-sm font-medium text-muted-foreground mb-3"
              >
                {PHASE_LABELS['awaiting-response']}
              </p>
              <div
                className="grid grid-cols-3 gap-2"
                role="group"
                aria-labelledby="rating-prompt"
              >
                <Button
                  ref={gotItRef}
                  variant="outline"
                  aria-label="Rate as Got it (press 1)"
                  aria-keyshortcuts="1"
                  className="flex-col gap-1 h-auto py-3 border-emerald-300 text-emerald-700 hover:bg-emerald-50 focus-visible:ring-emerald-500"
                  onClick={() => handleResponse('got_it')}
                  // Knob 8: rate buttons are disabled until the student
                  // has selected an option for an MCQ question (or
                  // while the mutation is in flight). Numeric questions
                  // don't gate; neither does the empty/disabled phase.
                  //
                  // Knob 8b: when the student's MCQ pick was
                  // definitively wrong (`isCorrect === false`), `Got it`
                  // is also disabled — letting it through would let the
                  // student record a corrupt q=5 signal post-feedback.
                  // `Unsure` and `Missed` stay enabled; honesty wins
                  // over consistency.
                  disabled={
                    submitReview.isPending ||
                    (state.currentQuestion?.type !== 'NUMERIC_ANSWER' &&
                      state.currentQuestion !== null &&
                      !state.answeredOption) ||
                    !canRateAsGotIt(
                      state.currentQuestion?.type,
                      state.lastResponse?.isCorrect,
                    )
                  }
                >
                  <Check className="h-5 w-5" aria-hidden="true" />
                  <span className="font-semibold">Got it</span>
                  <span className="text-[10px] opacity-60 font-normal">1</span>
                </Button>
                <Button
                  variant="outline"
                  aria-label="Rate as Unsure (press 2)"
                  aria-keyshortcuts="2"
                  className="flex-col gap-1 h-auto py-3 border-amber-300 text-amber-700 hover:bg-amber-50 focus-visible:ring-amber-500"
                  onClick={() => handleResponse('unsure')}
                  disabled={
                    submitReview.isPending ||
                    (state.currentQuestion?.type !== 'NUMERIC_ANSWER' &&
                      state.currentQuestion !== null &&
                      !state.answeredOption)
                  }
                >
                  <HelpCircle className="h-5 w-5" aria-hidden="true" />
                  <span className="font-semibold">Unsure</span>
                  <span className="text-[10px] opacity-60 font-normal">2</span>
                </Button>
                <Button
                  variant="outline"
                  aria-label="Rate as Missed it (press 3)"
                  aria-keyshortcuts="3"
                  className="flex-col gap-1 h-auto py-3 border-rose-300 text-rose-700 hover:bg-rose-50 focus-visible:ring-rose-500"
                  onClick={() => handleResponse('missed')}
                  disabled={
                    submitReview.isPending ||
                    (state.currentQuestion?.type !== 'NUMERIC_ANSWER' &&
                      state.currentQuestion !== null &&
                      !state.answeredOption)
                  }
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                  <span className="font-semibold">Missed</span>
                  <span className="text-[10px] opacity-60 font-normal">3</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-3">
                Keyboard: <kbd className="px-1 border rounded">1</kbd>{' '}
                <kbd className="px-1 border rounded">2</kbd>{' '}
                <kbd className="px-1 border rounded">3</kbd> to rate.
                <span className="sr-only">
                  {' '}Press 1 for Got it, 2 for Unsure, 3 for Missed it.
                </span>
              </p>
            </div>
          )}

          {state.phase === 'showing-feedback' && (
            <>
              {/* Bug 1 fix (2026-08-01): remediation hint surfaced to the
                  student. A1 rule: shown ONLY after the student answers
                  incorrectly. Hidden otherwise so the teacher-set hint
                  doesn't bias subsequent attempts (and so a correct
                  first-try doesn't feel like a spoiler).

                  Reads `state.dueQueue[state.currentIndex]?.remediation_hint`
                  — the item the student just failed on. `submitReview` never
                  mutates `remediation_hint` (only SM-2 fields), so the
                  teacher-set value is stable through the review cycle.

                  Style choice: always-visible (no toggle), calm blue card,
                  matching the legacy `ReviewPage.tsx:143-146` pattern. The
                  student has already committed an answer; the hint is now
                  genuinely useful, not a spoiler. */}
              {state.lastResponse?.isCorrect === false &&
                state.dueQueue[state.currentIndex]?.remediation_hint && (
                  <div
                    role="note"
                    aria-label="Teacher-set remediation hint"
                    className="mb-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900"
                  >
                    <div className="flex items-start gap-2">
                      <Lightbulb
                        className="h-4 w-4 mt-0.5 flex-shrink-0 text-sky-600"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-medium mb-1">Need a hint?</p>
                        <p className="text-sky-800">
                          {state.dueQueue[state.currentIndex]?.remediation_hint}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              <Button
                ref={nextRef}
                onClick={handleAdvance}
                className="w-full"
                size="lg"
                aria-label={
                  state.currentIndex + 1 >= state.dueQueue.length
                    ? 'Finish session (press Enter)'
                    : 'Next card (press Enter)'
                }
                aria-keyshortcuts="Enter Space ArrowRight"
              >
                {state.currentIndex + 1 >= state.dueQueue.length
                  ? 'Finish session'
                  : 'Next card'}
                <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          )}

          {state.phase === 'loading-question' && (
            <p className="text-sm text-muted-foreground text-center">
              {PHASE_LABELS['loading-question']}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}