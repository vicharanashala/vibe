import { Link, useNavigate } from 'react-router-dom'
import { DEMO_EXAM } from '@/lib/examStore'
import { useAuthStore } from '@/store/auth-store'
import { usePublishedExams, useMyAttempts } from '@/hooks/exam-hooks'
import { ThemeToggle } from '@/components/theme-toggle'

function totalMarks(exam) {
  return (exam.questions || []).reduce((sum, q) => sum + (Number(q.marks) || 0), 0)
}

function formatDateTime(epochMs) {
  try {
    return new Date(epochMs).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return ''
  }
}

// The demo exam never has opensAt/closesAt, so this is always "open" for it.
function getScheduleState(exam) {
  const now = Date.now()
  if (exam.closesAt !== undefined && exam.closesAt !== null && now > exam.closesAt) {
    return { status: 'closed' }
  }
  if (exam.opensAt !== undefined && exam.opensAt !== null && now < exam.opensAt) {
    return { status: 'not-open' }
  }
  return { status: 'open' }
}

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  // The demo exam is always shown first, entirely client-side, whether the
  // published-exams request is still loading, fails, or the backend is
  // simply unreachable — that's the whole point of it (see the module
  // migration plan's "Frontend" section).
  const { data: publishedExams } = usePublishedExams()
  const { data: myAttempts } = useMyAttempts()
  const exams = [DEMO_EXAM, ...(publishedExams ?? [])]

  // Per-exam attempt history for the current user — drives both the
  // "already attempted" lock (retakes disabled + at least one attempt) and
  // the attempts-used count shown when retakes are allowed.
  const attemptsByExam = (myAttempts ?? []).reduce((acc, a) => {
    (acc[a.examId] ??= []).push(a)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {/* A real <a>, not react-router's <Link>: this page renders
                inside ExamAppShell's own MemoryRouter, so a <Link> can only
                navigate within that isolated router — there was previously
                no way to leave the exam module and get back to the main
                ViBe dashboard at all. A plain anchor forces a real browser
                navigation the outer app's router picks up instead. */}
            <a
              href="/"
              className="mb-2 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              ← Back to ViBe Dashboard
            </a>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              ViBe Test Platform
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* This page has no persistent dashboard header/sidebar of its
                own (ExamAppShell renders it standalone inside a
                MemoryRouter), so it had no way to reach the theme toggle
                that lives in that outer chrome. */}
            <ThemeToggle />
            {user?.role === 'teacher' && (
              <Link
                to="/admin"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Admin Panel
              </Link>
            )}
          </div>
        </header>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Available tests</h2>
          {exams.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No published tests yet.
              {user?.role === 'teacher' ? (
                <>
                  {' '}
                  <Link to="/admin" className="text-primary underline">
                    Create one in the admin panel
                  </Link>
                  .
                </>
              ) : (
                ' Please contact your instructor to publish an exam.'
              )}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {exams.map((e) => {
                const total = totalMarks(e)
                const { status } = getScheduleState(e)
                const retakesAllowed = e.allowRetakes !== false
                const myExamAttempts = [...(attemptsByExam[e.id] ?? [])].sort(
                  (a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0)
                )
                const attemptCount = myExamAttempts.length
                // Retakes off + already attempted: nothing left to start —
                // don't even open the exam page, offer the past result
                // instead of a "Start Test" that would just fail server-side.
                const alreadyAttempted = !retakesAllowed && attemptCount > 0
                return (
                  <li
                    key={e.id}
                    className="rounded-md border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground">{e.title}</h3>
                      {retakesAllowed ? (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Multiple attempts allowed{attemptCount > 0 ? ` · ${attemptCount} used` : ''}
                        </span>
                      ) : (
                        alreadyAttempted && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Already attempted
                          </span>
                        )
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e.questions.length} questions · {e.duration} min · {total} marks
                    </p>
                    {status === 'not-open' && (
                      <p className="mt-1 text-xs font-medium text-amber-600">
                        Opens {formatDateTime(e.opensAt)}
                      </p>
                    )}
                    {status === 'closed' && (
                      <p className="mt-1 text-xs font-medium text-destructive">
                        Closed {e.closesAt ? `on ${formatDateTime(e.closesAt)}` : ''}
                      </p>
                    )}
                    {alreadyAttempted ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/result/${myExamAttempts[0].id}`)}
                        className="mt-3 inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                      >
                        View Result
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={status !== 'open'}
                        onClick={() => navigate(`/exam/${e.id}`)}
                        className="mt-3 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {status === 'not-open' ? 'Not open yet' : status === 'closed' ? 'Closed' : 'Start Test'}
                      </button>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Opens in fullscreen. Exiting fullscreen or switching tabs is recorded.
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
