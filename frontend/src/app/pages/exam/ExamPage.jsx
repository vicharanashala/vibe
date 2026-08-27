import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Palette } from '@/components/exam/Palette'
import { QuestionRenderer } from '@/components/exam/QuestionRenderer'
import { Calculator } from '@/components/exam/Calculator'
import ExamProctoring from '@/components/exam/ExamProctoring'
import { DEMO_EXAM, computeNegativeMarks } from '@/lib/examStore'
import { useExamSecurity } from '@/lib/useExamSecurity'
import { useExam, useSubmitAttempt, useRedeemTimeGrant, useMyAttempts } from '@/hooks/exam-hooks'
import { useAuthStore } from '@/store/auth-store'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

// Leaving the exam window/tab this many times auto-submits the attempt
// instead of just warning.
const MAX_TAB_SWITCHES = 3

// Exact 403 messages thrown by AttemptService.submitAttempt for the
// scheduling window / retake-limit checks — matched by substring so extra
// server-side context wrapped around them still counts as a known block.
const SUBMIT_BLOCK_MESSAGES = [
  'This exam is not open yet',
  'This exam is now closed',
  'You have already attempted this exam',
]

// Black/white is the primary palette. Orange is kept only as a thin accent
// (active-tab underline, links, hover states) rather than large fills —
// wall-to-wall orange badges/bars read as too much of one color.
const INK = '#111827'
const ACCENT = '#F0A93B'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function CountdownDisplay({ initialSeconds, onExpire }) {
  const [s, setS] = useState(initialSeconds)

  // Keep the latest onExpire without making it an effect dependency (it's a
  // new arrow function on every parent render, which would otherwise force
  // the interval effect below to tear down and restart every render).
  const onExpireRef = useRef(onExpire)
  useEffect(() => { onExpireRef.current = onExpire }, [onExpire])

  // One steady interval that only restarts when crossing the expired
  // boundary (not on every single tick, which the old `[s, onExpire]`
  // dependency caused). Calling setS with a plain updater keeps this free
  // of side effects, so it's safe even if React invokes the updater more
  // than once (e.g. under StrictMode double-invoke checks).
  useEffect(() => {
    if (s <= 0) return
    const id = setInterval(() => setS((prev) => Math.max(0, prev - 1)), 1000)
    return () => clearInterval(id)
  }, [s <= 0])

  // Fire onExpire exactly once, as a real effect, when the countdown
  // reaches zero - not buried inside the setState updater above.
  useEffect(() => {
    if (s === 0) onExpireRef.current?.()
  }, [s])

  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const display = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  // aria-label carries the accessible name ("Time remaining: HH:MM:SS")
  // instead of the raw digits, so a screen reader announces it with
  // context rather than reading the monospace string digit-by-digit. This
  // is intentionally NOT an aria-live region — announcing every single
  // second would be unusable noise; the label just updates silently for
  // whenever the control is actually focused/queried.
  return (
    <span role="timer" aria-label={`Time remaining: ${display}`}>
      {display}
    </span>
  )
}

// Outer component: decides whether this is the always-available, 100%
// client-side demo exam (id 'demo') or a real exam that has to be fetched
// from the backend, and only mounts the actual test-taking UI
// (ExamPageInner) once a full exam document is available. Splitting it this
// way keeps ExamPageInner's hooks (useState initializers that read
// `examData.questions` synchronously on mount) safe to write against a
// guaranteed-loaded exam, instead of juggling "maybe still loading" in every
// one of them.
export default function ExamPage() {
  const navigate = useNavigate()
  const { examId } = useParams()
  const isDemo = examId === 'demo'
  const { data: fetchedExam, isLoading } = useExam(isDemo ? undefined : examId)
  // Only actually needed for the retake-limit check below, but fetched
  // unconditionally (isDemo included) rather than gated behind examData
  // being loaded first, so it's ready by the time that check runs instead
  // of showing the exam UI for a beat then yanking it away once attempts
  // resolve.
  const { data: myAttempts } = useMyAttempts()
  const examData = isDemo ? DEMO_EXAM : fetchedExam

  if (!isDemo && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">Loading test…</p>
      </div>
    )
  }

  const hasExam = !!(examData && examData.questions && examData.questions.length > 0)
  if (!hasExam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-bold">Test not available</h1>
          <p className="text-sm text-muted-foreground">
            This test does not exist or has no questions yet.
          </p>
          <button
            onClick={() => navigate('/')}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Back to home
          </button>
        </div>
      </div>
    )
  }

  // Scheduling window is enforced server-side at submit time regardless of
  // this check (see AttemptService.submitAttempt) — this just stops a
  // student from starting/answering a test that can only end in a rejected
  // submission with no warning. The demo exam never has opensAt/closesAt so
  // it's unaffected.
  const now = Date.now()
  if (!isDemo) {
    if (examData.closesAt !== undefined && examData.closesAt !== null && now > examData.closesAt) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
          <div className="max-w-md space-y-3">
            <h1 className="text-2xl font-bold">This test has closed</h1>
            <p className="text-sm text-muted-foreground">
              This test closed at {new Date(examData.closesAt).toLocaleString()}. Submissions are no
              longer accepted.
            </p>
            <button
              onClick={() => navigate('/')}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Back to home
            </button>
          </div>
        </div>
      )
    }
    if (examData.opensAt !== undefined && examData.opensAt !== null && now < examData.opensAt) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
          <div className="max-w-md space-y-3">
            <h1 className="text-2xl font-bold">This test isn't open yet</h1>
            <p className="text-sm text-muted-foreground">
              This test opens at {new Date(examData.opensAt).toLocaleString()}. Come back then to start it.
            </p>
            <button
              onClick={() => navigate('/')}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Back to home
            </button>
          </div>
        </div>
      )
    }

    // Retake limit is enforced server-side too (see AttemptService.submitAttempt's
    // SUBMIT_BLOCK_MESSAGES), but that only fires at the very end, after a
    // student has already sat through the whole timed attempt — this stops
    // the exam page from loading at all when there's nothing it could
    // legitimately submit to.
    const priorAttempt = (myAttempts ?? []).find((a) => a.examId === examId)
    if (examData.allowRetakes === false && priorAttempt) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
          <div className="max-w-md space-y-3">
            <h1 className="text-2xl font-bold">Already attempted</h1>
            <p className="text-sm text-muted-foreground">
              This test only allows one attempt, and you've already submitted one.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Back to home
              </button>
              <button
                onClick={() => navigate(`/result/${priorAttempt.id}`)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                View Result
              </button>
            </div>
          </div>
        </div>
      )
    }
  }

  // `key` forces a fresh mount (and fresh internal state) if the route ever
  // switches from one exam id straight to another without an unmount.
  return (
    <ExamPageInner key={examId} examId={examId} isDemo={isDemo} examData={examData} navigate={navigate} />
  )
}

