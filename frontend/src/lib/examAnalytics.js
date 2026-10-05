// Pure, framework-free stats over one exam's attempts, for the teacher-facing
// class analytics view (AnalyticsPage.jsx). Every function here takes plain
// data in and returns plain data out — no React, no fetching — so the whole
// module is straightforward to hand-verify or unit test in isolation.
//
// Correctness/scoring rules are PORTED from ResultPage.jsx's evaluate() and
// recomputeScore() (the single-attempt versions), not reinvented, so these
// cohort-level numbers never silently disagree with the score already shown
// on an individual result page. See evaluateResponse() below for the
// side-by-side mapping from ResultPage's demo-shape logic to the raw API
// attempt shape used here.
//
// One deliberate omission: there is no "average time per question" stat.
// ExamPage.jsx initializes a per-response `timeSpent: 0` field that is never
// updated anywhere else in the codebase — it is always 0, dead data.
// Presenting that as a real number would be fabricating data, so only
// exam-level timing (submittedAt - startedAt per attempt, when both exist)
// is used for anything time-related.

import { computeNegativeMarks } from './examStore.js'

// ─── small stats helpers ──────────────────────────────────────

function mean(values) {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Population variance (divide by N, not N-1) — Cronbach's alpha is defined
// in terms of population variance, so this one helper covers both that and
// the plain "spread of scores" stat.
function populationVariance(values) {
  if (!values.length) return null
  const m = mean(values)
  return mean(values.map((v) => (v - m) ** 2))
}

function stdDev(values) {
  const v = populationVariance(values)
  return v === null ? null : Math.sqrt(v)
}

function round(n, dp = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return null
  const f = 10 ** dp
  return Math.round(n * f) / f
}

// ─── correctness, ported from ResultPage.jsx's evaluate() ────────────────
//
// ResultPage's evaluate(q, r, key) runs on the *demo-shape* response
// ({ selectedOptions, natAnswer }). Real API attempts are normalized into
// that exact shape by ResultPage's own `result` useMemo before evaluate() is
// ever called on them there:
//   selectedOptions: r?.selectedOptionIds || [],
//   natAnswer: r?.natValue ?? "",
// evaluateResponse() below applies the identical comparison rules directly
// to the raw API shape (AttemptResponseItem: selectedOptionIds / natValue),
// so the two are equivalent — just skipping the intermediate remap.
//
// Returns 'correct' | 'wrong' | 'unanswered'.
export function evaluateResponse(question, response, answerKey) {
  if (!answerKey) return 'unanswered'
  if (question.type === 'NAT') {
    const ans = (response?.natValue ?? '').toString().trim()
    if (!ans) return 'unanswered'
    return ans === String(answerKey.correct) ? 'correct' : 'wrong'
  }
  const sel = response?.selectedOptionIds || []
  if (!sel.length) return 'unanswered'
  if (question.type === 'MCQ') {
    const correct = Array.isArray(answerKey.correct) ? answerKey.correct[0] : answerKey.correct
    return sel[0] === correct ? 'correct' : 'wrong'
  }
  // MSQ
  const a = [...sel].sort().join(',')
  const b = [].concat(answerKey.correct).sort().join(',')
  return a === b ? 'correct' : 'wrong'
}

// Marks actually earned/lost on one question in one attempt — mirrors
// ResultPage.jsx's recomputeScore() per-question branch (score += q.marks on
// correct, score -= neg on wrong, 0 on unanswered), reusing the same
// computeNegativeMarks(exam, question) helper recomputeScore calls, not a
// reimplementation of it.
function scoreContribution(exam, question, response, answerKey) {
  const status = evaluateResponse(question, response, answerKey)
  if (status === 'correct') return Number(question.marks) || 0
  if (status === 'wrong') return -computeNegativeMarks(exam, question)
  return 0
}

// ─── shape helpers ─────────────────────────────────────────────

function responseMap(attempt) {
  return new Map((attempt.responses || []).map((r) => [r.questionId, r]))
}

// One row per unique question id: exam.questions order first (so the item
// table matches the exam's current question order), then any question that
// only shows up in older attempt snapshots (e.g. since deleted from the
// exam), in first-seen order.
function collectQuestionOrder(exam, attempts) {
  const ids = []
  const seen = new Set()
  for (const q of exam?.questions || []) {
    if (!seen.has(q.id)) {
      seen.add(q.id)
      ids.push(q.id)
    }
  }
  for (const a of attempts) {
    for (const q of a.questions || []) {
      if (!seen.has(q.id)) {
        seen.add(q.id)
        ids.push(q.id)
      }
    }
  }
  return ids
}

// First question snapshot found for a given id — checked against the live
// exam first, then each attempt in order — used for question metadata
// (text/type/topic/marks/options). Per spec these should be identical across
// attempts since they're snapshots of the same exam question; this just
// doesn't crash if two attempts somehow disagree.
function findQuestionMeta(questionId, exam, attempts) {
  const fromExam = (exam?.questions || []).find((q) => q.id === questionId)
  if (fromExam) return fromExam
  for (const a of attempts) {
    const q = (a.questions || []).find((qq) => qq.id === questionId)
    if (q) return q
  }
  return null
}

// ─── cohort score percentages ───────────────────────────────────

// One entry per attempt whose totalMarks is a usable (>0) denominator —
// attempts with totalMarks 0/undefined are excluded here (would otherwise be
// a NaN or Infinity percentage) but are still counted in the overall `n`.
function scorePercentages(attempts) {
  return attempts
    .filter((a) => (a.totalMarks || 0) > 0)
    .map((a) => (a.score / a.totalMarks) * 100)
}

const HISTOGRAM_BUCKET_COUNT = 10 // 10 buckets of 10 percentage points, 0-100

function buildScoreDistribution(pctValues) {
  const buckets = Array.from({ length: HISTOGRAM_BUCKET_COUNT }, (_, i) => ({
    bucketStart: i * 10,
    bucketEnd: i * 10 + 10,
    count: 0,
  }))
  let clampedLow = 0
  let clampedHigh = 0
  for (const pct of pctValues) {
    // Negative marking can drop an attempt's percentage below 0; a score
    // above totalMarks (percentage above 100) shouldn't happen but isn't
    // worth crashing over. Clamp into the end buckets rather than dropping
    // the attempt, and report how many were clamped so the UI can note it.
    if (pct < 0) clampedLow += 1
    if (pct > 100) clampedHigh += 1
    const clamped = Math.min(Math.max(pct, 0), 99.999)
    const idx = Math.min(HISTOGRAM_BUCKET_COUNT - 1, Math.floor(clamped / 10))
    buckets[idx].count += 1
  }
  return { buckets, clampedLow, clampedHigh }
}

// ─── Cronbach's alpha ────────────────────────────────────────────

function computeCronbachAlpha(exam, attempts, questionIds) {
  const n = attempts.length
  const k = questionIds.length
  if (n < 10 || k < 2) {
    return { value: null, n, k, reason: 'Needs at least 10 attempts and 2 questions' }
  }

  // itemScores[qIndex][attemptIndex] = marks earned/lost on that question in
  // that attempt (0 if that attempt's snapshot doesn't include the question
  // at all — e.g. it was added to the exam after that attempt was taken).
  const itemScores = questionIds.map((qid) =>
    attempts.map((a) => {
      const q = (a.questions || []).find((qq) => qq.id === qid)
      if (!q) return 0
      const r = responseMap(a).get(qid)
      const key = a.answers?.[qid]
      return scoreContribution(exam, q, r, key)
    })
  )

  const itemVariances = itemScores.map((row) => populationVariance(row))
  const totalScores = attempts.map((_, attemptIdx) =>
    itemScores.reduce((sum, row) => sum + row[attemptIdx], 0)
  )
  const totalVariance = populationVariance(totalScores)

  if (!totalVariance) {
    return { value: null, n, k, reason: 'No score variance across attempts — alpha is undefined' }
  }

  const sumItemVariance = itemVariances.reduce((a, b) => a + b, 0)
  const alpha = (k / (k - 1)) * (1 - sumItemVariance / totalVariance)
  return { value: round(alpha, 3), n, k, reason: null }
}

// Standard rule-of-thumb bands for Cronbach's alpha.
export function alphaInterpretation(alpha) {
  if (alpha === null || alpha === undefined) return null
  if (alpha < 0.5) return 'poor internal consistency'
  if (alpha < 0.7) return 'questionable internal consistency'
  if (alpha < 0.8) return 'acceptable internal consistency'
  if (alpha < 0.9) return 'good internal consistency'
  return 'excellent internal consistency'
}

// ─── discrimination index (upper-lower 27%) ──────────────────────

const DISCRIMINATION_MIN_N = 10
const DISCRIMINATION_GROUP_FRACTION = 0.27

// Ranks attempts (that have a usable totalMarks) by overall percentage score
// and returns the top/bottom 27% groups — shared across every item's D so
// the sort only happens once. `reason` is set (and top/bottom empty) when
// there aren't enough ranked attempts for a meaningful split.
function buildDiscriminationGroups(attempts) {
  const ranked = attempts
    .map((a) => ({ attempt: a, pct: (a.totalMarks || 0) > 0 ? (a.score / a.totalMarks) * 100 : null }))
    .filter((x) => x.pct !== null)

  if (ranked.length < DISCRIMINATION_MIN_N) {
    return {
      groupSize: 0,
      top: [],
      bottom: [],
      n: ranked.length,
      reason: 'Needs at least 10 scoreable attempts for a meaningful top/bottom 27% split',
    }
  }

  ranked.sort((a, b) => b.pct - a.pct)
  const groupSize = Math.max(1, Math.round(ranked.length * DISCRIMINATION_GROUP_FRACTION))
  return {
    groupSize,
    top: ranked.slice(0, groupSize).map((x) => x.attempt),
    bottom: ranked.slice(-groupSize).map((x) => x.attempt),
    n: ranked.length,
    reason: null,
  }
}

function computeDiscrimination(groups, questionId) {
  if (groups.reason) return { value: null, reason: groups.reason }
  const rate = (group) => {
    const withQ = group.filter((a) => (a.questions || []).some((q) => q.id === questionId))
    if (!withQ.length) return null
    const correct = withQ.filter((a) => {
      const q = a.questions.find((qq) => qq.id === questionId)
      const r = responseMap(a).get(questionId)
      const key = a.answers?.[questionId]
      return evaluateResponse(q, r, key) === 'correct'
    }).length
    return correct / withQ.length
  }
  const topRate = rate(groups.top)
  const bottomRate = rate(groups.bottom)
  if (topRate === null || bottomRate === null) {
    return { value: null, reason: 'Question not present in the top/bottom attempt groups' }
  }
  return { value: round(topRate - bottomRate, 3), reason: null }
}

// ─── option/distractor breakdown ──────────────────────────────────

function buildOptionBreakdown(question, attempts, n) {
  if (question.type !== 'MCQ' && question.type !== 'MSQ') return null
  const correctSet = new Set([].concat(question.correctOptions || []))
  return (question.options || []).map((opt) => {
    let count = 0
    for (const a of attempts) {
      const r = responseMap(a).get(question.id)
      if (r?.selectedOptionIds?.includes(opt.id)) count += 1
    }
    return {
      optionId: opt.id,
      text: opt.text,
      isCorrect: correctSet.has(opt.id),
      count,
      pct: n > 0 ? round((count / n) * 100, 1) : 0,
    }
  })
}

// ─── per-item stats ─────────────────────────────────────────────

function computeItemStats(exam, attempts, questionIds, discriminationGroups) {
  const n = attempts.length
  return questionIds
    .map((qid) => {
      const question = findQuestionMeta(qid, exam, attempts)
      if (!question) return null // defensive; shouldn't happen

      let answeredCount = 0
      let correctCount = 0
      for (const a of attempts) {
        const r = responseMap(a).get(qid)
        const key = a.answers?.[qid]
        const q = (a.questions || []).find((qq) => qq.id === qid) || question
        const status = evaluateResponse(q, r, key)
        if (status !== 'unanswered') answeredCount += 1
        if (status === 'correct') correctCount += 1
      }

      const difficulty =
        n > 0 ? { raw: round(correctCount / n, 3), pct: round((correctCount / n) * 100, 1) } : null

      return {
        questionId: qid,
        questionText: question.questionText,
        type: question.type,
        topic: (question.topic || '').trim() || null,
        marks: question.marks,
        negativeMarks: question.negativeMarks,
        n,
        answeredCount,
        correctCount,
        difficulty,
        discrimination: computeDiscrimination(discriminationGroups, qid),
        optionBreakdown: buildOptionBreakdown(question, attempts, n),
      }
    })
    .filter(Boolean)
}

// ─── per-topic cohort stats ────────────────────────────────────

// Skips the whole block (returns null) when NO question in the exam has a
// topic set — same "don't show a meaningless single bucket" rule
// ResultPage.jsx's computeTopicBreakdown already uses for a single attempt.
function computeTopicStats(items) {
  const hasAnyTopic = items.some((it) => it.topic)
  if (!hasAnyTopic) return null

  const byTopic = new Map()
  for (const it of items) {
    const topic = it.topic || 'Other'
    const entry = byTopic.get(topic) || { topic, questionCount: 0, sumDifficultyPct: 0, questionsWithData: 0 }
    entry.questionCount += 1
    if (it.difficulty) {
      entry.sumDifficultyPct += it.difficulty.pct
      entry.questionsWithData += 1
    }
    byTopic.set(topic, entry)
  }

  return Array.from(byTopic.values())
    .map((entry) => ({
      topic: entry.topic,
      questionCount: entry.questionCount,
      meanCorrectPct:
        entry.questionsWithData > 0 ? round(entry.sumDifficultyPct / entry.questionsWithData, 1) : null,
    }))
    .sort((a, b) => a.topic.localeCompare(b.topic))
}

// ─── time taken ─────────────────────────────────────────────────

function computeTimeTaken(attempts) {
  const minutes = attempts
    .filter(
      (a) =>
        typeof a.startedAt === 'number' &&
        typeof a.submittedAt === 'number' &&
        a.submittedAt > a.startedAt
    )
    .map((a) => (a.submittedAt - a.startedAt) / 60000)

  if (!minutes.length) return null
  return { meanMinutes: round(mean(minutes), 1), medianMinutes: round(median(minutes), 1), n: minutes.length }
}

// ─── main entry point ─────────────────────────────────────────────

// Everything AnalyticsPage needs, computed once from (exam, attempts). Never
// throws on n=0 — every stat degrades to null/empty rather than NaN/Infinity.
export function computeExamAnalytics(exam, attempts) {
  const list = attempts || []
  const n = list.length
  const pctValues = scorePercentages(list)

  const passingMarks = Number(exam?.passingMarks) || 0
  const passCount = passingMarks > 0 ? list.filter((a) => a.score >= passingMarks).length : 0
  const passRate =
    passingMarks > 0 && n > 0
      ? { rate: round(passCount / n, 3), count: passCount, n }
      : null

  const questionIds = collectQuestionOrder(exam, list)
  const discriminationGroups = buildDiscriminationGroups(list)
  const items = computeItemStats(exam, list, questionIds, discriminationGroups)
  const topics = computeTopicStats(items)

  return {
    n,
    nWithScorePct: pctValues.length,
    mean: pctValues.length ? round(mean(pctValues), 1) : null,
    median: pctValues.length ? round(median(pctValues), 1) : null,
    stdDev: pctValues.length ? round(stdDev(pctValues), 1) : null,
    min: pctValues.length ? round(Math.min(...pctValues), 1) : null,
    max: pctValues.length ? round(Math.max(...pctValues), 1) : null,
    passRate,
    scoreDistribution: buildScoreDistribution(pctValues),
    timeTaken: computeTimeTaken(list),
    cronbachAlpha: computeCronbachAlpha(exam, list, questionIds),
    items,
    topics,
  }
}
