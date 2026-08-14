import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import { fileToDataUrl } from '@/lib/imageUtils'
import { RichText } from '@/components/exam/RichText'
import {
  useExam,
  useUpdateExam,
  useAddQuestion,
  useUpdateQuestion,
  useRemoveQuestion,
  useAddTimeGrant,
  useRemoveTimeGrant,
  useQuestionBank,
  useAddToQuestionBank,
  useRemoveFromQuestionBank,
  useAddQuestionsFromBank,
  useBulkAddQuestions,
} from '@/hooks/exam-hooks'

// Same random-4-digit-string convention used everywhere a question/option id
// is generated client-side (manual "+ Add question" form, CSV bulk import
// rows) — not a real id, just needs to be unique enough within one form
// submission/import batch. The backend replaces it anyway wherever it
// matters (exam question ids, bank entry ids).
const randomQuestionId = () => String(Math.floor(1000 + Math.random() * 9000)) // e.g. 9908

const emptyQuestion = () => {
  const qId = randomQuestionId()
  return {
    id: qId,
    type: 'MCQ',
    questionText: '',
    options: [
      { id: `${qId}_1`, text: '' },
      { id: `${qId}_2`, text: '' },
      { id: `${qId}_3`, text: '' },
      { id: `${qId}_4`, text: '' },
    ],
    correctOptions: [],
    marks: 1,
    negativeMarks: 0,
    useCustomNegative: false,
    natAnswerType: 'integer',
  }
}

// Default GATE-style ratios: MCQ loses 1/3 per mark, MSQ/NAT have none by default.
const defaultNegativeMarkingRatios = {
  MCQ: { num: 1, den: 3 },
  MSQ: { num: 0, den: 1 },
  NAT: { num: 0, den: 1 },
}

function calcNegativeMarks(marks, type, ratios) {
  const r = (ratios && ratios[type]) || defaultNegativeMarkingRatios[type] || { num: 0, den: 1 }
  const den = r.den || 1
  const value = (Number(marks) || 0) * (r.num / den)
  // Keep a sane number of decimals without introducing float noise like 0.6666666666
  return Math.round(value * 1000) / 1000
}

function ratioLabel(r) {
  if (!r || r.num === 0) return 'No negative marking'
  return `−${r.num}/${r.den} per mark`
}

// Generic modal wrapper: backdrop + centered, internally-scrollable panel.
// Lets us surface the "add question" form from anywhere on the page without
// forcing the admin to scroll to the bottom of a long question list.
function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8 sm:items-center">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-3xl rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

export default function EditExamPage() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const { data: exam, isLoading } = useExam(examId)
  const [addQuestionOpen, setAddQuestionOpen] = useState(false)
  const [bankPickerOpen, setBankPickerOpen] = useState(false)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [bankNotice, setBankNotice] = useState(null)
  const updateExam = useUpdateExam()
  const addQuestion = useAddQuestion()
  const addToBank = useAddToQuestionBank()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-muted-foreground">Test not found.</p>
          <Link to="/admin" className="text-sm text-primary underline">Back to admin</Link>
        </div>
      </div>
    )
  }

  const totalMarks = exam.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0)
  const negativeMarkingRatios = exam.negativeMarkingRatios ?? defaultNegativeMarkingRatios

  const handleTogglePublish = () => {
    updateExam.mutate({ examId: exam.id, patch: { published: !exam.published } })
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link to="/admin" className="text-xs text-primary underline">← All tests</Link>
            <h1 className="text-2xl font-bold text-foreground">{exam.title}</h1>
            <p className="text-sm text-muted-foreground">
              {exam.questions.length} questions · {totalMarks} marks · {exam.duration} min ·{' '}
              {exam.published ? 'Published' : 'Draft'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAddQuestionOpen(true)}
              className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              + Add question
            </button>
            <button
              onClick={() => setBankPickerOpen(true)}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Add from question bank
            </button>
            <button
              onClick={() => setBulkImportOpen(true)}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Bulk import (CSV)
            </button>
            <Link
              to={`/admin/${exam.id}/attempts`}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              View attempts
            </Link>
            <Link
              to={`/admin/${exam.id}/analytics`}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Analytics
            </Link>
            <button
              onClick={handleTogglePublish}
              disabled={(!exam.published && exam.questions.length === 0) || updateExam.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {exam.published ? 'Unpublish' : 'Publish'}
            </button>
            {exam.published && (
              <button
                onClick={() => navigate(`/exam/${exam.id}`)}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Preview
              </button>
            )}
          </div>
        </header>

        {bankNotice && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {bankNotice}
          </p>
        )}

        <ExamSettings exam={exam} />
        <RevealAnswersSetting exam={exam} />
        <ExamProctoringSettings exam={exam} />
        <ExamScheduleSettings exam={exam} />
        <TimeGrantsSection exam={exam} />
        <ExamHeaderSettings exam={exam} />
        <QuestionsSection exam={exam} negativeMarkingRatios={negativeMarkingRatios} />

        {/* Bottom trigger kept for anyone used to scrolling down — opens the
            same modal as the header button, so there's no more inline form
            to scroll past. */}
        <button
          onClick={() => setAddQuestionOpen(true)}
          className="w-full rounded-md border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
        >
          + Add question
        </button>
      </div>

      {/* Floating action button: always reachable regardless of scroll position
          on long exams, so adding a question never requires scrolling. */}
      <button
        onClick={() => setAddQuestionOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl leading-none text-primary-foreground shadow-lg hover:bg-primary/90"
        aria-label="Add question"
        title="Add question"
      >
        +
      </button>

      <Modal open={addQuestionOpen} onClose={() => setAddQuestionOpen(false)} title="New question">
        <QuestionForm
          isNew
          initial={emptyQuestion()}
          negativeMarkingEnabled={exam.negativeMarking}
          negativeMarkingRatios={negativeMarkingRatios}
          onCancel={() => setAddQuestionOpen(false)}
          onSubmit={(data, opts) => {
            addQuestion.mutate(
              { examId: exam.id, question: data },
              {
                onSuccess: () => {
                  setAddQuestionOpen(false)
                  // Independent second write — the exam-question save above
                  // already succeeded and is the primary action, so a bank
                  // save failure here must not roll anything back or block
                  // the modal from closing. Just surface a note.
                  if (opts?.saveToBank) {
                    addToBank.mutate(data, {
                      onError: (err) => {
                        setBankNotice(
                          `Question was added to the exam, but saving it to your question bank failed: ${err?.message || err}`
                        )
                        setTimeout(() => setBankNotice(null), 6000)
                      },
                    })
                  }
                },
              }
            )
          }}
        />
      </Modal>

      <Modal open={bankPickerOpen} onClose={() => setBankPickerOpen(false)} title="Add from question bank">
        <QuestionBankBrowser examId={exam.id} onClose={() => setBankPickerOpen(false)} />
      </Modal>

      <Modal open={bulkImportOpen} onClose={() => setBulkImportOpen(false)} title="Bulk import questions (CSV)">
        <BulkImportForm examId={exam.id} onClose={() => setBulkImportOpen(false)} />
      </Modal>
    </div>
  )
}


