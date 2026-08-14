import { Link, useNavigate } from 'react-router-dom'
import { DEMO_EXAM } from '@/lib/examStore'
import { useAuthStore } from '@/store/auth-store'
import { usePublishedExams } from '@/hooks/exam-hooks'

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
  const exams = [DEMO_EXAM, ...(publishedExams ?? [])]

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              ViBe Test Platform
            </h1>
          </div>
          {user?.role === 'teacher' && (
            <Link
              to="/admin"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Admin Panel
            </Link>
          )}
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
                return (
                  <li
                    key={e.id}
                    className="rounded-md border border-border bg-card p-4 shadow-sm"
                  >
                    <h3 className="font-semibold text-foreground">{e.title}</h3>
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
                    <button
                      type="button"
                      disabled={status !== 'open'}
                      onClick={() => navigate(`/exam/${e.id}`)}
                      className="mt-3 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {status === 'not-open' ? 'Not open yet' : status === 'closed' ? 'Closed' : 'Start Test'}
                    </button>
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
