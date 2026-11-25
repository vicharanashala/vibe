/**
 * Pure formatting + styling helpers extracted from TeacherSRDashboard.tsx
 * on 2026-08-13 so they could be shared with the per-student
 * course-grouped drill-down (StudentCourseCardList.tsx).
 *
 * Extracted (not rewritten):
 *   - formatRelativeWhen(iso)
 *   - retentionColor(ef)
 *   - efStripeClass(ef)
 *
 * Kept in TeacherSRDashboard.tsx (still used by the aggregate cohort
 * view):
 *   - statAccentClass(...)
 *   - computeStudentStats(items)
 *
 * If a third consumer appears for statAccentClass or computeStudentStats,
 * promote them here too.
 */

/**
 * Human-friendly relative-time formatter for the per-card "next review due"
 * column. Days-precision only — matches the existing `interval_days` field
 * already shown on each card. Designed to read at a glance:
 *   - "today" / "tomorrow"  → short, no unit suffix
 *   - "overdue 2d"          → negative prefix, days count, unit
 *   - "in 5d"               → positive prefix, days count, unit
 *   - "-"                   → for invalid / unparseable input (defensive)
 */
export function formatRelativeWhen(iso: string | null | undefined): string {
  if (!iso) return '-';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '-';
  const diffMs = ts - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays > 0) return `in ${diffDays}d`;
  // diffDays < -1: overdue. Use a positive count for readability.
  return `overdue ${Math.abs(diffDays)}d`;
}

/**
 * EF → text colour class for the per-card EF number badge.
 * Same thresholds as efStripeClass() and statAccentClass("ef").
 */
export function retentionColor(ef: number): string {
  if (ef >= 2.5) return 'text-green-600';
  if (ef >= 1.8) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Per-card left-stripe colour (added 2026-08-04). Mirrors retentionColor()
 * but returns a Tailwind class for `border-l-{color}-{weight}` so a
 * glance at the card list tells the retention story without reading
 * every number.
 *   >= 2.5 → emerald  (strong)
 *   >= 1.8 → amber    (steady)
 *   <  1.8 → rose     (needs work)
 */
export function efStripeClass(ef: number): string {
  if (ef >= 2.5) return 'border-l-emerald-500';
  if (ef >= 1.8) return 'border-l-amber-500';
  return 'border-l-rose-500';
}
