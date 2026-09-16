import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEMO_EXAM } from '@/lib/examStore'
import { useMyAttempts } from '@/hooks/exam-hooks'

// The demo exam's attempts are the only ones still written to localStorage
// (see ExamPage.jsx) — everything else now lives in the backend and is
// fetched via useMyAttempts(). This page merges the two into one history
// list.
function loadDemoAttempts() {
  try {
    const idx = JSON.parse(localStorage.getItem('attempts_index') || '[]')
    const seen = new Set(idx.map((a) => a.attemptId))

    // Backfill: scan localStorage for any result_* entries that aren't in
    // the index yet (older attempts saved before attempts_index existed).
    const backfilled = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith('result_')) continue
      const attemptId = key.slice('result_'.length)
      if (seen.has(attemptId)) continue
      try {
        const payload = JSON.parse(localStorage.getItem(key) || 'null')
        if (!payload) continue
        backfilled.push({
          attemptId,
          examId: payload.examId || '',
          examTitle: payload.examTitle || (payload.examId === 'demo' ? DEMO_EXAM.title : 'Previous attempt'),
          submittedAt: payload.submittedAt || new Date(0).toISOString(),
          score: payload.score ?? 0,
          totalMarks: payload.totalMarks ?? 0,
          correctCount: payload.correctCount ?? 0,
          total: payload.total ?? (payload.questions?.length || 0),
          proctoringFlags: payload.proctoringEvents?.length ?? 0,
        })
        seen.add(attemptId)
      } catch {}
    }

    const merged = [...idx, ...backfilled].sort(
      (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
    )

    if (backfilled.length > 0) {
      localStorage.setItem('attempts_index', JSON.stringify(merged.slice(0, 200)))
    }

    // Only the demo exam's attempts belong on this local list — older,
    // pre-migration local attempts for other (now backend-backed) exams are
    // intentionally excluded, since they can no longer be re-validated
    // against an exam definition that lives in examStore.
    return merged.filter((a) => a.examId === 'demo')
  } catch {
    return []
  }
}

export default function MyTestsPage() {
  const [demoAttempts, setDemoAttempts] = useState([])
  const { data: apiAttempts } = useMyAttempts()

  const refreshDemoAttempts = () => setDemoAttempts(loadDemoAttempts())

  useEffect(() => {
    refreshDemoAttempts()
    const onFocus = () => refreshDemoAttempts()
    window.addEventListener('focus', onFocus)
    window.addEventListener('storage', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('storage', onFocus)
    }
  }, [])

  const removeDemoAttempt = (attemptId) => {
    if (!confirm('Delete this attempt?')) return
    const idx = JSON.parse(localStorage.getItem('attempts_index') || '[]')
    localStorage.setItem('attempts_index', JSON.stringify(idx.filter((a) => a.attemptId !== attemptId)))
    localStorage.removeItem(`result_${attemptId}`)
    setDemoAttempts((prev) => prev.filter((a) => a.attemptId !== attemptId))
  }

  const clearDemoAttempts = () => {
    if (!confirm('Delete all local demo attempts?')) return
    demoAttempts.forEach((a) => localStorage.removeItem(`result_${a.attemptId}`))
    const idx = JSON.parse(localStorage.getItem('attempts_index') || '[]')
    localStorage.setItem('attempts_index', JSON.stringify(idx.filter((a) => a.examId !== 'demo')))
    setDemoAttempts([])
  }

  const unifiedDemo = demoAttempts.map((a) => ({
    attemptId: a.attemptId,
    examTitle: a.examTitle || 'Exam',
    submittedAt: a.submittedAt,
    score: a.score,
    totalMarks: a.totalMarks,
    correctCount: a.correctCount,
    total: a.total,
    revealAnswers: !!DEMO_EXAM.revealAnswers,
    proctoringFlags: a.proctoringFlags ?? 0,
    tabSwitches: a.tabSwitches ?? 0,
    isRemote: false,
  }))

  const unifiedRemote = (apiAttempts || []).map((a) => ({
    attemptId: a.id,
    examTitle: a.examTitle || 'Exam',
    submittedAt: a.submittedAt ? new Date(a.submittedAt).toISOString() : new Date(0).toISOString(),
    score: a.score,
    totalMarks: a.totalMarks,
    correctCount: a.correctCount,
    total: a.total,
    // The backend snapshots revealAnswers on the attempt itself at submit
    // time, so no separate "look up the live exam" step is needed here.
    revealAnswers: !!a.revealAnswers,
    proctoringFlags: a.proctoringEvents?.length ?? 0,
    tabSwitches: a.tabSwitches ?? 0,
    isRemote: true,
  }))

  const attempts = [...unifiedDemo, ...unifiedRemote].sort(
    (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>My Tests</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/" style={btn('#6B7280')}>Home</Link>
          {demoAttempts.length > 0 && (
            <button onClick={clearDemoAttempts} style={btn('#DC2626')}>Clear local attempts</button>
          )}
        </div>
      </div>

      {attempts.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#F9FAFB', border: '1px dashed #D1D5DB', borderRadius: 8, color: '#6B7280' }}>
          No attempts yet. Complete an exam to see it here.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#F3F4F6' }}>
              <tr>
                <Th>Exam</Th>
                <Th>Submitted</Th>
                <Th>Score</Th>
                <Th>Correct</Th>
                <Th>Reveal</Th>
                <Th>Proctoring</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => {
                const reveal = a.revealAnswers
                return (
                  <tr key={a.attemptId} style={{ borderTop: '1px solid #E5E7EB' }}>
                    <Td><strong>{a.examTitle}</strong></Td>
                    <Td>{new Date(a.submittedAt).toLocaleString()}</Td>
                    <Td>{reveal ? `${a.score} / ${a.totalMarks}` : 'Hidden'}</Td>
                    <Td>{reveal ? `${a.correctCount} / ${a.total}` : `— / ${a.total}`}</Td>
                    <Td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 12,
                        background: reveal ? '#DCFCE7' : '#FEE2E2',
                        color: reveal ? '#166534' : '#991B1B',
                      }}>{reveal ? 'ON' : 'OFF'}</span>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {a.proctoringFlags > 0 && (
                          <span style={{
                            padding: '2px 8px', borderRadius: 12, fontSize: 12,
                            background: '#FEF3C7', color: '#92400E',
                          }}>{a.proctoringFlags} flag{a.proctoringFlags === 1 ? '' : 's'}</span>
                        )}
                        {a.tabSwitches > 0 && (
                          <span style={{
                            padding: '2px 8px', borderRadius: 12, fontSize: 12,
                            background: '#FEE2E2', color: '#991B1B',
                          }}>{a.tabSwitches} tab switch{a.tabSwitches === 1 ? '' : 'es'}</span>
                        )}
                        {a.proctoringFlags === 0 && a.tabSwitches === 0 && (
                          <span style={{ fontSize: 12, color: '#9CA3AF' }}>—</span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link to={`/result/${a.attemptId}`} style={btn('#2563EB')}>View / PDF</Link>
                        {!a.isRemote && (
                          <button onClick={() => removeDemoAttempt(a.attemptId)} style={btn('#DC2626')}>Delete</button>
                        )}
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const Th = ({ children }) => (
  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 13, color: '#374151' }}>{children}</th>
)
const Td = ({ children }) => (
  <td style={{ padding: '10px 12px', fontSize: 14, color: '#111827' }}>{children}</td>
)
const btn = (bg) => ({
  padding: '6px 12px', background: bg, color: '#fff', border: 'none',
  borderRadius: 6, cursor: 'pointer', textDecoration: 'none', fontSize: 13, display: 'inline-block',
})