function ExamPageInner({ examId, isDemo, examData, navigate }) {
  const exam = { ...examData, totalMarks: examData.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0) }
  const { user, isAuthenticated } = useAuthStore()

  const submitAttempt = useSubmitAttempt()
  const redeemTimeGrant = useRedeemTimeGrant()

  // Persist the in-progress attempt (question order, responses, elapsed
  // time, etc.) so a refresh/crash rehydrates the SAME attempt instead of
  // starting a new one. sessionStorage (not localStorage) is used on
  // purpose: it survives a refresh of this tab/window, but is cleared once
  // the exam window is closed or submitted, so it can't be used to resume a
  // finished/abandoned attempt later.
  const sessionKey = `exam_session_${examId}`
  const savedSession = (() => {
    try {
      const raw = sessionStorage.getItem(sessionKey)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return null

      // A session belonging to an attempt that was already submitted (or whose
      // timer has already run out) must NOT be resumed - otherwise starting the
      // test again instantly rehydrates the finished attempt and auto-submits,
      // which is what made a retake show "finished" straight away.
      //
      // A session already at/over MAX_TAB_SWITCHES is treated the same way:
      // it means a previous load already tripped the auto-submit effect, and
      // if that submit failed (see handleSubmit's onError), the session is
      // left behind with tabSwitches still at the limit — restoring it as-is
      // re-triggers the auto-submit effect within seconds of opening the
      // exam again, with no chance to see the question UI at all.
      const durationSec = (examData.duration || 0) * 60 + (parsed.extraSeconds || 0)
      const elapsed = Math.floor((Date.now() - (parsed.startedAt || 0)) / 1000)
      if (
        parsed.submitted ||
        !parsed.startedAt ||
        elapsed >= durationSec ||
        (parsed.tabSwitches ?? 0) >= MAX_TAB_SWITCHES
      ) {
        sessionStorage.removeItem(sessionKey)
        return null
      }
      return parsed
    } catch {
      try { sessionStorage.removeItem(sessionKey) } catch {}
      return null
    }
  })()

  // Shuffle questions + options and REMAP option ids to A, B, C... by new
  // position. We keep an old->new id map per question so we can translate the
  // original correctOptions into the new letter ids for scoring, and a
  // reverse map so a submitted attempt can be translated back to the
  // original question/option ids the backend expects.
  const [{ questions, answers, reverseOptionMaps }] = useState(() => {
    if (savedSession?.questions?.length && savedSession?.answers) {
      // Resuming after a refresh — reuse the exact same shuffled order and
      // answer key so numbering, options, and scoring stay consistent.
      return {
        questions: savedSession.questions,
        answers: savedSession.answers,
        reverseOptionMaps: savedSession.reverseOptionMaps || {},
      }
    }
    const shuffledQuestions = shuffle(examData.questions).map((q) => {
      if ((q.type === 'MCQ' || q.type === 'MSQ') && Array.isArray(q.options) && q.options.length) {
        const idMap = {} // originalId -> newLetterId
        const newOptions = shuffle(q.options).map((opt, i) => {
          const newId = LETTERS[i]
          idMap[opt.id] = newId
          return { ...opt, id: newId, label: newId }
        })
        return { ...q, options: newOptions, __idMap: idMap }
      }
      return q
    })

    const answerMap = {}
    const reverseOptionMaps = {}
    for (const q of shuffledQuestions) {
      const orig = examData.questions.find((o) => o.id === q.id)
      if (q.type === 'NAT') {
        answerMap[q.id] = { correct: orig.correctOptions[0] ?? '' }
      } else {
        // translate original option ids -> new letter ids
        const remapped = (orig.correctOptions || []).map((oid) => q.__idMap?.[oid] ?? oid)
        answerMap[q.id] = { correct: remapped }
        if (q.__idMap) {
          const reverse = {}
          for (const [origId, newId] of Object.entries(q.__idMap)) reverse[newId] = origId
          reverseOptionMaps[q.id] = reverse
        }
      }
    }

    // strip helper before handing questions to renderer
    const cleaned = shuffledQuestions.map(({ __idMap, ...rest }) => rest)
    return { questions: cleaned, answers: answerMap, reverseOptionMaps }
  })

  const subjectName = examData.title || ''
  const candidateName = isAuthenticated && user ? (user.name || user.email || 'Candidate') : 'Candidate'
  const candidateRegId = ''
  const headerTitle = examData.headerTitle || 'ViBe'
  const headerSubtitle = examData.headerSubtitle || 'Organizing Institute: Indian Institute of Technology Ropar'
  const leftBadge = examData.leftBadge || 'ViBe'
  const rightBadge = examData.rightBadge || 'IIT Ropar'
  const leftLogo = examData.leftLogo
  const rightLogo = examData.rightLogo

  const [currentIndex, setCurrentIndex] = useState(savedSession?.currentIndex ?? 0)
  const [showCalc, setShowCalc] = useState(false)
  // Offset from the calculator's default docked position (sm:left-8
  // sm:top-24), dragged via its title bar. Reset per exam mount rather than
  // persisted — it's a scratch tool, not exam state worth saving/restoring.
  const [calcOffset, setCalcOffset] = useState({ x: 0, y: 0 })
  const calcDragRef = useRef(null)
  const handleCalcDragStart = (e) => {
    const point = e.touches ? e.touches[0] : e
    calcDragRef.current = { startX: point.clientX, startY: point.clientY, origin: calcOffset }
    const handleMove = (moveEvent) => {
      const movePoint = moveEvent.touches ? moveEvent.touches[0] : moveEvent
      const { startX, startY, origin } = calcDragRef.current
      setCalcOffset({ x: origin.x + (movePoint.clientX - startX), y: origin.y + (movePoint.clientY - startY) })
    }
    const handleEnd = () => {
      calcDragRef.current = null
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleEnd)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleMove)
    window.addEventListener('touchend', handleEnd)
  }
  // Below the `lg` breakpoint the question palette collapses into a
  // toggleable panel under the question (see the "Question Palette" button
  // in the main grid below) instead of sitting beside it — at `lg` and up
  // this is ignored and the palette is always shown via `lg:block`.
  const [showPalette, setShowPalette] = useState(false)
  const [responses, setResponses] = useState(
    savedSession?.responses?.length
      ? savedSession.responses
      : questions.map((q) => ({
          question: q.id,
          selectedOptions: [],
          natAnswer: '',
          isMarkedForReview: false,
          isAnswered: false,
          visited: false,
          timeSpent: 0,
        }))
  )

  const [tabSwitches, setTabSwitches] = useState(savedSession?.tabSwitches ?? 0)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [showTabWarning, setShowTabWarning] = useState(false)
  const [autoSubmitting, setAutoSubmitting] = useState(false)
  // Set when the server rejects a submission for a scheduling/retake reason
  // (see the exact strings AttemptService.submitAttempt throws — checked by
  // substring below since the server message may include extra context).
  const [submitBlockedMessage, setSubmitBlockedMessage] = useState(null)
  // The clock the countdown is measured from. On first load this is "now";
  // on a refresh mid-attempt it's restored from the saved session so the
  // remaining time keeps counting down from where it actually was, instead
  // of resetting to the full duration.
  const startedAtRef = useRef(savedSession?.startedAt ?? Date.now())

  // Camera/mic proctoring: active whenever this exam has a detector enabled
  // (or is the demo, which bakes in a default detector set — see
  // ExamProctoring's DEFAULT_PROCTORING_DETECTORS/isDetectorEnabled). No
  // student-facing consent step — the camera starts as soon as the exam
  // does, same as the course-lesson proctoring flow. The browser's own
  // native "Allow camera access?" permission prompt still appears (that's
  // enforced by the browser itself and can't be skipped by any website),
  // but there's no separate in-app dialog asking the student to opt in.
  const hasProctoring =
    isDemo || (examData.proctoring?.detectors || []).some((d) => d.enabled)

  // Accumulated in a ref (not state) so a proctoring event never triggers a
  // re-render storm — only read when the attempt is actually submitted.
  const proctoringEventsRef = useRef([])
  const handleProctoringEvent = useCallback((type, imageDataUrl) => {
    proctoringEventsRef.current.push({ type, at: Date.now(), imageDataUrl })
  }, [])

  // Driven by ExamProctoring's onBlockingChange: a serious violation (no
  // face / multiple faces / voice detected / camera turned off / face
  // mismatch) blurs the exam content until it clears. The timer below is
  // untouched by this — it has its own interval and keeps counting down
  // through a blur exactly like it does through a plain warning.
  const [proctoringBlocked, setProctoringBlocked] = useState(false)
  const [proctoringBlockReasons, setProctoringBlockReasons] = useState([])
  const handleProctoringBlockingChange = useCallback((isBlocking, reasons) => {
    setProctoringBlocked(isBlocking)
    setProctoringBlockReasons(reasons)
  }, [])

  // Extra-time code redemption (admin can issue a one-time code per exam for
  // students who hit a technical issue; entering it adds bonus minutes here)
  const [extraSeconds, setExtraSeconds] = useState(savedSession?.extraSeconds ?? 0)
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeMsg, setCodeMsg] = useState('')

  const handleRedeemCode = () => {
    // The demo exam is never managed through the admin UI, so it can never
    // actually have a grant issued — the "extra-time code" UI is hidden
    // entirely for it below, so this only ever runs for real exams.
    redeemTimeGrant.mutate(
      { examId, code: codeInput },
      {
        onSuccess: (result) => {
          if (result.ok) {
            setExtraSeconds((s) => s + result.minutes * 60)
            setCodeMsg(`+${result.minutes} min added.`)
            setCodeInput('')
            setTimeout(() => setShowCodeInput(false), 1500)
          } else {
            setCodeMsg(result.error)
          }
        },
        onError: (err) => setCodeMsg(err?.message || 'Could not redeem code'),
      }
    )
  }

  // Keep the saved session in sync with live state so a refresh (or crash)
  // resumes exactly where the candidate left off — same start time, same
  // question order, same answers — rather than granting a fresh timer.
  // Set once the attempt is submitted so nothing re-writes the session key
  // afterwards (a late state update used to resurrect a finished attempt).
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current) return
    try {
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({
          questions,
          answers,
          reverseOptionMaps,
          responses,
          currentIndex,
          tabSwitches,
          extraSeconds,
          startedAt: startedAtRef.current,
        })
      )
    } catch {}
  }, [questions, answers, reverseOptionMaps, responses, currentIndex, tabSwitches, extraSeconds])

  // Fullscreen enforcement + right-click / devtools / copy-paste blocking
  const { isFullscreen, requestFullscreen, isDevToolsOpen } = useExamSecurity(true)

  // DevTools can't actually be closed/blocked by any website (see
  // useExamSecurity.js) — the heuristic there only detects a docked panel.
  // Treated the same as a camera proctoring violation: logged once per
  // absent->present transition, and folded into the same blur overlay below
  // rather than a separate UI, so the response is consistent everywhere.
  const wasDevToolsOpenRef = useRef(false)
  useEffect(() => {
    if (isDevToolsOpen && !wasDevToolsOpenRef.current) {
      proctoringEventsRef.current.push({ type: 'devToolsOpen', at: Date.now() })
    }
    wasDevToolsOpenRef.current = isDevToolsOpen
  }, [isDevToolsOpen])

  useEffect(() => {
    setResponses((prev) => {
      const next = [...prev]
      if (!next[currentIndex]?.visited) {
        next[currentIndex] = { ...next[currentIndex], visited: true }
      }
      return next
    })
  }, [currentIndex])

  useEffect(() => {
    // `visibilitychange` + `document.hidden`, not `window blur`: a same-page
    // native browser dialog (the camera/mic permission prompt ExamProctoring
    // triggers on mount, a fullscreen prompt, undocked DevTools gaining
    // focus, etc.) blurs the window without ever hiding the tab, so a plain
    // blur listener miscounts those as tab-switch violations - three of them
    // firing back-to-back at exam start was enough to hit MAX_TAB_SWITCHES
    // and auto-submit before the candidate ever saw a question. Real
    // tab-switches/app-switches/minimizing all do set document.hidden.
    const onVisibilityChange = () => {
      if (!document.hidden) return
      setTabSwitches((prev) => prev + 1)
      setShowTabWarning(true)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const updateResponse = (update) => {
    setResponses((prev) => {
      const next = [...prev]
      const merged = { ...next[currentIndex], ...update, visited: true }
      merged.isAnswered =
        (merged.selectedOptions && merged.selectedOptions.length > 0) ||
        (merged.natAnswer && merged.natAnswer.length > 0)
      next[currentIndex] = merged
      return next
    })
  }

  const goNext = () => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1))

  // On the last question there's nowhere for "Next" to go, so it opens the
  // review-and-submit popup (counts of answered/marked/not-visited, with a
  // "Keep Reviewing" escape hatch) instead of doing nothing.
  const isLastQuestion = currentIndex === questions.length - 1
  const handleSaveAndNext = () => {
    if (isLastQuestion) setShowSubmitConfirm(true)
    else goNext()
  }
  const handleMarkReviewNext = () => {
    // Toggles rather than always setting true — previously there was no way
    // to unmark a question once flagged short of clearing its whole answer.
    updateResponse({ isMarkedForReview: !responses[currentIndex]?.isMarkedForReview })
    goNext()
  }
  const handleClearResponse = () => {
    // Also resets isMarkedForReview — previously a question that had been
    // marked stayed showing the "marked" color after clearing, even though
    // clearing is meant to reset the question to a clean, unanswered state.
    updateResponse({ selectedOptions: [], natAnswer: '', isAnswered: false, isMarkedForReview: false })
  }

  const handleSubmit = () => {
    if (submittedRef.current) return // guard against double submit (e.g. timer + click)
    submittedRef.current = true

    if (isDemo) {
      try {
        let score = 0
        let correctCount = 0
        responses.forEach((r, i) => {
          const q = questions[i]
          const key = answers[q.id]
          if (!key) return
          // Use the same computeNegativeMarks(exam, q) helper ResultPage.jsx
          // recomputes scores with, instead of reading q.negativeMarks
          // directly - keeps the score saved at submit time consistent with
          // the "live" score shown on the result page, and stops MSQ wrong
          // answers from silently skipping negative marking.
          const neg = computeNegativeMarks(exam, q)
          if (q.type === 'NAT') {
            if ((r.natAnswer || '').trim() === key.correct) { score += q.marks; correctCount++ }
          } else if (q.type === 'MCQ') {
            const sel = (r.selectedOptions || [])[0]
            const correct = Array.isArray(key.correct) ? key.correct[0] : key.correct
            if (sel === correct) { score += q.marks; correctCount++ }
            else if (sel) { score -= neg }
          } else if (q.type === 'MSQ') {
            const sel = [...(r.selectedOptions || [])].sort().join(',')
            const correct = [].concat(key.correct).sort().join(',')
            if (sel.length > 0 && sel === correct) { score += q.marks; correctCount++ }
            else if (sel.length > 0) { score -= neg }
          }
        })

        const attemptId = `local-${Date.now()}`
        const payload = {
          score: Math.max(0, Number(score.toFixed(2))),
          totalMarks: exam.totalMarks,
          correctCount,
          total: questions.length,
          responses,
          questions,
          answers,
          examTitle: exam.title,
          revealAnswers: examData.revealAnswers ?? false,
          examId: examData.id,
          proctoringEvents: proctoringEventsRef.current,
          tabSwitches,
        }

        // Base64 question/option images can blow past the ~5MB localStorage
        // quota. If the full payload does not fit, retry without images.
        // ResultPage.jsx re-hydrates missing images by matching question id
        // (and option text, since option ids get shuffled per-attempt)
        // against the live exam, so they still show up there as long as the
        // exam itself isn't later deleted.
        const key = `result_${attemptId}`
        const stripImages = (p) => ({
          ...p,
          questions: p.questions.map((q) => ({
            ...q,
            questionImage: undefined,
            options: (q.options || []).map((o) => ({ ...o, image: undefined })),
          })),
        })
        let saved = false
        try {
          localStorage.setItem(key, JSON.stringify(payload))
          saved = true
        } catch (e) {
          try {
            localStorage.setItem(key, JSON.stringify(stripImages(payload)))
            saved = true
          } catch (e2) {
            // Last resort: keep the attempt for this tab only so the result
            // page still renders instead of showing "No result found".
            try {
              sessionStorage.setItem(key, JSON.stringify(stripImages(payload)))
              saved = true
            } catch {}
          }
        }
        if (!saved) console.error('Could not persist result payload')

        try { sessionStorage.removeItem(sessionKey) } catch {}

        try {
          const idx = JSON.parse(localStorage.getItem('attempts_index') || '[]')
          idx.unshift({
            attemptId,
            examId: examData.id,
            examTitle: exam.title,
            score: payload.score,
            totalMarks: payload.totalMarks,
            correctCount,
            total: questions.length,
            submittedAt: new Date().toISOString(),
            proctoringFlags: proctoringEventsRef.current.length,
            tabSwitches,
          })
          localStorage.setItem('attempts_index', JSON.stringify(idx.slice(0, 200)))
        } catch {}

        // Leave fullscreen/secure mode before routing so the result page is usable.
        try { if (document.fullscreenElement) document.exitFullscreen() } catch {}

        navigate(`/result/${attemptId}`)
      } catch (err) {
        submittedRef.current = false
        console.error('Submit failed', err)
        alert('Could not submit: ' + (err?.message || err))
      }
      return
    }

    // Real exam: persist through the API. The server independently
    // recomputes the score from its own copy of the exam — it does not
    // trust anything computed client-side. Responses are translated back
    // from the shuffled, per-attempt display ids to the original
    // questionId/option ids the backend knows about.
    const responsesPayload = questions.map((q, i) => {
      const r = responses[i] || {}
      if (q.type === 'NAT') {
        return { questionId: q.id, natValue: r.natAnswer || '' }
      }
      const map = reverseOptionMaps[q.id] || {}
      const selectedOptionIds = (r.selectedOptions || []).map((oid) => map[oid] ?? oid)
      return { questionId: q.id, selectedOptionIds }
    })

    submitAttempt.mutate(
      {
        examId,
        body: {
          responses: responsesPayload,
          tabSwitches,
          startedAt: startedAtRef.current,
          proctoringEvents: proctoringEventsRef.current,
        },
      },
      {
        onSuccess: (attempt) => {
          try { sessionStorage.removeItem(sessionKey) } catch {}
          try { if (document.fullscreenElement) document.exitFullscreen() } catch {}
          navigate(`/result/${attempt.id}`)
        },
        onError: (err) => {
          submittedRef.current = false
          console.error('Submit failed', err)
          const msg = err?.message || ''
          // These are the exact strings AttemptService.submitAttempt throws
          // (403 ForbiddenError) for the scheduling window / retake-limit
          // checks — surface them as-is instead of a generic failure alert,
          // since they're already written to be shown directly to the
          // candidate.
          const isKnownBlock = SUBMIT_BLOCK_MESSAGES.some((m) => msg.includes(m))
          if (isKnownBlock) {
            setShowSubmitConfirm(false)
            setSubmitBlockedMessage(msg)
          } else {
            alert('Could not submit: ' + (msg || err))
          }
        },
      }
    )
  }

  // After MAX_TAB_SWITCHES tab-switches/window-blurs, auto-submit instead of
  // just warning — a fresh effect keyed on `tabSwitches` so `handleSubmit`
  // (declared above) is always the current render's version, not a stale
  // closure from whenever the blur listener below was first attached. A
  // short delay lets the candidate actually read why before being
  // redirected, instead of an instant, unexplained jump to the result page.
  useEffect(() => {
    if (tabSwitches < MAX_TAB_SWITCHES || submittedRef.current) return
    setAutoSubmitting(true)
    const t = setTimeout(() => handleSubmit(), 2000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabSwitches])

  const currentQuestion = questions[currentIndex]
  const remainingSeconds = Math.max(
    0,
    exam.duration * 60 + extraSeconds - Math.floor((Date.now() - startedAtRef.current) / 1000)
  )

  // Same blur overlay used for camera proctoring violations also covers a
  // detected (docked) DevTools panel — one consistent "something's wrong,
  // resolve it, the timer keeps running" response instead of a second UI.
  const isBlurred = proctoringBlocked || isDevToolsOpen
  const blurReasons = isDevToolsOpen
    ? [...proctoringBlockReasons, 'Developer tools detected']
    : proctoringBlockReasons

  const counts = responses.reduce(
    (acc, r) => {
      if (r.isAnswered && r.isMarkedForReview) acc.answeredMarked++
      else if (r.isAnswered) acc.answered++
      else if (r.isMarkedForReview) acc.marked++
      else if (r.visited) acc.notAnswered++
      else acc.notVisited++
      return acc
    },
    { answered: 0, marked: 0, notAnswered: 0, notVisited: 0, answeredMarked: 0 }
  )

  const watermarkSvg = `data:image/svg+xml,%3Csvg width='350' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='50%25' y='50%25' font-size='24' fill='rgba(0,0,0,0.05)' font-family='Arial' font-weight='bold' text-anchor='middle' transform='rotate(-35, 175, 100)'%3E${encodeURIComponent(subjectName + ' ' + candidateRegId)}%3C/text%3E%3C/svg%3E`

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Top brand bar */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-2 py-1 sm:px-4">
        <div className="flex items-center">
          {leftLogo ? (
            <img
              src={leftLogo}
              alt={leftBadge || 'Logo'}
              className="h-9 w-9 rounded object-contain sm:h-12 sm:w-12"
            />
          ) : (
            <div
              className="grid h-9 w-9 place-items-center rounded px-1 text-center text-[9px] font-bold leading-tight text-white sm:h-12 sm:w-12 sm:text-[10px]"
              style={{ backgroundColor: INK }}
            >
              {leftBadge}
            </div>
          )}
        </div>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-sm font-bold uppercase tracking-tight sm:text-lg md:text-xl" style={{ color: INK }}>
            {headerTitle}
          </h1>
          <p className="-mt-1 hidden text-[10px] font-bold uppercase tracking-widest text-gray-500 sm:block">
            {headerSubtitle}
          </p>
        </div>
        <div className="flex items-center">
          {rightLogo ? (
            <img
              src={rightLogo}
              alt={rightBadge || 'Logo'}
              className="h-8 w-8 rounded-full object-contain sm:h-10 sm:w-10"
            />
          ) : (
            <div
              className="grid h-8 w-8 place-items-center rounded-full px-1 text-center text-[8px] font-bold leading-tight text-white sm:h-10 sm:w-10 sm:text-[9px]"
              style={{ backgroundColor: INK }}
            >
              {rightBadge}
            </div>
          )}
        </div>
      </div>

      {/* Subject bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-1 border-b-2 bg-white px-2 py-1 text-xs font-semibold sm:px-4 sm:text-sm"
        style={{ borderColor: ACCENT, color: INK }}
      >
        <span className="truncate">{subjectName} Mock</span>
        <button
          onClick={() => setShowCalc((s) => !s)}
          className="flex min-h-[36px] items-center gap-1 rounded px-1 text-gray-700 transition-colors hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <span className="text-xs">🖩 <span className="hidden sm:inline">Scientific </span>Calculator</span>
        </button>
      </div>

      {/* Sections + timer + candidate. Below `sm` this wraps onto its own
          rows instead of forcing three fixed-width blocks into one
          horizontal strip (which used to clip/overflow on narrow
          viewports) — the `minHeight: 86` desktop measurement is now only
          applied from `sm` up. */}
      <div className="flex flex-none flex-wrap items-stretch border-b border-gray-300 bg-[#F7F7F7] sm:min-h-[86px]">
        <div className="flex min-w-full flex-grow flex-col justify-end sm:min-w-0">
          <div className="px-2 py-1 text-[10px] font-bold uppercase text-gray-600 sm:px-4">Sections</div>
          <div className="flex items-center gap-1 px-2 pb-1 sm:px-4 sm:pb-0">
            <div
              className="rounded-t-md border-t-2 border-x border-gray-300 px-3 py-1.5 text-xs font-bold text-white sm:px-4 sm:py-2 sm:text-sm"
              style={{ borderTopColor: ACCENT, backgroundColor: INK }}
            >
              {subjectName}
            </div>
          </div>
        </div>

        <div className="flex min-w-full flex-wrap items-stretch border-t border-gray-300 bg-white sm:min-w-0 sm:flex-nowrap sm:border-l sm:border-t-0">
          <div className="flex h-full min-w-[130px] flex-1 flex-col justify-center border-r border-gray-300 px-3 py-2 text-right sm:min-w-[170px] sm:flex-none sm:px-6 sm:py-0">
            <span className="mb-1 text-[10px] font-bold uppercase text-gray-500">Time Left:</span>
            <div
              className="text-lg font-extrabold leading-none tracking-tighter sm:text-[22px]"
              style={{ fontFamily: 'monospace', color: INK }}
            >
              <CountdownDisplay key={extraSeconds} initialSeconds={remainingSeconds} onExpire={() => handleSubmit()} />
            </div>
            {/* Time-grant codes are issued through the admin UI against a
                real exam's timeGrants — the demo exam is never manageable
                there, so it can never have a valid code and this affordance
                is hidden for it rather than shown as a permanently-dead
                "Enter a code" box. */}
            {!isDemo && (!showCodeInput ? (
              <button
                onClick={() => setShowCodeInput(true)}
                className="mt-1 text-[10px] font-medium underline hover:brightness-90"
                style={{ color: ACCENT }}
              >
                Have an extra-time code?
              </button>
            ) : (
              <div className="mt-1 flex flex-col items-end gap-1">
                <div className="flex gap-1">
                  <input
  value={codeInput}
  onChange={(e) => setCodeInput(e.target.value)}
  placeholder="CODE"
  className="w-20 rounded px-1 py-0.5 text-[11px] uppercase focus:outline-none"
  style={{
    backgroundColor: '#ffffff',
    color: '#111827',
    border: '1px solid #9ca3af',
    caretColor: '#111827',
  }}
/>

                  <button
                    onClick={handleRedeemCode}
                    className="rounded px-2 py-0.5 text-[11px] font-bold text-white hover:brightness-90"
                    style={{ backgroundColor: INK }}
                  >
                    Apply
                  </button>
                </div>
                {codeMsg && <span className="text-[10px] text-gray-600">{codeMsg}</span>}
              </div>
            ))}
          </div>

          <div className="flex h-full flex-1 items-center gap-3 bg-white px-3 py-2 sm:flex-none sm:px-4 sm:py-0">
            <div className="flex min-w-0 flex-col justify-center">
              <span className="mb-1 text-[10px] font-bold uppercase leading-none text-gray-500">
                Candidate Name:
              </span>
              <span className="truncate text-sm font-bold uppercase leading-tight sm:text-[15px]" style={{ color: INK }}>
                {candidateName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid. Below `lg` the palette collapses into a toggleable
          panel under the question instead of sitting beside it, and this
          whole area scrolls as a normal page — the desktop layout instead
          clips to the viewport height and only the question card scrolls
          internally (see the `lg:overflow-hidden` / `lg:h-full` pair
          below). */}
      <main className="w-full min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:overflow-hidden">
        <div className="mx-auto flex h-auto min-h-full max-w-7xl flex-col gap-4 lg:grid lg:h-full lg:min-h-0 lg:grid-cols-4">
          <div className="flex min-h-0 flex-col gap-2 lg:col-span-3">
            {/* Question type strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 border border-gray-300 bg-white px-3 py-2 text-[13px] shadow-sm sm:px-4">
              <div className="font-bold text-black">
                Question Type: <span className="font-normal">{currentQuestion?.type}</span>
              </div>
              <div className="flex items-center text-gray-700">
                Marks for correct answer:&nbsp;
                <span className="font-bold text-green-700">{currentQuestion?.marks}</span>
                <span className="mx-2 text-gray-400">|</span>
                Negative Marks:&nbsp;
                <span className="font-bold text-red-700">{currentQuestion?.negativeMarks}</span>
              </div>
            </div>

            {/* Question card */}
            <div className="flex min-h-0 flex-1 flex-col border border-gray-300 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-3 py-2 sm:px-4">
                <h2 className="text-[15px] font-bold text-black">
                  Question No. <span>{currentIndex + 1}</span>
                </h2>
              </div>
              <div
                className="relative min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
                style={{
                  backgroundImage: `url("${watermarkSvg}")`,
                  backgroundRepeat: 'repeat',
                }}
              >
                <div className="relative z-10">
                  {currentQuestion && (
                    <QuestionRenderer
                      question={currentQuestion}
                      response={responses[currentIndex] || {}}
                      onChange={updateResponse}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Palette. Below `lg` this is a collapsed-by-default toggle
              panel (so the question itself is what's visible first on a
              phone) instead of a fixed sidebar; the toggle button itself is
              hidden from `lg` up, where the panel is always shown exactly
              like the previous always-visible sidebar. */}
          <div className="flex min-h-0 flex-col lg:col-span-1">
            <button
              type="button"
              onClick={() => setShowPalette((v) => !v)}
              aria-expanded={showPalette}
              aria-controls="exam-palette-panel"
              className="mb-2 flex min-h-[44px] items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:hidden"
            >
              <span>
                Question Palette ({counts.answered + counts.answeredMarked}/{questions.length} answered)
              </span>
              <span aria-hidden="true">{showPalette ? '▲' : '▼'}</span>
            </button>
            <div
              id="exam-palette-panel"
              className={`min-h-0 flex-1 overflow-y-auto ${showPalette ? 'block' : 'hidden'} lg:block`}
            >
              <Palette
                total={questions.length}
                current={currentIndex}
                responses={responses}
                onSelect={(i) => setCurrentIndex(i)}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer bar */}
      <footer className="sticky bottom-0 z-10 flex-none border-t border-gray-300 bg-gray-100 p-3 shadow-lg">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-4 lg:grid-cols-4">
          <div className="flex flex-wrap justify-between gap-2 lg:col-span-3 lg:flex-nowrap lg:border-r lg:border-gray-300 lg:pr-4">
            <div className="flex flex-wrap gap-2">
              <button onClick={handleMarkReviewNext} className="min-h-[44px] rounded-sm border border-gray-300 bg-white px-3 py-2 text-[13px] font-bold text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:px-4">
                {responses[currentIndex]?.isMarkedForReview ? 'Unmark & Next' : 'Mark for Review & Next'}
              </button>
              <button onClick={handleClearResponse} className="min-h-[44px] rounded-sm border border-gray-300 bg-white px-3 py-2 text-[13px] font-bold text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:px-4">
                Clear Response
              </button>
              <button onClick={goPrev} disabled={currentIndex === 0} className="min-h-[44px] rounded-sm border border-gray-300 bg-white px-3 py-2 text-[13px] font-bold text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 sm:px-4">
                &lt;&lt; Previous
              </button>
            </div>
            <div>
              <button
                onClick={handleSaveAndNext}
                className="min-h-[44px] rounded-sm border px-3 py-2 text-[13px] font-bold text-white hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:px-4"
                style={{ borderColor: INK, backgroundColor: INK }}
              >
                {isLastQuestion ? 'Save & Review' : 'Save & Next'}
              </button>
            </div>
          </div>
          <div className="flex justify-center lg:pl-2">
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="min-h-[44px] w-[90%] rounded border py-1.5 text-sm font-bold text-white shadow-sm hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              style={{ borderColor: INK, backgroundColor: INK }}
            >
              Submit
            </button>
          </div>
        </div>
      </footer>

      {/* Floating calculator. Below `sm` this renders as a full-width
          bottom sheet instead of a fixed 380px box — that fixed width used
          to run off the right edge of any phone-width viewport. From `sm`
          up it's back to the original floating box in its original spot. */}
      {showCalc && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] w-full overflow-y-auto rounded-t-xl border border-gray-400 bg-[#dadada] shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-8 sm:top-24 sm:max-h-none sm:w-[380px] sm:rounded-md"
          style={{ transform: `translate(${calcOffset.x}px, ${calcOffset.y}px)` }}
        >
          <div
            className="flex cursor-move items-center justify-between px-3 py-2 text-white select-none sm:py-1.5"
            style={{ backgroundColor: INK }}
            onMouseDown={handleCalcDragStart}
            onTouchStart={handleCalcDragStart}
          >
            <span className="text-sm font-semibold">Scientific Calculator</span>
            <button
              onClick={() => setShowCalc(false)}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="Close calculator"
              className="min-h-[44px] min-w-[44px] rounded text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-h-0 sm:min-w-0"
            >
              ×
            </button>
          </div>
          <div className="p-2">
            <Calculator />
          </div>
        </div>
      )}

      {/* Submit modal — rounded-tile design, matching the Palette look */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="px-6 pb-2 pt-6">
              <h2 className="text-xl font-bold" style={{ color: INK }}>Submit quiz?</h2>
              <p className="mt-1 text-sm text-gray-500">
                Review your progress below before you finish the test.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 px-6 py-5">
              <SummaryTile color="#22C55E" count={counts.answered} label="Answered" />
              <SummaryTile color="#EF4444" count={counts.notAnswered} label="Not Answered" />
              <SummaryTile color="#D1D5DB" textDark count={counts.notVisited} label="Not Visited" />
              <SummaryTile color={INK} count={counts.marked} label="Marked for Review" />
              <SummaryTile
                color={INK}
                accentDot="#22C55E"
                count={counts.answeredMarked}
                label="Answered & Marked (evaluated)"
                span2
              />
            </div>

            <div className="flex justify-end gap-3 bg-gray-50 px-6 py-4">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-100"
              >
                Keep Reviewing
              </button>
              <button
                onClick={() => handleSubmit()}
                disabled={submitAttempt.isPending}
                className="rounded-full px-6 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: ACCENT, color: INK }}
              >
                {submitAttempt.isPending ? 'Submitting…' : 'Submit Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!isFullscreen && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center text-white">
          <h2 className="text-2xl font-bold">Fullscreen required</h2>
          <p className="max-w-md text-sm text-gray-300">
            This test must be taken in fullscreen mode. Exiting fullscreen is recorded.
            Click below to continue your test.
          </p>
          <button
            onClick={requestFullscreen}
            className="rounded px-6 py-2 text-sm font-bold text-black hover:brightness-90"
            style={{ backgroundColor: ACCENT }}
          >
            Enter Fullscreen
          </button>
        </div>
      )}

      {/* aria-live="polite" (not "assertive") — this is a dismissible
          warning, not a blocking/urgent state, so a screen reader should
          announce it without interrupting whatever the candidate is
          currently doing. */}
      {showTabWarning && !autoSubmitting && (
        <div
          className="fixed inset-x-4 bottom-4 z-50 rounded-md bg-red-600 px-4 py-3 text-sm text-white shadow-lg sm:inset-x-auto sm:right-4 sm:w-auto"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">Warning: Tab switching detected ({tabSwitches}/{MAX_TAB_SWITCHES})</p>
          <p className="text-xs">
            {tabSwitches >= MAX_TAB_SWITCHES - 1
              ? 'One more and your test will be auto-submitted.'
              : `After ${MAX_TAB_SWITCHES} switches your test is auto-submitted. It's also logged for the admin.`}
          </p>
          <button onClick={() => setShowTabWarning(false)} className="mt-2 min-h-[44px] text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Reaching MAX_TAB_SWITCHES auto-submits (see the effect right after
          handleSubmit above) — this full-screen notice explains why before
          the redirect to the result page happens, instead of an
          unexplained instant jump. aria-live="assertive" (via role="alert")
          since this is urgent and about to redirect the candidate away. */}
      {autoSubmitting && (
        <div
          className="fixed inset-0 z-[9995] flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center text-white"
          role="alert"
          aria-live="assertive"
        >
          <h2 className="text-2xl font-bold">⚠️ Auto-submitting your test</h2>
          <p className="max-w-md text-sm text-gray-300">
            Tab switching was detected {tabSwitches} times, which reached the {MAX_TAB_SWITCHES}-switch limit.
            Your test is being submitted now.
          </p>
        </div>
      )}

      {/* The server rejected the submission for a scheduling/retake reason
          (exam not open yet / now closed / already attempted with retakes
          off). This blocks answering rather than just showing a dismissible
          alert, since there is nothing further the candidate can do here —
          resubmitting will fail the same way. */}
      {submitBlockedMessage && (
        <div
          className="fixed inset-0 z-[9996] flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center text-white"
          role="alert"
          aria-live="assertive"
        >
          <h2 className="text-2xl font-bold">Submission not accepted</h2>
          <p className="max-w-md text-sm text-gray-300">{submitBlockedMessage}</p>
          <button
            onClick={() => navigate('/')}
            className="rounded px-6 py-2 text-sm font-bold text-black hover:brightness-90"
            style={{ backgroundColor: ACCENT }}
          >
            Back to home
          </button>
        </div>
      )}

      {/* Camera/mic proctoring starts automatically with the exam — no
          student-facing opt-in/opt-out step. The browser's own native
          camera-permission prompt still appears (unavoidable, browser-
          enforced), but there's no extra in-app dialog on top of it. */}
      {hasProctoring && (
        <ExamProctoring
          settings={examData.proctoring}
          onEvent={handleProctoringEvent}
          onBlockingChange={handleProctoringBlockingChange}
        />
      )}

      {/* Proctoring blur: covers the exam content on a serious violation
          (no face / multiple faces / voice detected / camera off / face
          mismatch) so the candidate can't keep answering while out of
          compliance — but the timer is duplicated here at full visibility
          and size, and keeps running exactly as it does in the header,
          because a violation must never cost the candidate time. */}
      {isBlurred && (
        <div
          className="fixed inset-0 z-[9990] flex flex-col items-center justify-center gap-4 bg-black/70 px-6 text-center text-white backdrop-blur-xl"
          role="alert"
          aria-live="assertive"
        >
          <h2 className="text-xl font-bold">⚠️ Proctoring alert</h2>
          <p className="max-w-md text-sm text-gray-200">
            {blurReasons.join(', ')}. The test area is hidden until this clears.
          </p>
          <p className="text-xs text-gray-400">Resolve the issue below — the timer is still running.</p>
          <div className="mt-2 flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Time left</span>
            <div className="font-mono text-3xl font-extrabold tabular-nums" style={{ color: ACCENT }}>
              <CountdownDisplay key={extraSeconds} initialSeconds={remainingSeconds} onExpire={() => handleSubmit()} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryTile({ color, count, label, textDark = false, accentDot, span2 = false }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 ${span2 ? 'col-span-2' : ''}`}
    >
      <div
        className="relative grid h-10 w-10 flex-none place-items-center rounded-lg text-base font-bold"
        style={{ backgroundColor: color, color: textDark ? '#111827' : '#fff' }}
      >
        {count}
        {accentDot && (
          <span
            className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white"
            style={{ backgroundColor: accentDot }}
          />
        )}
      </div>
      <span className="text-sm font-medium leading-tight text-gray-700">{label}</span>
    </div>
  )
}