function RevealAnswersSetting({ exam }) {
  const [reveal, setReveal] = useState(exam.revealAnswers ?? false)
  const updateExam = useUpdateExam()
  useEffect(() => setReveal(exam.revealAnswers ?? false), [exam.id, exam.revealAnswers])

  const toggle = (val) => {
    setReveal(val)
    updateExam.mutate({ examId: exam.id, patch: { revealAnswers: val } })
  }

  return (
    <section className="rounded-md border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-1 font-semibold text-foreground">Answer visibility</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        When ON, candidates see correct answers on the result page and in the downloaded PDF.
        When OFF, only their own responses are shown.
      </p>
      <label className="inline-flex cursor-pointer items-center gap-3">
        <span className="relative inline-block h-6 w-11">
          <input
            type="checkbox"
            checked={reveal}
            onChange={(e) => toggle(e.target.checked)}
            className="peer sr-only"
          />
          <span className="absolute inset-0 rounded-full bg-gray-300 transition peer-checked:bg-primary" />
          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
        </span>
        <span className="text-sm font-medium text-foreground">
          Reveal correct answers to candidates {reveal ? '(ON)' : '(OFF)'}
        </span>
      </label>
    </section>
  )
}


// Same 8 detector keys/labels used by the course-lesson proctoring settings
// (frontend/src/components/EditProctoringModal.tsx:26-68), reused verbatim
// here for naming/wording consistency even though this exam-scoped config is
// persisted through useUpdateExam (`PATCH /exams/:examId`) rather than
// CourseSettingService.
const PROCTORING_DETECTOR_NAMES = [
  'cameraMic',
  'blurDetection',
  'faceCountDetection',
  'handGestureDetection',
  'voiceDetection',
  'virtualBackgroundDetection',
  'rightClickDisabled',
  'faceRecognition',
]

const PROCTORING_LABEL_MAP = {
  cameraMic: 'Camera + Microphone',
  blurDetection: 'Blur Detection',
  faceCountDetection: 'Face Count Detection',
  handGestureDetection: 'Hand Gesture Detection',
  voiceDetection: 'Voice Detection',
  virtualBackgroundDetection: 'Virtual Background Detection',
  rightClickDisabled: 'Right Click Disabled',
  faceRecognition: 'Face Recognition',
}

// Mirrors frontend/src/components/EditProctoringModal.tsx (the course-lesson
// settings equivalent), which force-disables this exact detector with no
// documented reason in that file either — treat it as "known unreliable,
// left off pending a real fix" rather than re-enable it here without
// checking with whoever added that restriction first.
const FORCE_DISABLED_DETECTORS = new Set(['blurDetection'])

function buildProctoringDetectors(exam) {
  return PROCTORING_DETECTOR_NAMES.map((detectorName) => {
    const existing = exam.proctoring?.detectors?.find((d) => d.detectorName === detectorName)
    return {
      detectorName,
      enabled: FORCE_DISABLED_DETECTORS.has(detectorName) ? false : existing?.enabled ?? false,
    }
  })
}

