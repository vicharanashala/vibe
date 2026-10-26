import { Fragment, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useExam, useExamAttempts } from '@/hooks/exam-hooks'
import { computeExamAnalytics, alphaInterpretation } from '@/lib/examAnalytics'

// Teacher-facing class analytics for one exam — real, research-grade stats
// (mean/median/SD, pass rate, Cronbach's alpha, per-item difficulty &
// discrimination, distractor breakdown) computed client-side from the same
// `GET /exams/:examId/attempts` payload AttemptsPage.jsx already renders as
// a table. See src/lib/examAnalytics.js for the actual math — this file is
// presentation only.
//
// Chart forms here follow the dataviz skill: score distribution and
// per-topic performance are single-series magnitude comparisons, so both
// use plain sequential (one-hue) horizontal bars rather than a categorical
// palette — identity isn't the point, magnitude is. The existing app blue
// (#2563EB, already this page's primary/link color) doubles as that one
// sequential hue rather than introducing a second, mismatched blue.
export default function AnalyticsPage() {
  const { examId } = useParams()
  const { data: exam, isLoading: examLoading } = useExam(examId)
  const { data: attempts, isLoading: attemptsLoading, isError, error } = useExamAttempts(examId)
  const [expandedItemId, setExpandedItemId] = useState(null)

  const isLoading = examLoading || attemptsLoading

  const analytics = useMemo(() => {
    if (!exam || !attempts) return null
    return computeExamAnalytics(exam, attempts)
  }, [exam, attempts])

  const handleExportSummary = () => {
    if (!analytics) return
    const rows = [
      ['Metric', 'Value'],
      ['Exam', exam?.title || examId],
      ['Attempts (n)', analytics.n],
      ['Mean score (%)', analytics.mean ?? ''],
      ['Median score (%)', analytics.median ?? ''],
      ['Std deviation (%)', analytics.stdDev ?? ''],
      ['Min score (%)', analytics.min ?? ''],
      ['Max score (%)', analytics.max ?? ''],
      [
        'Pass rate',
        analytics.passRate
          ? `${(analytics.passRate.rate * 100).toFixed(1)}%`
          : 'Not computed — no passing marks configured for this exam',
      ],
      ['Passed / total', analytics.passRate ? `${analytics.passRate.count}/${analytics.passRate.n}` : ''],
      ['Mean time taken (min)', analytics.timeTaken ? analytics.timeTaken.meanMinutes : 'No data'],
      ['Median time taken (min)', analytics.timeTaken ? analytics.timeTaken.medianMinutes : 'No data'],
      [
        "Cronbach's alpha",
        analytics.cronbachAlpha.value !== null
          ? analytics.cronbachAlpha.value
          : `Not computed — ${analytics.cronbachAlpha.reason}`,
      ],
    ]
    downloadCsv(`${slug(exam?.title || examId)}-analytics-summary.csv`, rows)
  }

  const handleExportItems = () => {
    if (!analytics) return
    const header = [
      'Question ID',
      'Question text',
      'Type',
      'Topic',
      'Marks',
      'Negative marks',
      'N (attempts)',
      'Answered',
      'Correct',
      'Difficulty p (0-1)',
      'Difficulty (%)',
      'Discrimination D',
      'Discrimination note',
      'Option breakdown (% selected, * = correct)',
    ]
    const rows = [
      header,
      ...analytics.items.map((it) => [
        it.questionId,
        it.questionText,
        it.type,
        it.topic || '',
        it.marks,
        it.negativeMarks,
        it.n,
        it.answeredCount,
        it.correctCount,
        it.difficulty ? it.difficulty.raw : '',
        it.difficulty ? it.difficulty.pct : '',
        it.discrimination.value ?? '',
        it.discrimination.value === null ? it.discrimination.reason : '',
        it.optionBreakdown
          ? it.optionBreakdown.map((o) => `${o.isCorrect ? '*' : ''}${o.text}: ${o.pct}%`).join(' | ')
          : '',
      ]),
    ]
    downloadCsv(`${slug(exam?.title || examId)}-analytics-items.csv`, rows)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Link to={`/admin/${examId}`} style={{ fontSize: 13, color: '#2563EB', textDecoration: 'none' }}>
            ← Back to test
          </Link>
          <h1 style={{ margin: '4px 0 0' }}>
            {exam ? `Analytics — ${exam.title}` : 'Analytics'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/admin/${examId}/attempts`} style={btn('#6B7280')}>View attempts</Link>
          <Link to="/admin" style={btn('#6B7280')}>All tests</Link>
        </div>
      </div>

      {isLoading ? (
        <p style={{ fontSize: 14, color: '#6B7280' }}>Loading…</p>
      ) : isError ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#991B1B' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Not authorized</div>
          <div style={{ fontSize: 13 }}>
            {error?.message || 'You do not have permission to view analytics for this exam.'}
          </div>
        </div>
      ) : (attempts || []).length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#F9FAFB', border: '1px dashed #D1D5DB', borderRadius: 8, color: '#6B7280' }}>
          No attempts yet. Analytics will appear once students take this test.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
            <button onClick={handleExportSummary} style={btn('#059669')}>Export summary (CSV)</button>
            <button onClick={handleExportItems} style={btn('#059669')}>Export item analysis (CSV)</button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <StatTile label="Attempts" value={analytics.n} />
            <StatTile
              label="Mean score"
              value={analytics.mean !== null ? `${analytics.mean}%` : '—'}
              sub={
                analytics.nWithScorePct < analytics.n
                  ? `${analytics.n - analytics.nWithScorePct} attempt(s) excluded (0 total marks)`
                  : undefined
              }
            />
            <StatTile label="Median score" value={analytics.median !== null ? `${analytics.median}%` : '—'} />
            <StatTile label="Std deviation" value={analytics.stdDev !== null ? `${analytics.stdDev}%` : '—'} />
            <StatTile label="Min / Max" value={analytics.min !== null ? `${analytics.min}% / ${analytics.max}%` : '—'} />
            <StatTile
              label="Pass rate"
              value={analytics.passRate ? `${(analytics.passRate.rate * 100).toFixed(1)}%` : 'Not set'}
              sub={analytics.passRate ? `${analytics.passRate.count}/${analytics.passRate.n} passed` : 'No passing marks configured for this exam'}
              accent={analytics.passRate ? undefined : '#9CA3AF'}
            />
            <StatTile
              label="Time taken"
              value={analytics.timeTaken ? `${analytics.timeTaken.meanMinutes} min avg` : 'No data'}
              sub={
                analytics.timeTaken
                  ? `median ${analytics.timeTaken.medianMinutes} min · n=${analytics.timeTaken.n}`
                  : 'startedAt/submittedAt missing on these attempts'
              }
              accent={analytics.timeTaken ? undefined : '#9CA3AF'}
            />
          </div>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Score distribution</h2>
            <p style={sectionSubStyle}>
              Percentage score per attempt, bucketed into 10-point ranges.
              {(analytics.scoreDistribution.clampedLow > 0 || analytics.scoreDistribution.clampedHigh > 0) && (
                ` ${analytics.scoreDistribution.clampedLow} attempt(s) below 0% and ${analytics.scoreDistribution.clampedHigh} above 100% (negative marking / edge cases) are shown in the end buckets.`
              )}
            </p>
            <Histogram buckets={analytics.scoreDistribution.buckets} />
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Reliability — Cronbach's alpha</h2>
            {analytics.cronbachAlpha.value !== null ? (
              <div style={{ fontSize: 14 }}>
                <strong>α = {analytics.cronbachAlpha.value}</strong> — {alphaInterpretation(analytics.cronbachAlpha.value)}
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                  Based on {analytics.cronbachAlpha.n} attempts across {analytics.cronbachAlpha.k} scored questions.
                  Rule of thumb: &lt;0.5 poor, 0.5–0.7 questionable, 0.7–0.8 acceptable, 0.8–0.9 good, &gt;0.9 excellent.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '8px 12px' }}>
                Not enough data to compute a meaningful alpha — {analytics.cronbachAlpha.reason}.
              </div>
            )}
          </section>

          {analytics.topics && (
            <section style={sectionStyle}>
              <h2 style={sectionTitleStyle}>Performance by topic</h2>
              <p style={sectionSubStyle}>Mean % of questions answered correctly, averaged per question within each topic.</p>
              <TopicBars topics={analytics.topics} />
            </section>
          )}

          <section style={{ ...sectionStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 16px 4px' }}>
              <h2 style={sectionTitleStyle}>Item analysis</h2>
              <p style={sectionSubStyle}>
                Difficulty (p) is the fraction of attempts that got the question right (unanswered counts as
                incorrect). Discrimination (D) compares the top vs. bottom 27% of scorers on this question — a
                value below 0.2 is the classical-test-theory threshold for "reconsider this item."
              </p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#F3F4F6' }}>
                  <tr>
                    <Th>Question</Th>
                    <Th>Type</Th>
                    <Th>Topic</Th>
                    <Th>Answered / Correct</Th>
                    <Th>Difficulty (p)</Th>
                    <Th>Discrimination (D)</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.items.map((it) => {
                    const isExpanded = expandedItemId === it.questionId
                    const lowD = it.discrimination.value !== null && it.discrimination.value < 0.2
                    return (
                      <Fragment key={it.questionId}>
                        <tr style={{ borderTop: '1px solid #E5E7EB' }}>
                          <Td>
                            <span title={it.questionText}>{truncate(it.questionText, 80)}</span>
                          </Td>
                          <Td>{it.type}</Td>
                          <Td>{it.topic || '—'}</Td>
                          <Td>
                            {it.answeredCount}/{it.n} answered · {it.correctCount} correct
                          </Td>
                          <Td>{it.difficulty ? `${it.difficulty.pct}%` : '—'}</Td>
                          <Td>
                            {it.discrimination.value !== null ? (
                              <div>
                                <span style={{ fontWeight: lowD ? 600 : 400, color: lowD ? '#991B1B' : '#111827' }}>
                                  {it.discrimination.value}
                                </span>
                                {lowD && (
                                  <div style={{ fontSize: 11, color: '#991B1B' }}>⚠ Low — reconsider this item</div>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: '#9CA3AF' }} title={it.discrimination.reason}>
                                —
                              </span>
                            )}
                          </Td>
                          <Td>
                            {it.optionBreakdown && (
                              <button
                                type="button"
                                onClick={() => setExpandedItemId(isExpanded ? null : it.questionId)}
                                style={{
                                  padding: '4px 10px', borderRadius: 6, fontSize: 12,
                                  background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB',
                                  cursor: 'pointer', font: 'inherit',
                                }}
                              >
                                {isExpanded ? 'Hide options' : 'Options'}
                              </button>
                            )}
                          </Td>
                        </tr>
                        {isExpanded && it.optionBreakdown && (
                          <tr style={{ borderTop: '1px solid #E5E7EB' }}>
                            <td colSpan={7} style={{ padding: '12px 16px', background: '#F9FAFB' }}>
                              <OptionBreakdown options={it.optionBreakdown} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

// ─── small presentational pieces ────────────────────────────────

const sectionStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 16, marginBottom: 20 }
const sectionTitleStyle = { fontSize: 15, margin: '0 0 4px' }
const sectionSubStyle = { fontSize: 12, color: '#6B7280', margin: '0 0 12px' }

const StatTile = ({ label, value, sub, accent }) => (
  <div style={{ padding: '10px 16px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, minWidth: 150 }}>
    <div style={{ fontSize: 12, color: '#6B7280' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 600, color: accent || '#111827' }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
  </div>
)

const Th = ({ children }) => (
  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 13, color: '#374151' }}>{children}</th>
)
const Td = ({ children }) => (
  <td style={{ padding: '10px 12px', fontSize: 13, color: '#111827', verticalAlign: 'top' }}>{children}</td>
)
const btn = (bg) => ({
  padding: '6px 12px', background: bg, color: '#fff', border: 'none',
  borderRadius: 6, cursor: 'pointer', textDecoration: 'none', fontSize: 13, display: 'inline-block',
})

// One-hue sequential horizontal bar chart — score distribution is a
// magnitude comparison across ordered ranges, not an identity comparison,
// so per the dataviz skill's form guide this stays single-hue rather than
// pulling in a categorical palette. Value labeled at the tip (outside the
// bar), track a light neutral gray, bar capped well under the 24px spec max.
function Histogram({ buckets }) {
  const max = Math.max(1, ...buckets.map((b) => b.count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {buckets.map((b) => (
        <div key={b.bucketStart} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 68, fontSize: 12, color: '#6B7280', textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {b.bucketStart}–{b.bucketEnd}%
          </div>
          <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 4, height: 20 }}>
            <div
              style={{
                width: `${(b.count / max) * 100}%`,
                height: '100%',
                background: '#2563EB',
                borderRadius: 4,
                minWidth: b.count > 0 ? 4 : 0,
              }}
            />
          </div>
          <div style={{ width: 28, fontSize: 12, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
            {b.count}
          </div>
        </div>
      ))}
    </div>
  )
}

// Same single-hue bar treatment as the histogram — topics are being compared
// on one magnitude (mean % correct), not distinguished by identity.
function TopicBars({ topics }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {topics.map((t) => (
        <div key={t.topic} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{ width: 160, fontSize: 12, color: '#374151', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={t.topic}
          >
            {t.topic}
          </div>
          <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 4, height: 20 }}>
            <div
              style={{
                width: `${t.meanCorrectPct ?? 0}%`,
                height: '100%',
                background: '#2563EB',
                borderRadius: 4,
                minWidth: (t.meanCorrectPct ?? 0) > 0 ? 4 : 0,
              }}
            />
          </div>
          <div style={{ width: 110, fontSize: 12, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
            {t.meanCorrectPct !== null ? `${t.meanCorrectPct}%` : '—'} ({t.questionCount}q)
          </div>
        </div>
      ))}
    </div>
  )
}

// Distractor breakdown for one MCQ/MSQ item — the correct option is marked
// with a checkmark + label (not color alone), all bars share the same one
// hue since "% selected" is a single magnitude per option, not a category.
function OptionBreakdown({ options }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 520 }}>
      {options.map((o) => (
        <div key={o.optionId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 220, fontSize: 12, color: '#374151', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {o.isCorrect && <span style={{ color: '#059669', fontWeight: 600 }}>✓ </span>}
            {truncate(o.text, 50) || '(blank option)'}
          </div>
          <div style={{ flex: 1, background: '#E5E7EB', borderRadius: 4, height: 14 }}>
            <div style={{ width: `${o.pct}%`, height: '100%', background: '#2563EB', borderRadius: 4, minWidth: o.pct > 0 ? 3 : 0 }} />
          </div>
          <div style={{ width: 50, fontSize: 12, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{o.pct}%</div>
        </div>
      ))}
    </div>
  )
}

// ─── helpers ────────────────────────────────────────────────────

function truncate(text, maxLen) {
  if (!text) return ''
  const t = String(text).trim()
  return t.length > maxLen ? t.slice(0, maxLen).trimEnd() + '…' : t
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'exam'
}

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
}

// Client-side-only CSV download — no backend call, same Blob + object-URL
// pattern used for any other "export a file from data already in the page"
// flow.
function downloadCsv(filename, rows) {
  const csv = toCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
