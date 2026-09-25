import { Fragment, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useExam, useExamAttempts } from '@/hooks/exam-hooks'

// Mirrors ExamProctoring.tsx's ANOMALY_LABELS — small local copy, falls back
// to the raw type string for anything not listed.
const PROCTORING_EVENT_LABELS = {
  noFace: 'No face in frame',
  cameraOff: 'Camera turned off',
  multipleFaces: 'Multiple faces detected',
  blurDetection: 'Camera view is blurry',
  voiceDetection: 'Voice detected',
  faceRecognition: "Face doesn't match registered identity",
  cameraIntegrity: 'Camera integrity issue',
}

// Teacher-facing: every attempt on one exam, in one table — proctoring
// flags, tab-switch counts, scores — so a teacher isn't limited to viewing
// one student's attempt at a time (that's what /result/:attemptId is for;
// this page links out to it rather than duplicating its rendering).
export default function AttemptsPage() {
  const { examId } = useParams()
  const { data: exam, isLoading: examLoading } = useExam(examId)
  const { data: attempts, isLoading: attemptsLoading, isError, error } = useExamAttempts(examId)

  // Which attempt's proctoring-evidence panel is currently expanded (row id,
  // or null when none) — clicking the flags badge again collapses it. Only
  // one attempt's panel is shown at a time so a table with many rows doesn't
  // turn into a wall of images.
  const [expandedAttemptId, setExpandedAttemptId] = useState(null)

  const isLoading = examLoading || attemptsLoading

  const flaggedCount = (attempts || []).filter((a) => (a.proctoringEvents?.length ?? 0) > 0).length
  const tabSwitchCount = (attempts || []).filter((a) => (a.tabSwitches ?? 0) > 0).length

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Link to={`/admin/${examId}`} style={{ fontSize: 13, color: '#2563EB', textDecoration: 'none' }}>
            ← Back to test
          </Link>
          <h1 style={{ margin: '4px 0 0' }}>
            {exam ? `Attempts — ${exam.title}` : 'Attempts'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/admin/${examId}/analytics`} style={btn('#6B7280')}>Analytics</Link>
          <Link to="/admin" style={btn('#6B7280')}>All tests</Link>
        </div>
      </div>

      {isLoading ? (
        <p style={{ fontSize: 14, color: '#6B7280' }}>Loading…</p>
      ) : isError ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#991B1B' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Not authorized</div>
          <div style={{ fontSize: 13 }}>
            {error?.message || 'You do not have permission to view attempts for this exam.'}
          </div>
        </div>
      ) : (attempts || []).length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#F9FAFB', border: '1px dashed #D1D5DB', borderRadius: 8, color: '#6B7280' }}>
          No attempts yet. Once students take this test, their attempts will show up here.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <SummaryStat label="Total attempts" value={attempts.length} />
            <SummaryStat label="With proctoring flags" value={flaggedCount} accent={flaggedCount > 0 ? '#92400E' : undefined} />
            <SummaryStat label="With tab switches" value={tabSwitchCount} accent={tabSwitchCount > 0 ? '#991B1B' : undefined} />
          </div>

          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#F3F4F6' }}>
                <tr>
                  <Th>Student</Th>
                  <Th>Submitted</Th>
                  <Th>Score</Th>
                  <Th>Correct</Th>
                  <Th>Proctoring</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => {
                  const flagTypes = Array.from(
                    new Set((a.proctoringEvents || []).map((e) => e.type))
                  )
                  const flagCount = a.proctoringEvents?.length ?? 0
                  const tabSwitches = a.tabSwitches ?? 0
                  const snapshots = (a.proctoringEvents || []).filter((e) => e.imageDataUrl)
                  const isExpanded = expandedAttemptId === a.id
                  return (
                    <Fragment key={a.id}>
                      <tr style={{ borderTop: '1px solid #E5E7EB' }}>
                        <Td>
                          {a.studentName ? (
                            <div>
                              <div>{a.studentName}</div>
                              {a.studentEmail && (
                                <div style={{ fontSize: 12, color: '#6B7280' }}>{a.studentEmail}</div>
                              )}
                            </div>
                          ) : (
                            // Attempts submitted before this field existed have no
                            // snapshotted name — fall back to the raw id rather than
                            // showing nothing.
                            <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{a.studentId}</span>
                          )}
                        </Td>
                        <Td>{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '—'}</Td>
                        <Td>{a.score} / {a.totalMarks}</Td>
                        <Td>{a.correctCount} / {a.total}</Td>
                        <Td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {flagCount > 0 && (
                              <button
                                type="button"
                                title={
                                  snapshots.length > 0
                                    ? `${flagTypes.join(', ')} — click to view snapshots`
                                    : flagTypes.join(', ')
                                }
                                onClick={() => setExpandedAttemptId(isExpanded ? null : a.id)}
                                style={{
                                  padding: '2px 8px', borderRadius: 12, fontSize: 12,
                                  background: '#FEF3C7', color: '#92400E',
                                  border: 'none', cursor: snapshots.length > 0 ? 'pointer' : 'default',
                                  font: 'inherit',
                                }}
                              >
                                {flagCount} flag{flagCount === 1 ? '' : 's'}
                                {flagTypes.length > 0 ? ` (${flagTypes.join(', ')})` : ''}
                                {snapshots.length > 0 ? ` · ${isExpanded ? 'hide' : 'view'} snapshots` : ''}
                              </button>
                            )}
                            {tabSwitches > 0 && (
                              <span style={{
                                padding: '2px 8px', borderRadius: 12, fontSize: 12,
                                background: '#FEE2E2', color: '#991B1B',
                              }}>{tabSwitches} tab switch{tabSwitches === 1 ? '' : 'es'}</span>
                            )}
                            {flagCount === 0 && tabSwitches === 0 && (
                              <span style={{ fontSize: 12, color: '#9CA3AF' }}>—</span>
                            )}
                          </div>
                        </Td>
                        <Td>
                          <Link to={`/result/${a.id}`} style={btn('#2563EB')}>View</Link>
                        </Td>
                      </tr>
                      {isExpanded && snapshots.length > 0 && (
                        <tr style={{ borderTop: '1px solid #E5E7EB' }}>
                          <td colSpan={6} style={{ padding: '12px 12px', background: '#FFFBEB' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#92400E', marginBottom: 8 }}>
                              Proctoring evidence snapshots
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                              {snapshots.map((e, i) => (
                                <a
                                  key={i}
                                  href={e.imageDataUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open full size in a new tab"
                                  style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                                    width: 96, padding: 6, background: '#fff', borderRadius: 6,
                                    border: '1px solid #FDE68A', textDecoration: 'none',
                                  }}
                                >
                                  <img
                                    src={e.imageDataUrl}
                                    alt={PROCTORING_EVENT_LABELS[e.type] || e.type}
                                    style={{ width: '100%', height: 64, objectFit: 'cover', borderRadius: 4 }}
                                  />
                                  <span style={{ fontSize: 10, fontWeight: 600, color: '#92400E', textAlign: 'center' }}>
                                    {PROCTORING_EVENT_LABELS[e.type] || e.type}
                                  </span>
                                  <span style={{ fontSize: 9, color: '#9CA3AF' }}>
                                    {e.at ? new Date(e.at).toLocaleTimeString() : ''}
                                  </span>
                                </a>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const SummaryStat = ({ label, value, accent }) => (
  <div style={{ padding: '10px 16px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, minWidth: 140 }}>
    <div style={{ fontSize: 12, color: '#6B7280' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 600, color: accent || '#111827' }}>{value}</div>
  </div>
)

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