function ExamProctoringSettings({ exam }) {
  const [detectors, setDetectors] = useState(() => buildProctoringDetectors(exam))
  const [saved, setSaved] = useState(false)
  const updateExam = useUpdateExam()

  useEffect(() => {
    setDetectors(buildProctoringDetectors(exam))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id])

  const toggle = (detectorName) => {
    if (FORCE_DISABLED_DETECTORS.has(detectorName)) return
    setDetectors((prev) =>
      prev.map((d) => (d.detectorName === detectorName ? { ...d, enabled: !d.enabled } : d))
    )
  }

  const save = () => {
    updateExam.mutate({ examId: exam.id, patch: { proctoring: { detectors } } })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <section className="rounded-md border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-1 font-semibold text-foreground">Proctoring</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Choose which camera/mic-based checks run while a candidate is taking this test.
        Reuses the same detectors used during course lessons. Violations are logged with the
        attempt for review — they never pause the timer or block the candidate from answering.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {detectors.map((d) => {
          const forceDisabled = FORCE_DISABLED_DETECTORS.has(d.detectorName)
          return (
            <label
              key={d.detectorName}
              className={`flex select-none items-center gap-2 text-sm ${
                forceDisabled ? 'cursor-not-allowed text-muted-foreground opacity-70' : 'cursor-pointer text-foreground'
              }`}
              title={forceDisabled ? 'Disabled — known unreliable, same as course lessons' : undefined}
            >
              <input
                type="checkbox"
                checked={d.enabled}
                disabled={forceDisabled}
                onChange={() => toggle(d.detectorName)}
              />
              {PROCTORING_LABEL_MAP[d.detectorName] || d.detectorName}
              {forceDisabled && <span className="text-xs">(disabled)</span>}
            </label>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={updateExam.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Save proctoring settings
        </button>
        {saved && <span className="text-xs text-green-600">Saved ✓</span>}
      </div>
    </section>
  )
}


// datetime-local inputs work in the browser's local time and expect/return
// "YYYY-MM-DDTHH:mm" strings — these two converters are the only place that
// translates between that and the epoch-ms the backend stores.
function epochToLocalInputValue(epochMs) {
  if (epochMs === undefined || epochMs === null || Number.isNaN(epochMs)) return ''
  const d = new Date(epochMs)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputValueToEpoch(value) {
  if (!value) return null // empty input = clear the bound
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? null : t
}

function ExamScheduleSettings({ exam }) {
  const [opensAt, setOpensAt] = useState(epochToLocalInputValue(exam.opensAt))
  const [closesAt, setClosesAt] = useState(epochToLocalInputValue(exam.closesAt))
  // Absent on the exam object means the server default (true) applies.
  const [allowRetakes, setAllowRetakes] = useState(exam.allowRetakes ?? true)
  const [saved, setSaved] = useState(false)
  const updateExam = useUpdateExam()

  useEffect(() => {
    setOpensAt(epochToLocalInputValue(exam.opensAt))
    setClosesAt(epochToLocalInputValue(exam.closesAt))
    setAllowRetakes(exam.allowRetakes ?? true)
  }, [exam.id])

  const save = () => {
    updateExam.mutate({
      examId: exam.id,
      patch: {
        // Empty input -> null, which clears a previously-set bound rather
        // than sending NaN (invalid Date) or 0 (epoch 1970, which would
        // make the exam look permanently open/closed instead of unbounded).
        opensAt: localInputValueToEpoch(opensAt),
        closesAt: localInputValueToEpoch(closesAt),
        allowRetakes,
      },
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <section className="rounded-md border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-1 font-semibold text-foreground">Scheduling &amp; retakes</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        These are enforced on the server, not just in this UI — a student genuinely
        cannot submit outside the window below, and can't re-attempt once retakes are
        disabled, even if they bypass the candidate-facing warnings.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          Opens at
          <input
            type="datetime-local"
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Leave blank for no start restriction — the exam is open immediately.
          </span>
        </label>
        <label className="block text-sm">
          Closes at
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Leave blank for no end restriction — the exam never closes on its own.
          </span>
        </label>
      </div>
      <label className="mt-3 flex select-none items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={allowRetakes}
          onChange={(e) => setAllowRetakes(e.target.checked)}
        />
        Allow multiple attempts
      </label>
      <p className="mt-1 text-xs text-muted-foreground">
        When OFF, a student who has ever completed this exam once cannot attempt it
        again — this is checked against their attempt history, not this device.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={updateExam.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Save scheduling
        </button>
        {saved && <span className="text-xs text-green-600">Saved ✓</span>}
      </div>
    </section>
  )
}


function TimeGrantsSection({ exam }) {
  const [minutes, setMinutes] = useState(10)
  const [note, setNote] = useState('')
  const [justCreatedId, setJustCreatedId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const addTimeGrant = useAddTimeGrant()
  const removeTimeGrant = useRemoveTimeGrant()

  const grants = [...(exam.timeGrants || [])].sort((a, b) => b.createdAt - a.createdAt)

  const handleGenerate = async (e) => {
    e.preventDefault()
    try {
      const updated = await addTimeGrant.mutateAsync({
        examId: exam.id,
        grant: { minutes, note: note.trim() },
      })
      const newest = [...(updated.timeGrants || [])].sort((a, b) => b.createdAt - a.createdAt)[0]
      if (newest) {
        setJustCreatedId(newest.id)
        setNote('')
      }
    } catch (err) {
      alert('Failed to generate code: ' + (err?.message || err))
    }
  }

  const handleCopy = (grant) => {
    navigator.clipboard?.writeText(grant.code).then(() => {
      setCopiedId(grant.id)
      setTimeout(() => setCopiedId((id) => (id === grant.id ? null : id)), 1200)
    })
  }

  const handleRevoke = (grant) => {
    if (!grant.used && !confirm(`Revoke unused code ${grant.code}?`)) return
    removeTimeGrant.mutate({ examId: exam.id, grantId: grant.id })
  }

  return (
    <section className="rounded-md border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-1 font-semibold text-foreground">Extra time</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Generate a one-time code for a candidate who hit a technical issue. They enter it on
        the exam screen to add bonus minutes to their own timer only — it doesn't change the
        exam's duration for anyone else.
      </p>

      <form onSubmit={handleGenerate} className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="text-xs font-medium text-muted-foreground">Minutes</span>
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block flex-1 min-w-[200px] text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Note (candidate name / reason, optional)
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Rahul — laptop restarted"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={addTimeGrant.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Generate code
        </button>
      </form>

      {grants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No codes issued yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Minutes</th>
                <th className="py-2 pr-4">Note</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr
                  key={g.id}
                  className={`border-b border-border/60 ${g.id === justCreatedId ? 'bg-primary/5' : ''}`}
                >
                  <td className="py-2 pr-4 font-mono font-semibold tracking-wide">{g.code}</td>
                  <td className="py-2 pr-4">{g.minutes} min</td>
                  <td className="py-2 pr-4 text-muted-foreground">{g.note || '—'}</td>
                  <td className="py-2 pr-4">
                    {g.used ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        Used
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Unused
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-2">
                      {!g.used && (
                        <button
                          onClick={() => handleCopy(g)}
                          className="rounded border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                        >
                          {copiedId === g.id ? 'Copied!' : 'Copy'}
                        </button>
                      )}
                      <button
                        onClick={() => handleRevoke(g)}
                        disabled={removeTimeGrant.isPending}
                        className="rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {g.used ? 'Remove' : 'Revoke'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}


function ExamSettings({ exam }) {
  const [title, setTitle] = useState(exam.title)
  const [duration, setDuration] = useState(exam.duration)
  const [passingMarks, setPassingMarks] = useState(exam.passingMarks)
  const [negativeMarking, setNegativeMarking] = useState(exam.negativeMarking)
  const [instructions, setInstructions] = useState(exam.instructions)
  const [minSubmitTime, setMinSubmitTime] = useState(exam.minSubmitTime || 0)
  const [ratios, setRatios] = useState(exam.negativeMarkingRatios ?? defaultNegativeMarkingRatios)
  const [saved, setSaved] = useState(false)
  const updateExam = useUpdateExam()

  useEffect(() => {
    setTitle(exam.title)
    setDuration(exam.duration)
    setPassingMarks(exam.passingMarks)
    setNegativeMarking(exam.negativeMarking)
    setInstructions(exam.instructions)
    setMinSubmitTime(exam.minSubmitTime || 0)
    setRatios(exam.negativeMarkingRatios ?? defaultNegativeMarkingRatios)
  }, [exam.id])

  const updateRatio = (type, field, value) => {
    setRatios((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: Math.max(0, Number(value) || 0) },
    }))
  }

  const save = () => {
    updateExam.mutate({
      examId: exam.id,
      patch: {
        title, duration, passingMarks, negativeMarking, instructions, minSubmitTime,
        negativeMarkingRatios: ratios,
      },
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <section className="rounded-md border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 font-semibold text-foreground">Test settings</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          Duration (minutes)
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 1)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          Min time to submit (minutes)
          <input
            type="number"
            min={0}
            value={minSubmitTime}
            onChange={(e) => setMinSubmitTime(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          Passing marks
          <input
            type="number"
            min={0}
            value={passingMarks}
            onChange={(e) => setPassingMarks(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={negativeMarking}
            onChange={(e) => setNegativeMarking(e.target.checked)}
          />
          Enable negative marking
        </label>

        {negativeMarking && (
          <div className="sm:col-span-2 rounded-md border border-dashed border-border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Negative marking ratios (applied automatically per question, based on its marks).
              E.g. MCQ 1/3 means a 1-mark question loses 1/3, a 2-mark question loses 2/3.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {['MCQ', 'MSQ', 'NAT'].map((type) => (
                <div key={type} className="rounded-md border border-border p-2">
                  <p className="mb-1 text-xs font-semibold text-foreground">{type}</p>
                  <div className="flex items-center gap-1 text-sm">
                    <span>−</span>
                    <input
                      type="number"
                      min={0}
                      value={ratios[type]?.num ?? 0}
                      onChange={(e) => updateRatio(type, 'num', e.target.value)}
                      className="w-14 rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                    <span>/</span>
                    <input
                      type="number"
                      min={1}
                      value={ratios[type]?.den ?? 1}
                      onChange={(e) => updateRatio(type, 'den', e.target.value)}
                      className="w-14 rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">per mark</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    e.g. {calcNegativeMarks(1, type, ratios)} for 1 mark, {calcNegativeMarks(2, type, ratios)} for 2 marks
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="block text-sm sm:col-span-2">
          Instructions
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={updateExam.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Save settings
        </button>
        {saved && <span className="text-xs text-green-600">Saved ✓</span>}
      </div>
    </section>
  )
}

function ExamHeaderSettings({ exam }) {
  const [headerTitle, setHeaderTitle] = useState(exam.headerTitle ?? '')
  const [headerSubtitle, setHeaderSubtitle] = useState(exam.headerSubtitle ?? '')
  const [leftBadge, setLeftBadge] = useState(exam.leftBadge ?? '')
  const [rightBadge, setRightBadge] = useState(exam.rightBadge ?? '')
  const [saved, setSaved] = useState(false)
  const updateExam = useUpdateExam()

  useEffect(() => {
    setHeaderTitle(exam.headerTitle ?? '')
    setHeaderSubtitle(exam.headerSubtitle ?? '')
    setLeftBadge(exam.leftBadge ?? '')
    setRightBadge(exam.rightBadge ?? '')
  }, [exam.id])

  const save = () => {
    updateExam.mutate({
      examId: exam.id,
      patch: {
        headerTitle: headerTitle.trim(),
        headerSubtitle: headerSubtitle.trim(),
        leftBadge: leftBadge.trim(),
        rightBadge: rightBadge.trim(),
      },
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <section className="rounded-md border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-1 font-semibold text-foreground">Exam header (shown on the test page)</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Customize the top branding bar. e.g. "ViBe", "IIT Ropar", left/right badges.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          Header title
          <input
            value={headerTitle}
            onChange={(e) => setHeaderTitle(e.target.value)}
            placeholder="ViBe"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          Header subtitle
          <input
            value={headerSubtitle}
            onChange={(e) => setHeaderSubtitle(e.target.value)}
            placeholder="Organizing Institute: Indian Institute of Technology Ropar"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          Left badge
          <input
            value={leftBadge}
            onChange={(e) => setLeftBadge(e.target.value)}
            placeholder="ViBe"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          Right badge
          <input
            value={rightBadge}
            onChange={(e) => setRightBadge(e.target.value)}
            placeholder="IIT Ropar"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Candidate name is taken from the logged-in student, not set here.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={updateExam.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Save header
        </button>
        {saved && <span className="text-xs text-green-600">Saved ✓</span>}
      </div>
    </section>
  )
}

function QuestionsSection({ exam, negativeMarkingRatios }) {
  return (
    <section>
      <h2 className="mb-3 font-semibold text-foreground">Questions ({exam.questions.length})</h2>
      {exam.questions.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No questions yet. Use the "+ Add question" button to add your first one.
        </p>
      ) : (
        <ul className="space-y-3">
          {exam.questions.map((q, i) => (
            <QuestionRow
              key={q.id}
              examId={exam.id}
              question={q}
              index={i}
              negativeMarkingEnabled={exam.negativeMarking}
              negativeMarkingRatios={negativeMarkingRatios}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function QuestionRow({ examId, question, index, negativeMarkingEnabled, negativeMarkingRatios }) {
  const [editing, setEditing] = useState(false)
  const updateQuestion = useUpdateQuestion()
  const removeQuestion = useRemoveQuestion()

  return (
    <li className="rounded-md border border-border bg-card p-4 shadow-sm">
      {!editing ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded bg-muted px-2 py-0.5 font-mono">Q{index + 1}</span>
              <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
                {question.type}
              </span>
              <span>+{question.marks}</span>
              {negativeMarkingEnabled && question.negativeMarks > 0 && (
                <span>−{question.negativeMarks}{question.useCustomNegative ? ' (custom)' : ''}</span>
              )}
              {question.topic && (
                <span className="rounded bg-muted px-2 py-0.5">{question.topic}</span>
              )}
            </div>
            <p className="text-sm text-foreground"><RichText text={question.questionText} /></p>
            {question.questionImage && (
              <img
                src={question.questionImage}
                alt="Question"
                className="mt-2 max-h-48 rounded border border-border object-contain"
              />
            )}
            {question.type !== 'NAT' && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
             {/* Replace the previous li implementation for options */}
{question.options.map((o, idx) => (
  <li
    key={o.id}
    className={
      'flex items-center gap-2 ' +
      (question.correctOptions.includes(o.id) ? 'font-semibold text-green-700' : '')
    }
  >
    <span>
      {String.fromCharCode(65 + idx)}. <RichText text={o.text} /> {question.correctOptions.includes(o.id) && '✓'}
    </span>
    {o.image && (
      <img src={o.image} alt="" className="h-10 w-16 rounded border object-contain" />
    )}
  </li>
))}
              </ul>
            )}
            {question.type === 'NAT' && (
              <p className="mt-2 text-xs text-muted-foreground">
                Correct answer: <span className="font-semibold text-green-700">{question.correctOptions[0]}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setEditing(true)}
              className="rounded border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm('Delete this question?')) {
                  removeQuestion.mutate({ examId, questionId: question.id })
                }
              }}
              disabled={removeQuestion.isPending}
              className="rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <QuestionForm
          initial={question}
          negativeMarkingEnabled={negativeMarkingEnabled}
          negativeMarkingRatios={negativeMarkingRatios}
          onCancel={() => setEditing(false)}
          onSubmit={(patch) => {
            updateQuestion.mutate(
              { examId, questionId: question.id, patch },
              { onSuccess: () => setEditing(false) }
            )
          }}
        />
      )}
    </li>
  )
}

function QuestionForm({ initial, onSubmit, onCancel, negativeMarkingEnabled, negativeMarkingRatios, isNew = false }) {
  const [type, setType] = useState(initial.type)
  const [questionText, setQuestionText] = useState(initial.questionText)
  const [questionImage, setQuestionImage] = useState(initial.questionImage)
const [options, setOptions] = useState(
    initial.options.length
      ? initial.options
      : [
          { id: `${initial.id || 'new'}_1`, text: '' },
          { id: `${initial.id || 'new'}_2`, text: '' },
          { id: `${initial.id || 'new'}_3`, text: '' },
          { id: `${initial.id || 'new'}_4`, text: '' },
        ]
  )
  const [correct, setCorrect] = useState(initial.correctOptions)
  const [marks, setMarks] = useState(initial.marks)
  const [customNegativeMarks, setCustomNegativeMarks] = useState(initial.useCustomNegative ?? false)
  const [manualNegativeMarks, setManualNegativeMarks] = useState(initial.negativeMarks ?? 0)
  const [natAnswer, setNatAnswer] = useState(
    initial.type === 'NAT' ? initial.correctOptions[0] ?? '' : ''
  )
  const [natType, setNatType] = useState(initial.natAnswerType ?? 'integer')
  const [topic, setTopic] = useState(initial.topic ?? '')
  const [explanation, setExplanation] = useState(initial.explanation ?? '')
  const [uploading, setUploading] = useState(false)
  const [saveToBank, setSaveToBank] = useState(false)

  const computedNegativeMarks = calcNegativeMarks(marks, type, negativeMarkingRatios)
  const effectiveNegativeMarks = customNegativeMarks ? manualNegativeMarks : computedNegativeMarks

  const uploadQuestionImage = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      setQuestionImage(await fileToDataUrl(file, { maxDim: 1400, quality: 0.85 }))
    } catch {
      alert('Failed to load image')
    } finally {
      setUploading(false)
    }
  }

  const uploadOptionImage = async (optId, file) => {
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await fileToDataUrl(file, { maxDim: 400, quality: 0.85 })
      setOptions((prev) => prev.map((o) => (o.id === optId ? { ...o, image: dataUrl } : o)))
    } catch {
      alert('Failed to load image')
    } finally {
      setUploading(false)
    }
  }

  const toggleCorrect = (id) => {
    if (type === 'MCQ') setCorrect([id])
    else setCorrect((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const submit = () => {
    const hasQText = questionText.trim().length > 0
    if (!hasQText && !questionImage) return alert('Add question text or a question image')

    // Fallback to 0 if negative marking is globally disabled
    const appliedNegativeMarks = negativeMarkingEnabled ? effectiveNegativeMarks : 0
    const appliedCustomFlag = negativeMarkingEnabled ? customNegativeMarks : false

    let payload
    if (type === 'NAT') {
      if (!natAnswer.trim()) return alert('Correct numeric answer is required')
      payload = {
        type,
        questionText: questionText.trim(),
        questionImage,
        options: [],
        correctOptions: [natAnswer.trim()],
        marks,
        negativeMarks: appliedNegativeMarks,
        useCustomNegative: appliedCustomFlag,
        natAnswerType: natType,
        topic: topic.trim(),
        explanation: explanation.trim(),
      }
    } else {
      const cleanOptions = options.filter((o) => o.text.trim() || o.image)
      if (cleanOptions.length < 2) return alert('At least 2 options required (text or image)')
      if (correct.length === 0) return alert('Select at least one correct option')
      payload = {
        type,
        questionText: questionText.trim(),
        questionImage,
        options: cleanOptions,
        correctOptions: correct.filter((c) => cleanOptions.some((o) => o.id === c)),
        marks,
        negativeMarks: appliedNegativeMarks,
        useCustomNegative: appliedCustomFlag,
        topic: topic.trim(),
        explanation: explanation.trim(),
      }
    }

    // `saveToBank` only ever means anything for a brand-new question — the
    // caller (EditExamPage) ignores this flag entirely for the edit-in-place
    // flow (QuestionRow's onSubmit only takes one argument).
    onSubmit(payload, { saveToBank: isNew && saveToBank })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <select
            value={type}
            onChange={(e) => {
              const t = e.target.value
              setType(t)
              setCorrect([])
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="MCQ">MCQ (single)</option>
            <option value="MSQ">MSQ (multiple)</option>
            <option value="NAT">NAT (numeric)</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Marks</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={marks}
            onChange={(e) => setMarks(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        {negativeMarkingEnabled && (
          <div className="block sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Negative marks</span>
            <div className="mt-1 flex items-center gap-2">
              {!customNegativeMarks ? (
                <span className="rounded-md border border-input bg-muted px-3 py-2 text-sm">
                  −{computedNegativeMarks} <span className="text-xs text-muted-foreground">(auto, {ratioLabel(negativeMarkingRatios?.[type])})</span>
                </span>
              ) : (
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={manualNegativeMarks}
                  onChange={(e) => setManualNegativeMarks(Number(e.target.value) || 0)}
                  className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              )}
              <label className="flex items-center gap-1 text-xs text-muted-foreground select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={customNegativeMarks}
                  onChange={(e) => {
                    setCustomNegativeMarks(e.target.checked)
                    if (e.target.checked) setManualNegativeMarks(computedNegativeMarks)
                  }}
                />
                Override for this question
              </label>
            </div>
          </div>
        )}

        {type === 'NAT' && (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Answer type</span>
            <select
              value={natType}
              onChange={(e) => setNatType(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="integer">Integer</option>
              <option value="decimal">Decimal</option>
            </select>
          </label>
        )}
      </div>

      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          Question text (optional if image provided) — supports $inline$ / $$display$$ LaTeX and `code`
        </span>
        <textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {questionText.trim() && (
          <div className="mt-1 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
            <span className="mr-2 text-xs font-medium text-muted-foreground">Preview:</span>
            <RichText text={questionText} />
          </div>
        )}
      </label>

      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">Topic / section</span>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Graphs, Sorting, OOP…"
          className="mt-1 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          Explanation (shown to students after results, if reveal is on)
        </span>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={3}
          placeholder="Why this is the correct answer…"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      <div className="rounded-md border border-dashed border-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Question image (optional)</span>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => uploadQuestionImage(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
            {questionImage && (
              <button
                type="button"
                onClick={() => setQuestionImage(undefined)}
                className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            )}
          </div>
        </div>
        {questionImage && (
          <img
            src={questionImage}
            alt="Question preview"
            className="max-h-64 rounded border border-border object-contain"
          />
        )}
      </div>

      {type !== 'NAT' ? (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Options ({type === 'MCQ' ? 'select 1 correct' : 'select all correct'})
          </p>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={o.id} className="rounded-md border border-border p-2">
                <div className="flex items-center gap-2">
                  <input
                    type={type === 'MCQ' ? 'radio' : 'checkbox'}
                    checked={correct.includes(o.id)}
                    onChange={() => toggleCorrect(o.id)}
                    name="correct-option"
                  />
                  <span className="w-6 text-xs font-bold uppercase">{String.fromCharCode(65 + i)}</span>
                  <input
                    value={o.text}
                    onChange={(e) => {
                      const next = [...options]
                      next[i] = { ...o, text: e.target.value }
                      setOptions(next)
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + i)} text (or leave blank if using image)`}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="mt-2 flex items-center gap-2 pl-10">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => uploadOptionImage(o.id, e.target.files?.[0] ?? null)}
                    className="text-xs"
                  />
                  {o.image && (
                    <>
                      <img src={o.image} alt="" className="h-12 w-20 rounded border object-contain" />
                      <button
                        type="button"
                        onClick={() =>
                          setOptions((prev) => prev.map((x) => (x.id === o.id ? { ...x, image: undefined } : x)))
                        }
                        className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Correct numeric answer</span>
          <input
            value={natAnswer}
            onChange={(e) => setNatAnswer(e.target.value)}
            placeholder="e.g. 42 or 3.14"
            className="mt-1 w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      )}

      {isNew && (
        <label className="flex select-none items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={saveToBank}
            onChange={(e) => setSaveToBank(e.target.checked)}
          />
          Also save to my question bank
          <span className="text-xs text-muted-foreground">
            (lets you reuse this question in other tests later)
          </span>
        </label>
      )}

      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={submit}
          disabled={uploading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Save question'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}


// ─── Question bank browser/picker ───────────────────────────
// Shown inside the "Add from question bank" modal. Fetches the teacher's
// whole bank once and filters by topic client-side (per the backend note:
// bank sizes are small, no need to round-trip `?topic=`).
function QuestionBankBrowser({ examId, onClose }) {
  const { data: bank, isLoading, isError, error } = useQuestionBank()
  const [topicFilter, setTopicFilter] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const addFromBank = useAddQuestionsFromBank()
  const removeFromBank = useRemoveFromQuestionBank()

  const entries = bank || []
  const filtered = topicFilter.trim()
    ? entries.filter((e) => (e.topic || '').toLowerCase().includes(topicFilter.trim().toLowerCase()))
    : entries

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAdd = () => {
    if (selected.size === 0) return
    addFromBank.mutate(
      { examId, questionIds: Array.from(selected) },
      {
        onSuccess: () => {
          setSelected(new Set())
          onClose()
        },
        onError: (err) => alert('Failed to add selected questions: ' + (err?.message || err)),
      }
    )
  }

  const handleRemove = (entry) => {
    if (
      !confirm(
        'Remove this question from your bank? This only removes it from the bank — ' +
          'it will not be removed from any exam it has already been copied into.'
      )
    ) {
      return
    }
    removeFromBank.mutate(entry._id, {
      onSuccess: () => {
        setSelected((prev) => {
          if (!prev.has(entry._id)) return prev
          const next = new Set(prev)
          next.delete(entry._id)
          return next
        })
      },
      onError: (err) => alert('Failed to remove question: ' + (err?.message || err)),
    })
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your question bank…</p>
  }
  if (isError) {
    return (
      <p className="text-sm text-red-600">
        Failed to load your question bank{error?.message ? `: ${error.message}` : '.'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="text-xs font-medium text-muted-foreground">Filter by topic</span>
        <input
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          placeholder="e.g. Graphs"
          className="mt-1 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No saved questions yet — check &quot;Also save to my question bank&quot; when adding a
          question, or bulk import below.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bank questions match that topic.</p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {filtered.map((entry) => (
            <li key={entry._id} className="rounded-md border border-border p-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(entry._id)}
                  onChange={() => toggle(entry._id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
                      {entry.type}
                    </span>
                    <span>{entry.marks} marks</span>
                    {entry.topic && <span className="rounded bg-muted px-2 py-0.5">{entry.topic}</span>}
                  </div>
                  <p className="line-clamp-2 text-sm text-foreground">
                    {entry.questionText || '(image-only question)'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(entry)}
                  disabled={removeFromBank.isPending}
                  className="shrink-0 rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove from bank
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={selected.size === 0 || addFromBank.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {addFromBank.isPending ? 'Adding…' : `Add ${selected.size} selected to this exam`}
        </button>
      </div>
    </div>
  )
}


// ─── CSV bulk import ─────────────────────────────────────────

const CSV_COLUMNS = [
  'type',
  'questionText',
  'options',
  'correctOptions',
  'marks',
  'negativeMarks',
  'topic',
  'explanation',
]

// One example row per question type so a teacher has something concrete to
// edit rather than guessing the format from prose alone.
const CSV_TEMPLATE_ROWS = [
  {
    type: 'MCQ',
    questionText: 'What is the time complexity of binary search on a sorted array?',
    options: 'O(n)|O(log n)|O(n^2)|O(1)',
    correctOptions: '1',
    marks: '2',
    negativeMarks: '0.5',
    topic: 'Algorithms',
    explanation: 'Binary search halves the remaining search space at each step.',
  },
  {
    type: 'MSQ',
    questionText: 'Which of the following are comparison-based sorting algorithms?',
    options: 'QuickSort|Binary Search|MergeSort|Depth-First Search',
    correctOptions: '0|2',
    marks: '2',
    negativeMarks: '0',
    topic: 'Algorithms',
    explanation: 'QuickSort and MergeSort compare elements to order them; the others do not sort.',
  },
  {
    type: 'NAT',
    questionText: 'What is 12 + 30?',
    options: '',
    correctOptions: '42',
    marks: '1',
    negativeMarks: '0',
    topic: 'Arithmetic',
    explanation: '',
  },
]

function downloadCsvTemplate() {
  const csv = Papa.unparse({ fields: CSV_COLUMNS, data: CSV_TEMPLATE_ROWS })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'question-bulk-import-template.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const VALID_QUESTION_TYPES = ['MCQ', 'MSQ', 'NAT']

// Validates + maps a single parsed CSV row into an `AddQuestionInput`-shaped
// payload. Returns `{ ok: true, summary, payload }` on success or
// `{ ok: false, summary, error }` on failure — `summary` is always set (a
// best-effort preview) so the results table has something to show even for
// rows that fail validation.
function validateAndMapCsvRow(row) {
  const rawType = String(row.type ?? '').trim()
  const type = rawType.toUpperCase()
  const questionText = String(row.questionText ?? '').trim()
  const summary = `${rawType || '?'} — ${questionText ? questionText.slice(0, 60) : '(no question text)'}`

  if (!VALID_QUESTION_TYPES.includes(type)) {
    return { ok: false, summary, error: `Invalid type "${rawType}" — must be MCQ, MSQ, or NAT` }
  }
  if (!questionText) {
    return { ok: false, summary, error: 'questionText is required' }
  }

  const marks = Number(row.marks)
  if (!Number.isFinite(marks) || marks <= 0) {
    return { ok: false, summary, error: 'marks must be a positive number' }
  }

  const negativeMarksRaw = row.negativeMarks
  const negativeMarksProvided = negativeMarksRaw !== undefined && String(negativeMarksRaw).trim() !== ''
  const negativeMarks = negativeMarksProvided ? Number(negativeMarksRaw) : 0
  if (negativeMarksProvided && !Number.isFinite(negativeMarks)) {
    return { ok: false, summary, error: 'negativeMarks must be a number' }
  }

  const correctOptionsRaw = String(row.correctOptions ?? '').trim()
  if (!correctOptionsRaw) {
    return { ok: false, summary, error: 'correctOptions is required' }
  }

  const topic = String(row.topic ?? '').trim()
  const explanation = String(row.explanation ?? '').trim()
  const qId = randomQuestionId()

  if (type === 'NAT') {
    return {
      ok: true,
      summary,
      payload: {
        type: 'NAT',
        questionText,
        options: [],
        correctOptions: [correctOptionsRaw],
        marks,
        negativeMarks,
        useCustomNegative: false,
        natAnswerType: 'integer',
        topic,
        explanation,
      },
    }
  }

  const optionTexts = String(row.options ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
  if (optionTexts.length < 2) {
    return { ok: false, summary, error: 'options must have at least 2 pipe-separated values for MCQ/MSQ' }
  }
  const rowOptions = optionTexts.map((text, i) => ({ id: `${qId}_${i + 1}`, text }))

  const indexTokens = correctOptionsRaw
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s !== '')
  const indices = indexTokens.map((s) => Number(s))
  const outOfRange = indices.some((n) => !Number.isInteger(n) || n < 0 || n >= optionTexts.length)
  if (outOfRange) {
    return {
      ok: false,
      summary,
      error: `correctOptions indices must be whole numbers between 0 and ${optionTexts.length - 1}`,
    }
  }
  if (type === 'MCQ' && indices.length !== 1) {
    return { ok: false, summary, error: 'MCQ requires exactly one correctOptions index' }
  }
  if (type === 'MSQ' && indices.length < 1) {
    return { ok: false, summary, error: 'MSQ requires at least one correctOptions index' }
  }

  return {
    ok: true,
    summary,
    payload: {
      type,
      questionText,
      options: rowOptions,
      correctOptions: indices.map((i) => rowOptions[i].id),
      marks,
      negativeMarks,
      useCustomNegative: false,
      topic,
      explanation,
    },
  }
}

function BulkImportForm({ examId, onClose }) {
  const [rows, setRows] = useState([]) // [{ rowNumber, ok, summary, error?, payload? }]
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const bulkAdd = useBulkAddQuestions()

  const handleFile = (file) => {
    if (!file) return
    setFileName(file.name)
    setParseError('')
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = (results.data || []).map((row, i) => ({
          rowNumber: i + 1,
          ...validateAndMapCsvRow(row),
        }))
        setRows(parsed)
      },
      error: (err) => {
        setParseError('Failed to parse CSV: ' + (err?.message || err))
        setRows([])
      },
    })
  }

  const validRows = rows.filter((r) => r.ok)
  const invalidCount = rows.length - validRows.length

  const handleImport = () => {
    if (validRows.length === 0) return
    bulkAdd.mutate(
      { examId, questions: validRows.map((r) => r.payload) },
      {
        onSuccess: () => onClose(),
        onError: (err) => alert('Bulk import failed: ' + (err?.message || err)),
      }
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
        <p className="mb-2">
          Upload a CSV with these columns: <code>type</code> (MCQ, MSQ, or NAT),{' '}
          <code>questionText</code>, <code>options</code> (pipe-separated — MCQ/MSQ only, e.g.{' '}
          <code>Option A|Option B|Option C|Option D</code>, leave blank for NAT),{' '}
          <code>correctOptions</code> (for MCQ/MSQ: the 0-based index of the correct option, or
          multiple pipe-separated indices for MSQ, e.g. <code>1</code> or <code>0|2</code>; for
          NAT: the literal numeric answer, e.g. <code>42</code>), <code>marks</code> (positive
          number), <code>negativeMarks</code> (optional, defaults to 0), <code>topic</code>{' '}
          (optional), and <code>explanation</code> (optional).
        </p>
        <button
          type="button"
          onClick={downloadCsvTemplate}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          Download template CSV
        </button>
      </div>

      <label className="block text-sm">
        <span className="text-xs font-medium text-muted-foreground">CSV file</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="mt-1 block text-sm"
        />
        {fileName && <span className="mt-1 block text-xs text-muted-foreground">Selected: {fileName}</span>}
      </label>

      {parseError && <p className="text-sm text-red-600">{parseError}</p>}

      {rows.length > 0 && (
        <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 px-3">Row</th>
                <th className="py-2 px-3">Summary</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rowNumber} className="border-b border-border/60">
                  <td className="py-2 px-3 font-mono">{r.rowNumber}</td>
                  <td className="py-2 px-3">{r.summary}</td>
                  <td className="py-2 px-3">
                    {r.ok ? (
                      <span className="font-medium text-green-700">OK</span>
                    ) : (
                      <span className="text-red-600">{r.error}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={validRows.length === 0 || bulkAdd.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {bulkAdd.isPending
            ? 'Importing…'
            : invalidCount > 0
            ? `Import ${validRows.length} questions (${invalidCount} skipped, see errors above)`
            : `Import ${validRows.length} questions`}
        </button>
      </div>
    </div>
  )
}
