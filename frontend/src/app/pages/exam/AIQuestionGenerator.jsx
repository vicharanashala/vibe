import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { examGenAIApi } from '@/lib/api/examGenAI'
import { useMyExams, examKeys } from '@/hooks/exam-hooks'

const SUBJECTS = [
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'computer_science', label: 'Computer Science' },
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'statistics', label: 'Statistics' },
  { value: 'physics', label: 'Physics' },
  { value: 'economics', label: 'Economics' },
  { value: 'other', label: 'Other' },
]

const TARGET_GOOD = 20 // must match backend examGenAIConfig.targetGoodQuestions

const DIFFICULTY_LEVELS = [
  { value: 'mixed', label: 'Mixed', hint: 'varied, hardest kept' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

function difficultyBadgeClass(difficulty) {
  if (difficulty <= 4) return 'bg-green-100 text-green-800 border-green-300'
  if (difficulty <= 7) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
  return 'bg-red-100 text-red-800 border-red-300'
}

function truncate(text, n) {
  if (!text) return ''
  return text.length > n ? `${text.slice(0, n - 1)}…` : text
}

export default function AIQuestionGenerator() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: exams = [] } = useMyExams()

  const [form, setForm] = useState({
    course_name: '',
    subject: 'mathematics',
    course_description: '',
    syllabus: '',
    past_exam_content: '',
    num_questions: 10,
    difficulty_level: 'mixed',
  })

  const [jobId, setJobId] = useState(null)
  const [progress, setProgress] = useState(null) // last SSE event
  const [questions, setQuestions] = useState(null) // final approved questions, once complete
  const [removedIndices, setRemovedIndices] = useState(() => new Set())
  const [selectedExamId, setSelectedExamId] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null) // { message, examId? }
  const [error, setError] = useState(null)
  // Live feed of every candidate as it's generated + judged, newest first —
  // so a teacher sees real questions streaming in during the (sometimes
  // slow, rate-limit-throttled) wait instead of a bare progress bar that
  // looks frozen between updates.
  const [activityLog, setActivityLog] = useState([])
  const eventSourceRef = useRef(null)
  const lastLoggedRef = useRef(null)

  const generating = !!jobId && !questions && !error

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  const updateField = (field) => (e) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [field]: value }))
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    setError(null)
    setQuestions(null)
    setRemovedIndices(new Set())
    setProgress(null)
    setToast(null)
    setActivityLog([])
    lastLoggedRef.current = null
    eventSourceRef.current?.close()

    try {
      const { jobId: newJobId } = await examGenAIApi.generate(form)
      setJobId(newJobId)

      const source = examGenAIApi.connectLive(newJobId, (event) => {
        setProgress(event)
        if (event.stage === 'generating' && event.last_question) {
          const key = `${event.iteration}:${event.last_question.question}`
          if (lastLoggedRef.current !== key) {
            lastLoggedRef.current = key
            setActivityLog((prev) => [event.last_question, ...prev].slice(0, 25))
          }
        }
        if (event.stage === 'complete') {
          setQuestions(event.questions)
          source.close()
        } else if (event.stage === 'error') {
          setError(event.message || 'Generation failed')
          source.close()
        }
      })
      eventSourceRef.current = source
    } catch (err) {
      setError(err?.message || 'Could not start generation')
    }
  }

  const toggleRemove = (index) => {
    setRemovedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const selectedIndices = questions
    ? questions.map((_, i) => i).filter((i) => !removedIndices.has(i))
    : []

  const handleSave = async (target) => {
    if (!jobId || selectedIndices.length === 0) return
    if (target === 'exam' && !selectedExamId) {
      setError('Pick an exam to save to first')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await examGenAIApi.save(jobId, {
        target,
        examId: target === 'exam' ? selectedExamId : null,
        selectedIndices,
      })
      if (!result.saved) {
        setError(result.message || 'Nothing was saved')
        return
      }
      // This save goes through examGenAIApi's own fetch call, not the
      // useAddQuestion/useAddToQuestionBank React Query mutations — so
      // nothing invalidates the exam/question-bank caches automatically.
      // Without this, the exam editor (if already loaded/cached) keeps
      // showing the pre-save question list even though the backend wrote
      // the questions correctly, looking exactly like a failed save.
      if (target === 'exam') {
        void queryClient.invalidateQueries({ queryKey: examKeys.exam(selectedExamId) })
        void queryClient.invalidateQueries({ queryKey: examKeys.mine })
      } else if (target === 'bank') {
        void queryClient.invalidateQueries({ queryKey: examKeys.questionBank() })
      }
      const label = { exam: 'to the exam', bank: 'to the question bank', draft: 'as a draft' }[target]
      setToast({
        message: `Saved ${result.count} question${result.count === 1 ? '' : 's'} ${label}.`,
        examId: target === 'exam' ? selectedExamId : null,
      })
    } catch (err) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const selectedQuestions = questions ? questions.filter((_, i) => !removedIndices.has(i)) : []

  const downloadBlob = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const exportJson = () => {
    downloadBlob(JSON.stringify(selectedQuestions, null, 2), 'ai-generated-questions.json', 'application/json')
  }

  const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

  const exportCsv = () => {
    const header = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Explanation', 'Difficulty', 'Key Concepts']
    const rows = selectedQuestions.map((q) => [
      q.question,
      q.options[0] ?? '',
      q.options[1] ?? '',
      q.options[2] ?? '',
      q.options[3] ?? '',
      q.answer,
      q.explanation,
      q.difficulty,
      q.key_concepts.join('; '),
    ])
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n')
    downloadBlob(csv, 'ai-generated-questions.csv', 'text/csv')
  }

  const progressPct =
    progress?.stage === 'generating'
      ? Math.min(100, Math.round((progress.good_count / TARGET_GOOD) * 100))
      : progress?.stage === 'final_judging' || questions
      ? 100
      : 0

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link to="/admin" className="text-xs text-primary underline">← Admin panel</Link>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Generate questions with AI</h1>
          <p className="text-sm text-muted-foreground">
            Generate → Judge → Refine: candidate questions are generated and screened one at a
            time until 20 pass, then the hardest are kept.
          </p>
        </header>

        <form onSubmit={handleGenerate} className="space-y-4 rounded-md border border-border bg-card p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Course Name
              <input
                required
                disabled={generating}
                value={form.course_name}
                onChange={updateField('course_name')}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                placeholder="Data Structures & Algorithms"
              />
            </label>
            <label className="block text-sm">
              Subject
              <select
                disabled={generating}
                value={form.subject}
                onChange={updateField('subject')}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                {SUBJECTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            Course Description
            <textarea
              required
              disabled={generating}
              rows={5}
              value={form.course_description}
              onChange={updateField('course_description')}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              placeholder="What the course covers, target level, prerequisites…"
            />
          </label>

          <label className="block text-sm">
            Syllabus
            <textarea
              required
              disabled={generating}
              rows={5}
              value={form.syllabus}
              onChange={updateField('syllabus')}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              placeholder="Weekly topics / outline…"
            />
          </label>

          <label className="block text-sm">
            Past Exam / Homework Content <span className="text-muted-foreground">(optional)</span>
            <textarea
              disabled={generating}
              rows={3}
              value={form.past_exam_content}
              onChange={updateField('past_exam_content')}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              placeholder="Paste prior questions for style/topic grounding…"
            />
          </label>

          <div>
            <span className="mb-1 block text-sm">Number of questions to generate</span>
            <div className="flex gap-4">
              {[5, 10, 15].map((n) => (
                <label key={n} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="num_questions"
                    disabled={generating}
                    checked={form.num_questions === n}
                    onChange={() => setForm((f) => ({ ...f, num_questions: n }))}
                  />
                  {n}
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-sm">Difficulty</span>
            <div className="flex gap-4">
              {DIFFICULTY_LEVELS.map((d) => (
                <label key={d.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="difficulty_level"
                    disabled={generating}
                    checked={form.difficulty_level === d.value}
                    onChange={() => setForm((f) => ({ ...f, difficulty_level: d.value }))}
                  />
                  {d.label}
                  {d.hint && <span className="text-xs text-muted-foreground">({d.hint})</span>}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
          )}

          <button
            type="submit"
            disabled={generating}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate Questions'}
          </button>
        </form>

        {progress && !questions && (
          <div className="space-y-3 rounded-md border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-foreground">
                {progress.stage === 'generating' &&
                  `Generating questions… ${progress.good_count}/${TARGET_GOOD} approved so far (iteration ${progress.iteration})`}
                {progress.stage === 'final_judging' &&
                  `Running final quality check… ${progress.question_index + 1}/${progress.total}`}
              </p>
              {progress.stage === 'generating' && progress.provider && (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Using: {progress.provider}{progress.model ? ` (${progress.model})` : ''}
                </span>
              )}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {activityLog.length > 0 && (
              <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto border-t border-border pt-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Live activity
                </p>
                {activityLog.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span
                      className={`mt-0.5 inline-block shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                        item.verdict === 'Keep'
                          ? 'border-green-300 bg-green-100 text-green-800'
                          : 'border-gray-300 bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.verdict === 'Keep' ? 'Kept' : 'Rejected'}
                    </span>
                    <span className="text-muted-foreground">{truncate(item.question, 90)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {questions && (
          <div className="space-y-4 rounded-md border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-foreground">
                {questions.length} question{questions.length === 1 ? '' : 's'} generated
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={exportJson}
                  disabled={selectedQuestions.length === 0}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={selectedQuestions.length === 0}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Question</th>
                    <th className="py-2 pr-3">Difficulty</th>
                    <th className="py-2 pr-3">Key Concepts</th>
                    <th className="py-2 pr-3">Correct Answer</th>
                    <th className="py-2 pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => {
                    const removed = removedIndices.has(i)
                    return (
                      <tr key={i} className={`border-b border-border/50 ${removed ? 'opacity-40' : ''}`}>
                        <td className="py-2 pr-3 align-top">{i + 1}</td>
                        <td className="py-2 pr-3 align-top">{truncate(q.question, 80)}</td>
                        <td className="py-2 pr-3 align-top">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${difficultyBadgeClass(q.difficulty)}`}>
                            {q.difficulty}/10
                          </span>
                        </td>
                        <td className="py-2 pr-3 align-top text-xs text-muted-foreground">
                          {q.key_concepts.join(', ')}
                        </td>
                        <td className="py-2 pr-3 align-top text-xs">{truncate(q.answer, 60)}</td>
                        <td className="py-2 pr-3 align-top">
                          <button
                            type="button"
                            onClick={() => toggleRemove(i)}
                            className="text-xs text-destructive underline"
                          >
                            {removed ? 'Undo' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              {selectedIndices.length} of {questions.length} selected for saving.
            </p>

            <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
              <label className="block text-sm">
                Add to Exam
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="mt-1 w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select an exam…</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>{exam.title}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={saving || selectedIndices.length === 0}
                onClick={() => handleSave('draft')}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save as Draft'}
              </button>
              <button
                type="button"
                disabled={saving || selectedIndices.length === 0}
                onClick={() => handleSave('bank')}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save to Question Bank'}
              </button>
              <button
                type="button"
                disabled={saving || selectedIndices.length === 0 || !selectedExamId}
                onClick={() => handleSave('exam')}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save to Exam'}
              </button>
            </div>

            {toast && (
              <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
                {toast.message}
                {toast.examId && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/${toast.examId}`)}
                      className="font-medium underline"
                    >
                      Open exam
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
