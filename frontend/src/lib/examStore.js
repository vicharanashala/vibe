import { mockExam, mockQuestions, mockAnswers } from './mockExam.js'

const DEFAULT_SCHEME = {
  MCQ: 'one_third',   // 'none' | 'one_third' | 'one_fourth' | 'full' | 'custom'
  MSQ: 'none',
  NAT: 'none',
}

export function computeNegativeMarks(exam, question) {
  // Per-question override wins when explicitly enabled
  if (question?.useCustomNegative) return Number(question.negativeMarks) || 0

  const scheme = exam?.negativeMarkingScheme?.[question.type] ?? DEFAULT_SCHEME[question.type] ?? 'none'
  const m = Number(question.marks) || 0
  switch (scheme) {
    case 'one_third':  return +(m / 3).toFixed(4)
    case 'one_fourth': return +(m / 4).toFixed(4)
    case 'full':       return m
    case 'custom':     return Number(question.negativeMarks) || 0
    case 'none':
    default:           return 0
  }
}

// Still used client-side by the demo exam's extra-time-code flow (see
// ExamPage.jsx) — the demo is never managed through the admin UI, so it can
// never actually have a grant issued, but the redeem/validate logic lives
// alongside the exam data it validates against.
export function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O or 1/I confusion
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function buildDemoExam() {
  const questions = mockQuestions.map((q) => {
    const key = mockAnswers[q.id]
    const correct = key ? (Array.isArray(key.correct) ? key.correct : [key.correct]) : []
    return {
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      questionImage: undefined,
      options: q.options ?? [],
      correctOptions: correct,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      useCustomNegative: false,
      natAnswerType: q.natAnswerType,
    }
  })
  return {
    id: 'demo',
    title: mockExam.title,
    duration: mockExam.duration,
    passingMarks: mockExam.passingMarks,
    negativeMarking: mockExam.negativeMarking,
    negativeMarkingScheme: { ...DEFAULT_SCHEME },
    instructions: mockExam.instructions,
    published: true,
    revealAnswers: false,
    createdAt: 0,
    updatedAt: 0,
    questions,
    timeGrants: [],
  }
}

// The one exam that is always available, 100% client-side, with zero
// backend dependency — see the "Frontend" section of the exam-module
// migration plan. Everything else (teacher-created exams, attempt history)
// now goes through `@/lib/api/exams` + `@/hooks/exam-hooks`.
export const DEMO_EXAM = buildDemoExam()
