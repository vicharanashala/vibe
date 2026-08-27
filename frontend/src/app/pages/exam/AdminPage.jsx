import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useMyExams,
  useCreateExam,
  useDeleteExam,
  useUpdateExam,
} from '@/hooks/exam-hooks'

function totalMarks(exam) {
  return (exam.questions || []).reduce((sum, q) => sum + (Number(q.marks) || 0), 0)
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { data: exams = [], isLoading } = useMyExams()
  const createExam = useCreateExam()
  const deleteExam = useDeleteExam()
  const updateExam = useUpdateExam()

  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(30)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    const exam = await createExam.mutateAsync({ title: title.trim(), duration })
    setTitle('')
    setDuration(30)
    navigate(`/admin/${exam.id}`)
  }

  const handleTogglePublish = (exam) => {
    updateExam.mutate({ examId: exam.id, patch: { published: !exam.published } })
  }

  const handleDelete = (exam) => {
    if (confirm(`Delete "${exam.title}"?`)) deleteExam.mutate(exam.id)
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">
              Create, edit, and publish mock tests.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/admin/ai-generate" className="text-sm text-primary hover:underline">
              Generate with AI
            </Link>
            <Link to="/" className="text-sm text-primary hover:underline">
              ← Back to home
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Create new mock test</h2>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="MERN STACK TEST 1"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Duration (min)
              </label>
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 30)}
                className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={createExam.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createExam.isPending ? 'Creating…' : 'Create'}
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">All tests</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : exams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Questions</th>
                    <th className="py-2 pr-4">Marks</th>
                    <th className="py-2 pr-4">Duration</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((exam) => (
                    <tr key={exam.id} className="border-b border-border/60">
                      <td className="py-2 pr-4 font-medium">{exam.title}</td>
                      <td className="py-2 pr-4">{exam.questions.length}</td>
                      <td className="py-2 pr-4">{totalMarks(exam)}</td>
                      <td className="py-2 pr-4">{exam.duration} min</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            exam.published
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {exam.published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/admin/${exam.id}`}
                            className="rounded border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                          >
                            Edit
                          </Link>
                          <Link
                            to={`/admin/${exam.id}/attempts`}
                            className="rounded border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                          >
                            View attempts
                          </Link>
                          <Link
                            to={`/admin/${exam.id}/analytics`}
                            className="rounded border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                          >
                            Analytics
                          </Link>
                          <button
                            onClick={() => handleTogglePublish(exam)}
                            disabled={
                              (!exam.published && exam.questions.length === 0) ||
                              updateExam.isPending
                            }
                            className="rounded border border-input bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                            title={
                              !exam.published && exam.questions.length === 0
                                ? 'Add questions before publishing'
                                : ''
                            }
                          >
                            {exam.published ? 'Unpublish' : 'Publish'}
                          </button>
                          {exam.published && exam.questions.length > 0 && (
                            <Link
                              to={`/exam/${exam.id}`}
                              className="rounded border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                            >
                              Preview
                            </Link>
                          )}
                          <button
                            onClick={() => handleDelete(exam)}
                            disabled={deleteExam.isPending}
                            className="rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
