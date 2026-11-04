"use client"

import { useState, useMemo, useRef, type ReactNode } from "react"
import { useQueries } from "@tanstack/react-query"
import {
  useBoostReview,
  useSetExamPrepMode,
  useSetPaused,
  useResetQuestion,
  useGetCourses,
  useGetCourseStudentsRich,
  useBulkUpdateNotifications,
  useBulkSetStudentSRDisabled,
  useGetAssignableQuestions,
  useAssignReview,
  useSetRemediationHint,
} from "@/hooks/spaced-repetition-hooks"
import { spacedRepetitionKeys } from "@/hooks/spaced-repetition-hooks"
import { studentDisplay, courseDisplay, getQuestionSummary, getSchedule, bulkUpdateExamPrepMode } from "@/lib/spaced-repetition-api"
import { CourseMultiSelectCard } from "@/components/sr-teacher/CourseMultiSelectCard"
import { StudentListPanel } from "@/components/sr-teacher/StudentListPanel"
import { StudentCourseCardList } from "@/components/sr-teacher/StudentCourseCardList"
import { retentionColor } from "@/app/pages/teacher/TeacherSRDashboard.helpers"
import { InfoPopover } from "@/components/InfoPopover"
import { SpacedRepetitionInfoBody, SPACED_REPETITION_INFO_TITLE } from "@/components/spaced-repetition-info"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Zap, Pause, Play, BookOpen, AlertCircle, GraduationCap, ChevronDown, ChevronRight, Users, Bell, BellOff, Ban, Power, Send, Library, MessageSquareText, Lightbulb } from "lucide-react"
import { toast } from "sonner"
import type { ReviewItem, QuestionSummary } from "@/types/spaced-repetition.types"

// `formatRelativeWhen`, `retentionColor`, and `efStripeClass` were moved
// out to `TeacherSRDashboard.helpers.ts` on 2026-08-13 so the new
// `StudentCourseCardList` component could reuse them without circular
// imports. Aggregate cohort UI (`statAccentClass`, `computeStudentStats`)
// still uses its own copy of the band thresholds and stays in this file.

// Stat-card top-border accent (added 2026-08-04). Same band thresholds as
// efStripeClass(), but rendered as `border-t-{color}-500`.
function statAccentClass(kind: "total" | "overdue" | "ef" | "status", value: number | string, isPaused: boolean): string {
  switch (kind) {
    case "total":
      return "border-t-slate-300"
    case "overdue":
      return typeof value === "number" && value > 0 ? "border-t-rose-500" : "border-t-emerald-500"
    case "ef": {
      const n = typeof value === "string" ? parseFloat(value) : value
      if (!Number.isFinite(n)) return "border-t-slate-300"
      if (n >= 2.5) return "border-t-emerald-500"
      if (n >= 1.8) return "border-t-amber-500"
      return "border-t-rose-500"
    }
    case "status":
      return isPaused ? "border-t-amber-500" : "border-t-emerald-500"
  }
}

/**
 * Per-student aggregate stats derived from a schedule.
 * Used by the per-student card header (always visible) and by the
 * aggregate header (summed across all selected students).
 */
function computeStudentStats(items: ReviewItem[]): {
  total: number
  overdue: number
  pausedCount: number
  examModeCount: number
  avgEF: string
  isPaused: boolean
  isExamMode: boolean
} {
  const overdue = items.filter(i => new Date(i.next_review_at).getTime() < Date.now()).length
  const pausedCount = items.filter(i => i.is_paused).length
  const examModeCount = items.filter(i => i.exam_prep_mode).length
  const avgEF = items.length
    ? (items.reduce((s, i) => s + i.EF, 0) / items.length).toFixed(2)
    : "-"
  const isPaused = pausedCount === items.length && items.length > 0
  const isExamMode = examModeCount > 0
  return { total: items.length, overdue, pausedCount, examModeCount, avgEF, isPaused, isExamMode }
}

export default function TeacherSRDashboard() {
  // Selection state (added 2026-08-03, multi-select 2026-08-05 Phase 3):
  // both courses AND students are now multi-select. Section 3 (the
  // dashboard) only renders once both arrays have at least one entry.
  // The first course in `selectedCourses` is treated as the "primary"
  // course for context-chip rendering and the student-roster query
  // (the roster app still fetches one course at a time backend-side).
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const primaryCourseId = selectedCourses[0] ?? ""

  // Scroll target for the StudentListPanel empty-state CTA (added 2026-08-11,
  // audit G4): clicking "Pick a different course" scrolls the page up to
  // the course picker so the teacher can fix the wrong course selection.
  // Ref lives on the course picker card below; smooth scroll keeps the
  // navigation friendly.
  const coursePickerRef = useRef<HTMLDivElement | null>(null)
  const scrollToCoursePicker = () => {
    coursePickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // `expandedStudentIds` is the inline-expand drill-down state (added
  // 2026-08-05, Phase 3). A Set keyed by studentId lets us toggle
  // individual cards without re-rendering the whole list. Default: all
  // collapsed (the per-student summary is the dense view; expanding
  // reveals the per-card list).
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(new Set())

  const toggleStudentExpanded = (studentId: string) => {
    setExpandedStudentIds(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  // Course → student-roster query. The backend's `getCourseStudentsRich`
  // is per-course, so when multiple courses are selected we union their
  // rosters. For the demo this is good enough; production would want a
  // backend `getCoursesStudentsRich(courseIds[])` endpoint.
  const { data: studentsData } = useGetCourseStudentsRich(primaryCourseId)
  const richStudents = studentsData?.students

  // `useGetCourses` is hoisted to the top of the component (Rules of Hooks).
  // Earlier versions called it inside a JSX prop and inside an `onToggleAll`
  // callback - both violations. The two readers below (the JSX `courses` prop
  // and the `Select all` handler) now share this single captured value.
  const { data: coursesData } = useGetCourses()

  // Fan-out: one `useGetSchedule` per selected student. Aggregating
  // across all selected students lets us render the cohort stats header
  // and per-student cards without a separate "load each student"
  // gesture. `useQueries` shares the same queryKey with `useGetSchedule`
  // so the cache is deduped if a single-student caller ever appears.
  // The queryFn calls the underlying `getSchedule` directly (calling
  // the hook itself inside queryFn would return a `UseQueryResult`,
  // not a Promise - not what `useQueries` expects).
  const scheduleQueries = useQueries({
    queries: selectedStudents.map(studentId => ({
      queryKey: spacedRepetitionKeys.schedule(studentId),
      queryFn: () => getSchedule(studentId),
    })),
  })

  // Flatten to a `studentId → items[]` map. If any query is still
  // loading we show a spinner; if any errored we surface the first.
  const studentItems: Record<string, ReviewItem[]> = useMemo(() => {
    const map: Record<string, ReviewItem[]> = {}
    selectedStudents.forEach((sid, idx) => {
      const q = scheduleQueries[idx]
      if (q?.data) map[sid] = q.data
    })
    return map
  }, [selectedStudents, scheduleQueries])

  const isLoading = selectedStudents.length > 0 && scheduleQueries.some(q => q.isLoading)
  const firstError = scheduleQueries.find(q => q.error)?.error
  const error = firstError ? String(firstError) : null

  // Per-card question body preview (Day 2, 2026-08-04). Fan out one
  // query per unique question id across ALL selected students, then
  // dedupe into a Map for O(1) lookup in the per-card render.
  const allItemsAcrossStudents = useMemo(
    () => Object.values(studentItems).flat(),
    [studentItems],
  )
  const uniqueQuestionIds = useMemo(
    () => Array.from(new Set(allItemsAcrossStudents.map(i => i.question_id))),
    [allItemsAcrossStudents],
  )
  const questionSummaryQueries = useQueries({
    queries: uniqueQuestionIds.map(id => ({
      queryKey: spacedRepetitionKeys.questionSummary(id),
      queryFn: () => getQuestionSummary(id),
      enabled: !!id,
    })),
  })
  const questionSummaryById = useMemo(() => {
    const map = new Map<string, QuestionSummary>()
    questionSummaryQueries.forEach((q, idx) => {
      const id = uniqueQuestionIds[idx]
      if (id && q.data?.question) {
        map.set(id, q.data.question)
      }
    })
    return map
  }, [questionSummaryQueries, uniqueQuestionIds])

  // Aggregate stats across the entire selection (all students × all
  // courses). Used by the "Cohort at a glance" header strip.
  const aggregateStats = useMemo(() => {
    const items = allItemsAcrossStudents
    return computeStudentStats(items)
  }, [allItemsAcrossStudents])

  // Per-student cards (one entry per selected student). Each card is
  // collapsible (inline-expand drill-down) to reveal the per-card list.
  const studentContextCards = useMemo(() => {
    return selectedStudents.map(sid => {
      const items = studentItems[sid] ?? []
      const stats = computeStudentStats(items)
      return {
        studentId: sid,
        items,
        stats,
        isExpanded: expandedStudentIds.has(sid),
      }
    })
  }, [selectedStudents, studentItems, expandedStudentIds])

  // ── Bulk global controls (added 2026-08-05, Phase 3) ────────────────
  // For multi-student scope, exam-prep is per-course. We fan out
  // `bulkUpdateExamPrepMode` across the selected courses (one HTTP
  // round-trip per course, all selected students in that course).
  // `Promise.allSettled` isolates failures per course. The summary
  // toast tells the teacher exactly how many course-stamps updated.
  //
  // Confirmation threshold: silent for ≤20 pairs, window.confirm() for
  // >20 (per the 2026-08-05 design lock-in). The threshold matches the
  // "wait, did I mean to do that?" moment where a click could be a
  // misclick on a busy desk.
  const BULK_CONFIRM_THRESHOLD = 20

  // C4 audit fix (2026-08-11): one shared confirm dialog for all bulk
  // actions. The dialog's title + description + button labels are
  // derived from a `pendingBulkAction` payload so we don't need 3
  // separate dialog instances. The dialog only opens when the bulk
  // action exceeds `BULK_CONFIRM_THRESHOLD`; below that we run silently.
  //
  // Shape of `pendingBulkAction`:
  //   - kind        = which bulk action is being confirmed
  //   - enabled     = for kind=exam_prep, whether we're turning it on
  //                   (true) or off (false). For kind=sr_disabled,
  //                   whether we're pausing (true) or resuming (false).
  //                   For kind=notifications, the opt-out flag (true =
  //                   pause reminders, false = resume them).
  //   - summary     = the human-readable count the dialog should show
  //                   ("24 (course × student) pairs", "12 students").
  //   - run         = the async fn to invoke on confirm.
  //
  // Storing the run function inside state is fine because it captures
  // only the selected IDs + the action direction (no stale React state
  // captured mid-render).
  const [pendingBulkAction, setPendingBulkAction] = useState<{
    kind: "notifications" | "sr_disabled" | "exam_prep"
    enabled: boolean
    summary: { courses: number; students: number; pairs: number }
    run: () => Promise<void>
  } | null>(null)
  const [bulkActionPending, setBulkActionPending] = useState(false)

  // Bulk SR-disabled hook (C4 audit fix, 2026-08-11). Student-level
  // flag (`user.sr_disabled`), not a per-course flag, so a single HTTP
  // call covers any number of courses selected.
  const bulkSRDisabledMutation = useBulkSetStudentSRDisabled()

  // Bulk notifications hook (C4 audit fix, 2026-08-11). Hooks into
  // the same fan-out pattern as bulk exam-prep: one HTTP round-trip
  // per course with all selected students in that course. Notifications
  // live on `review_items.notification_opt_out`, scoped per (course
  // × student), so the fan-out shape matches exam-prep.
  const bulkNotifyMutation = useBulkUpdateNotifications()

  async function bulkToggleNotifications(optOut: boolean) {
    if (selectedCourses.length === 0 || selectedStudents.length === 0) {
      return toast.error("Select at least one course and one student.")
    }
    const totalPairs = selectedCourses.length * selectedStudents.length
    if (totalPairs > BULK_CONFIRM_THRESHOLD) {
      setPendingBulkAction({
        kind: "notifications",
        enabled: optOut,
        summary: { courses: selectedCourses.length, students: selectedStudents.length, pairs: totalPairs },
        run: () => runBulkToggleNotifications(optOut),
      })
      return
    }
    await runBulkToggleNotifications(optOut)
  }
  async function runBulkToggleNotifications(optOut: boolean) {
    setBulkActionPending(true)
    try {
      const results = await Promise.allSettled(
        selectedCourses.map(courseId =>
          bulkNotifyMutation.mutateAsync({ courseId, studentIds: selectedStudents, optOut }),
        ),
      )
      const succeeded = results.filter(r => r.status === "fulfilled").length
      const failed = selectedCourses.length - succeeded
      // Per the backend dual-count contract (Bug 3 fix, 2026-08-01): the
      // server's `message` distinguishes student count from item count
      // (e.g. "Updated notifications for 3 students (6 review items).").
      // We trust the server message - but only for the success case. If
      // any course failed, we surface our own summary so the teacher can
      // tell which courses skipped.
      if (failed === 0 && succeeded > 0) {
        // First fulfilled result carries the canonical message from the
        // backend. All courses hit the same set of students in this
        // happy path, so the message is representative.
        const data = (results[0] as PromiseFulfilledResult<{ message: string }>).value
        toast.success(data.message)
      } else if (succeeded === 0) {
        toast.error(`Failed to update notifications for any of the ${failed} courses.`)
      } else {
        toast.warning(`Updated ${succeeded} course${succeeded === 1 ? "" : "s"}. ${failed} skipped.`)
      }
    } finally {
      setBulkActionPending(false)
      setPendingBulkAction(null)
    }
  }

  async function bulkToggleSRDisabled(sr_disabled: boolean) {
    if (selectedStudents.length === 0) {
      return toast.error("Select at least one student to pause spaced repetition for.")
    }
    // Single-batch mutation: the backend's `bulkSetStudentSRDisabled`
    // is student-level (courseId is ignored), so the count we confirm
    // on is just the student count. The dedupe happens server-side.
    const totalStudents = selectedStudents.length
    if (totalStudents > BULK_CONFIRM_THRESHOLD) {
      setPendingBulkAction({
        kind: "sr_disabled",
        enabled: sr_disabled,
        summary: { courses: selectedCourses.length, students: totalStudents, pairs: totalStudents },
        run: () => runBulkToggleSRDisabled(sr_disabled),
      })
      return
    }
    await runBulkToggleSRDisabled(sr_disabled)
  }
  async function runBulkToggleSRDisabled(sr_disabled: boolean) {
    setBulkActionPending(true)
    try {
      const data = await bulkSRDisabledMutation.mutateAsync({
        studentIds: selectedStudents,
        sr_disabled,
      })
      toast.success(
        sr_disabled
          ? `Paused spaced repetition for ${data.updatedCount} student${data.updatedCount === 1 ? "" : "s"}.`
          : `Resumed spaced repetition for ${data.updatedCount} student${data.updatedCount === 1 ? "" : "s"}.`,
      )
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Bulk toggle for spaced repetition failed")
    } finally {
      setBulkActionPending(false)
      setPendingBulkAction(null)
    }
  }

  // ── Manual Review Assignment (ported 2026-08-09 from ReviewScheduler) ──
  // Dialog state. The button that opens this lives in the Bulk Global
  // Controls Card (cohesion: all cohort-wide teacher actions in one
  // place). Pre-populates the dialog with the current `selectedStudents`
  // - the teacher can uncheck any they want to skip before submitting.
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignForStudents, setAssignForStudents] = useState<string[]>([])
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("")

  // Fetch the assignable question catalogue for the primary selected
  // course. We only fire when the dialog is open AND a course is
  // selected, so the list isn't pulled for every teacher sitting on
  // the dashboard.
  const { data: assignableData, isLoading: isLoadingAssignable } =
    useGetAssignableQuestions(primaryCourseId, assignDialogOpen)

  // The assign mutation is per-student (backend `/assign` is single-
  // student), so `submitAssign` fans out via `Promise.allSettled`.
  const assignMutation = useAssignReview()

  // ── Per-card Set Hint (ported 2026-08-09 from ReviewScheduler) ──────
  // Tracks which (studentId × questionId) is currently being edited
  // and what the new hint text is. Open editor takes a copy of the
  // existing hint as the initial value; closing without saving discards.
  // We use one Dialog at the page root (like Assign) and key the
  // content on the current item, rather than one dialog per item row.
  const [hintEditor, setHintEditor] = useState<{
    studentId: string
    questionId: string
    existingHint: string | null
    draft: string
  } | null>(null)
  const hintMutation = useSetRemediationHint()

  function openHintEditor(studentId: string, questionId: string, existingHint: string | null) {
    setHintEditor({ studentId, questionId, existingHint, draft: existingHint ?? "" })
  }

  function closeHintEditor() {
    setHintEditor(null)
  }

  async function saveHint() {
    if (!hintEditor) return
    // Empty string → null (clear the hint). Trim leading/trailing
    // whitespace so " " doesn't accidentally save as a real hint.
    const trimmed = hintEditor.draft.trim()
    const newHint = trimmed.length === 0 ? null : trimmed
    // Skip no-op writes (existing hint unchanged). Avoids unnecessary
    // network round-trip and the toast noise for a click that
    // cancelled.
    if (newHint === hintEditor.existingHint) {
      closeHintEditor()
      return
    }
    try {
      await hintMutation.mutateAsync({
        studentId: hintEditor.studentId,
        questionId: hintEditor.questionId,
        hint: newHint,
      })
      toast.success(
        newHint
          ? `Hint saved for question ${hintEditor.questionId.slice(-6)}`
          : `Hint cleared for question ${hintEditor.questionId.slice(-6)}`,
      )
      closeHintEditor()
      // Refetch all affected schedules so the badge updates everywhere.
      scheduleQueries.forEach(q => q.refetch())
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Failed to save hint")
    }
  }

  function openAssignDialog() {
    if (selectedCourses.length === 0) {
      return toast.error("Pick a course first.")
    }
    if (selectedStudents.length === 0) {
      return toast.error("Select at least one student to assign a review to.")
    }
    // Pre-populate with the current cohort selection.
    setAssignForStudents(selectedStudents)
    setSelectedQuestionId("")
    setAssignDialogOpen(true)
  }

  function toggleAssignStudent(studentId: string) {
    setAssignForStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(sId => sId !== studentId)
        : [...prev, studentId],
    )
  }

  async function submitAssign() {
    if (assignForStudents.length === 0) {
      return toast.error("Pick at least one student to assign to.")
    }
    if (!selectedQuestionId) return toast.error("Pick a question first.")
    if (!primaryCourseId) return

    // Fan-out via Promise.allSettled so each student's failure is
    // isolated. Backend `/assign` is idempotent on (student_id,
    // question_id), so a 409 collision is safely reported as
    // "skipped" without retrying.
    const results = await Promise.allSettled(
      assignForStudents.map((studentId) =>
        assignMutation.mutateAsync({
          studentId,
          questionId: selectedQuestionId,
          courseId: primaryCourseId,
        }),
      ),
    )

    const succeeded = results.filter((r) => r.status === "fulfilled").length
    const failed = results.length - succeeded

    // Summary toasts match the ReviewScheduler pattern: single-student
    // case keeps the autoEnabled-aware wording; multi-student case
    // uses a simple succeeded/failed count.
    if (assignForStudents.length === 1) {
      const only = results[0]
      if (only.status === "fulfilled") {
        const data = only.value as { autoEnabled?: boolean }
        if (data.autoEnabled) {
          toast.success(
            "Spaced repetition was paused for this student — resumed automatically so the assignment takes effect.",
          )
        } else {
          toast.success(`Assigned "${selectedQuestionId}" to the student's queue.`)
        }
      } else {
        const err = only.reason as Error & { status?: number }
        if (err.status === 409) {
          toast.warning(
            "This question is already on the student's review queue. Use 'Make due now' on the per-card row to push it to the front instead.",
          )
        } else {
          toast.error(`Assign failed: ${err.message}`)
        }
      }
    } else if (failed === 0) {
      toast.success(`Assigned to all ${succeeded} students.`)
    } else if (succeeded === 0) {
      toast.error(`Failed to add the review question for any of the ${failed} student${failed === 1 ? "" : "s"}.`)
    } else {
      toast.warning(
        `Assigned to ${succeeded}. ${failed} skipped (already in queue or error).`,
      )
    }

    setAssignDialogOpen(false)
    setSelectedQuestionId("")
    setAssignForStudents([])
  }

  async function bulkToggleExamPrep(enabled: boolean) {
    if (selectedCourses.length === 0 || selectedStudents.length === 0) {
      return toast.error("Select at least one course and one student.")
    }
    const totalPairs = selectedCourses.length * selectedStudents.length
    if (totalPairs > BULK_CONFIRM_THRESHOLD) {
      setPendingBulkAction({
        kind: "exam_prep",
        enabled,
        summary: { courses: selectedCourses.length, students: selectedStudents.length, pairs: totalPairs },
        run: () => runBulkToggleExamPrep(enabled),
      })
      return
    }
    await runBulkToggleExamPrep(enabled)
  }
  async function runBulkToggleExamPrep(enabled: boolean) {
    setBulkActionPending(true)
    try {
      const results = await Promise.allSettled(
        selectedCourses.map(courseId =>
          bulkUpdateExamPrepMode(courseId, selectedStudents, enabled),
        ),
      )
      const succeeded = results.filter(r => r.status === "fulfilled").length
      const failed = selectedCourses.length - succeeded
      // The dual-count response (per the bulk endpoints) carries the
      // item-level totals. We only surface the simpler pair-count here
      // because the dashboard is the cohort view, not the per-course
      // per-item view (which is ReviewScheduler).
      if (failed === 0) {
        toast.success(`Exam-Prep ${enabled ? "enabled" : "disabled"} across ${succeeded} course${succeeded === 1 ? "" : "s"} (${selectedCourses.length * selectedStudents.length} pair${selectedCourses.length * selectedStudents.length === 1 ? "" : "s"}).`)
      } else if (succeeded === 0) {
        toast.error(`Failed to update any of the ${failed} courses.`)
      } else {
        toast.warning(`Updated ${succeeded} course${succeeded === 1 ? "" : "s"}. ${failed} skipped.`)
      }
      // Refetch all affected schedules.
      scheduleQueries.forEach(q => q.refetch())
    } finally {
      setBulkActionPending(false)
      setPendingBulkAction(null)
    }
  }

  // Per-card (single-student, single-question) mutations. These stay
  // scoped to the per-student card they're rendered in - the expanded
  // view passes them a studentId + questionId directly.
  const boost = useBoostReview()
  const reset = useResetQuestion("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function handleBoost(studentId: string, questionId: string) {
    setActionLoading(`${studentId}-${questionId}-boost`)
    try {
      const r = await boost.mutateAsync({ studentId, questionId })
      toast.success(r.message)
      // Refetch this student's schedule so the inline UI updates.
      const idx = selectedStudents.indexOf(studentId)
      if (idx >= 0) scheduleQueries[idx]?.refetch()
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Boost failed")
    } finally {
      setActionLoading(null)
    }
  }

  // C4 audit fix (2026-08-11): the per-card "Send back" confirm used to
  // call the native `confirm()` dialog. Now it stages a shared shadcn
  // dialog (one dialog for all per-card resets, same approach as the
  // bulk-confirm pattern above). The pending payload is held in state
  // until the teacher confirms or cancels.
  const [pendingReset, setPendingReset] = useState<{
    studentId: string
    questionId: string
    questionShort: string
  } | null>(null)
  const [resetPending, setResetPending] = useState(false)

  function requestHandleReset(studentId: string, questionId: string) {
    setPendingReset({
      studentId,
      questionId,
      questionShort: questionId.slice(-6),
    })
  }
  async function runHandleReset(studentId: string, questionId: string) {
    setResetPending(true)
    setActionLoading(`${studentId}-${questionId}-reset`)
    try {
      const r = await reset.mutateAsync(questionId)
      toast.success(r.message)
      const idx = selectedStudents.indexOf(studentId)
      if (idx >= 0) scheduleQueries[idx]?.refetch()
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Reset failed")
    } finally {
      setActionLoading(null)
      setResetPending(false)
      setPendingReset(null)
    }
  }

  // Per-student global controls (exam-prep / pause). These are scoped
  // to a single student × all selected courses. The student-card
  // header renders these buttons so the teacher can adjust one student
  // at a time without affecting the cohort.
  function PerStudentGlobalControls({ studentId }: { studentId: string }) {
    // Lightweight per-student mutations. We use a single primary
    // course for the toggle (the first selected course) - hovering
    // shows a tooltip explaining the scope.
    const examPrep = useSetExamPrepMode(studentId, primaryCourseId)
    const pause = useSetPaused(studentId, primaryCourseId)
    const items = studentItems[studentId] ?? []
    const stats = computeStudentStats(items)
    const isExamMode = stats.isExamMode
    const isPaused = stats.isPaused

    async function toggleExamPrep() {
      try {
        const r = await examPrep.mutateAsync(!isExamMode)
        toast.success(r.message)
        const idx = selectedStudents.indexOf(studentId)
        if (idx >= 0) scheduleQueries[idx]?.refetch()
      } catch (e: unknown) {
        toast.error((e as Error)?.message ?? "Exam-prep toggle failed")
      }
    }
    async function togglePause() {
      try {
        const r = await pause.mutateAsync(!isPaused)
        toast.success(r.message)
        const idx = selectedStudents.indexOf(studentId)
        if (idx >= 0) scheduleQueries[idx]?.refetch()
      } catch (e: unknown) {
        toast.error((e as Error)?.message ?? "Pause toggle failed")
      }
    }

    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant={isExamMode ? "default" : "outline"}
          size="sm"
          onClick={toggleExamPrep}
          disabled={examPrep.isPending}
          className="h-7 text-xs"
          title={
            isExamMode
              ? `Exam-prep is on for this student in ${courseDisplay(primaryCourseId).name || "this course"} (hardest cards surface first). Click to turn off.`
              : `Switch this student into exam-prep mode for ${courseDisplay(primaryCourseId).name || "this course"} (hardest cards surface first).`
          }
        >
          {examPrep.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Zap className="w-3 h-3" />
          )}
          <span className="ml-1">{isExamMode ? "Exam-prep on" : "Exam-prep"}</span>
        </Button>
        <Button
          variant={isPaused ? "destructive" : "outline"}
          size="sm"
          onClick={togglePause}
          disabled={pause.isPending}
          className="h-7 text-xs"
          title={
            isPaused
              ? `Reminders are paused for this student in ${courseDisplay(primaryCourseId).name || "this course"}. Click to resume.`
              : `Pause review reminders for this student in ${courseDisplay(primaryCourseId).name || "this course"}. Reviews still accumulate.`
          }
        >
          {pause.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : isPaused ? (
            <Play className="w-3 h-3" />
          ) : (
            <Pause className="w-3 h-3" />
          )}
          <span className="ml-1">{isPaused ? "Paused" : "Pause"}</span>
        </Button>
      </div>
    )
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
    </div>
  )
  if (error) return (
    <div className="p-6 text-red-500 flex items-center gap-2">
      <AlertCircle className="w-4 h-4" /> Failed to load: {error}
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* ── Page header (restructured 2026-08-04, course-first IA) ────────
          Replaces the previous student-name-as-header. New accent colour
          (violet) so this page has its own identity distinct from the
          student's blue dashboard and the orange/indigo badges inside
          the card list. */}
      <div className="flex items-center gap-3 border-l-4 border-violet-500 pl-4 -ml-4">
        <BookOpen className="w-7 h-7 text-violet-600" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            Teacher review controls
            {/* Page-level help (added 2026-08-08): mirrors the student
                retention dashboard. Points at the shared module-level
                SpacedRepetitionInfoBody so the "what is spaced
                repetition" explanation lives in one place. The picker-
                and section-level InfoPopovers carry their own scoped
                bodies.

                UI-prominence tweak (2026-08-09 new-mentor audit, item
                B1/B2): bumped the trigger to indigo + larger so first-
                time mentors notice it as the "start here" anchor. The
                6 section-level InfoPopovers stay small + slate so the
                visual hierarchy says "read me first" -> "scoped help". */}
            <InfoPopover
              title={SPACED_REPETITION_INFO_TITLE}
              ariaLabel="Open the Spaced Repetition explainer - recommended for first-time use"
              triggerClassName="h-7 w-7 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 focus:ring-indigo-300"
            >
              <SpacedRepetitionInfoBody />
            </InfoPopover>
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick one or more courses and one or more students. The cohort dashboard
            shows each student&apos;s memory strength, due cards, and review activity
            - and lets you bulk-edit reminders, assign specific review questions, or
            pause spaced repetition for an entire class.
          </p>
        </div>
      </div>

      {/* ── Section 1: Courses (always visible, top of page) ────────────
          Multi-select. Selection state stays fully controlled by the
          page so changing courses clears the student picker (handled
          below). The new CourseMultiSelectCard has its own search bar
          inside, so the very first thing a teacher sees is a filterable
          list with checkboxes. */}
      <Card ref={coursePickerRef} className="border-violet-200/60 scroll-mt-4" data-testid="course-picker-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">1</span>
            Choose courses
            {/* Section-level help (added 2026-08-08): explains the role of
                this section within the page. The picker card itself has
                a more specific help icon (how to search, what "main"
                course means). */}
            <InfoPopover
              title="About choosing courses"
              ariaLabel="Help about choosing courses"
              triggerClassName="h-5 w-5"
            >
              <p>
                This is where you decide <strong>which classes</strong> to
                look at. Pick one class, or tick several to compare them.
              </p>
              <p>
                Once you pick a class, the next section will let you choose
                the students from that class.
              </p>
            </InfoPopover>
          </CardTitle>
          <CardDescription>
            Multi-select. Use the checkboxes to build a cohort across multiple courses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CourseMultiSelectCard
            courses={coursesData}
            selectedCourseIds={selectedCourses}
            onToggle={(id) => {
              setSelectedCourses(prev =>
                prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
              )
              setSelectedStudents([]) // clear stale selection on course change
            }}
            onToggleAll={() => {
              setSelectedCourses(prev =>
                prev.length > 0 ? [] : ((coursesData ?? []).map(c => c.id))
              )
              setSelectedStudents([])
            }}
          />
        </CardContent>
      </Card>

      {/* ── Section 2: Students (visible when at least one course is picked) ──
          Rendered as a soft "ghost" card before any course is picked so
          the teacher can see what comes next without it being prominent.
          Once a course is picked, the ghost swaps to the real picker
          with a coloured header chip ("Course: X") for context. */}
      {selectedCourses.length === 0 ? (
        <Card className="border-2 border-dashed border-violet-200/70 bg-violet-50/30">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <GraduationCap className="w-6 h-6 mx-auto mb-2 text-violet-400" aria-hidden="true" />
            Pick a course above to see its enrolled students.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-violet-200/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">2</span>
              Choose students
              {/* Section-level help (added 2026-08-08): mirrors the Section 1
                  pattern. The StudentListPanel itself carries a more
                  specific help icon (search, multi-select). */}
              <InfoPopover
                title="About choosing students"
                ariaLabel="Help about choosing students"
                triggerClassName="h-5 w-5"
              >
                <p>
                  This is where you decide <strong>which students</strong> to
                  check on. Tick one or tick a whole batch.
                </p>
                <p>
                  The list only shows students from the main course you
                  picked above. If you don&apos;t see a student, try
                  picking a different main course first.
                </p>
              </InfoPopover>
            </CardTitle>
            <CardDescription>
              Multi-select. Search by name or email. The dashboard below aggregates stats across all selected students.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StudentListPanel
              students={primaryCourseId ? richStudents : undefined}
              selectedStudentIds={selectedStudents}
              onToggle={(id) => {
                setSelectedStudents(prev =>
                  prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
                )
              }}
              onToggleAll={() => {
                const all = (richStudents ?? []).map(s => s.id)
                setSelectedStudents(prev =>
                  prev.length === all.length ? [] : all
                )
              }}
              headerSlot={
                selectedCourses.length === 1 ? (
                  <Badge
                    variant="outline"
                    className="border-violet-300 bg-violet-50 text-violet-800 text-xs"
                  >
                    Course: {courseDisplay(selectedCourses[0]).name}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-violet-300 bg-violet-50 text-violet-800 text-xs"
                  >
                    <Users className="w-3 h-3 mr-1" aria-hidden="true" />
                    {selectedCourses.length} courses
                  </Badge>
                )
              }
              // G4 audit fix (2026-08-11): when a teacher picks a course
              // that has no students with review schedules yet, give
              // them an escape hatch — scroll back to the course picker
              // so they can pick a different course.
              emptyStateCta={{
                label: 'Pick a different course',
                onClick: scrollToCoursePicker,
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Section 3: Cohort dashboard (visible when BOTH pickers have entries) ──
          Added 2026-08-05, Phase 3: hides everything below until the
          teacher has picked at least one course AND one student. The
          pickers "occupy center stage" until then (per Emie's
          instruction). Once both are picked, the dashboard unfolds:
          aggregate stats header → bulk global controls → per-student
          cards (collapsible). */}
      {selectedCourses.length > 0 && selectedStudents.length > 0 && (
        <>
          {/* Aggregate cohort header */}
          <Card className="bg-gradient-to-br from-violet-50/40 via-background to-background border-violet-200/60">
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-violet-700" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate flex items-center gap-2">
                      {selectedStudents.length} student{selectedStudents.length === 1 ? "" : "s"}
                      {" across "}
                      {selectedCourses.length} course{selectedCourses.length === 1 ? "" : "s"}
                      {/* Section 3 help (added 2026-08-08): scoped to the
                          cohort dashboard. Section 3 doesn't have a single
                          CardTitle like 1/2, so the help lives next to the
                          aggregate "N students across M courses" anchor. */}
                      <InfoPopover
                        title="About the cohort dashboard"
                        ariaLabel="Help about the cohort dashboard"
                        triggerClassName="h-5 w-5 shrink-0"
                      >
                        <p>
                          This is the <strong>overview</strong> for everyone
                          you picked. The four tiles at the top show how many
                          review cards exist, how many are due now, and the
                          cohort&apos;s average memory strength.
                        </p>
                        <p>
                          <strong>Bulk controls for the cohort</strong> apply a
                          change to every selected student at once. Use them
                          for things like flipping everyone into exam-prep
                          mode before a test, or pausing review reminders for
                          a quiet week.
                        </p>
                        <p>
                          <strong>Per-student breakdown</strong> lets you
                          expand each student to see their individual cards.
                          That&apos;s where you mark a hard question as due
                          now, send one back to the start, or write a hint
                          your student will see on review.
                        </p>
                      </InfoPopover>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Cohort view · stats are aggregated across all selected students
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {aggregateStats.total > 0 && (
                    <>
                      <span className="font-medium text-foreground">{aggregateStats.total}</span>
                      <span>cards</span>
                      {aggregateStats.overdue > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-rose-600">{aggregateStats.overdue}</span>
                          <span className="text-rose-600">overdue</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats overview - aggregate across the cohort */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className={`border-t-2 ${statAccentClass("total", aggregateStats.total, aggregateStats.isPaused)}`}>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{aggregateStats.total}</div>
                <div
                  className="text-xs text-muted-foreground"
                  title="Every review card this cohort has on its schedule."
                >
                  Total review cards
                </div>
              </CardContent>
            </Card>
            <Card className={`border-t-2 ${statAccentClass("overdue", aggregateStats.overdue, aggregateStats.isPaused)}`}>
              <CardContent className="pt-4">
                <div className={`text-2xl font-bold ${aggregateStats.overdue > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {aggregateStats.overdue}
                </div>
                <div
                  className="text-xs text-muted-foreground"
                  title="Cards waiting for the student to review right now. The spaced-repetition algorithm decides when a card becomes due \u2014 not an assignment deadline."
                >
                  Due now
                </div>
              </CardContent>
            </Card>
            <Card className={`border-t-2 ${statAccentClass("ef", aggregateStats.avgEF, aggregateStats.isPaused)}`}>
              <CardContent className="pt-4">
                <div className={`text-2xl font-bold ${retentionColor(parseFloat(String(aggregateStats.avgEF)))}`}>
                  {aggregateStats.avgEF}
                </div>
                <div
                  className="text-xs text-muted-foreground"
                  title="Average memory strength across the cohort. Range 1.3 (struggling) to 3.0 (rock-solid). Higher = stronger recall."
                >
                  Avg memory strength
                </div>
              </CardContent>
            </Card>
            <Card className={`border-t-2 ${statAccentClass("status", 0, aggregateStats.isPaused)}`}>
              <CardContent className="pt-4">
                <div className={`text-2xl font-bold ${aggregateStats.isPaused ? "text-amber-600" : "text-emerald-600"}`}>
                  {aggregateStats.isPaused ? "Paused" : "Active"}
                </div>
                <div
                  className="text-xs text-muted-foreground"
                  title="Whether spaced-repetition reviews are actively accumulating for this cohort. Toggle from the bulk controls or per-student cards."
                >
                  Reviews
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bulk global controls (across the cohort) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-600" /> Bulk controls for the cohort
              </CardTitle>
              <CardDescription>
                Every button below affects the selected students in the selected courses
                ({selectedCourses.length} × {selectedStudents.length} = {selectedCourses.length * selectedStudents.length} pairs).
                Hover any button to see exactly what it does. For per-student toggles,
                expand a card in the breakdown below.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkToggleExamPrep(true)}
                title="Switch every selected student's review schedule into exam-prep mode. The schedule will re-sort so the hardest cards surface first \u2014 useful in the run-up to a test."
              >
                <Zap className="w-4 h-4 mr-1" /> Enable exam-prep (cohort)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkToggleExamPrep(false)}
                title="Turn exam-prep mode off for every selected student. Schedules return to their normal cadence."
              >
                Disable exam-prep (cohort)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkToggleNotifications(true)}
                title="Pause review-reminder notifications for every selected student. Reviews still accumulate, but no email/in-app pings are sent."
              >
                <BellOff className="w-4 h-4 mr-1 text-amber-500" /> Pause reminders (cohort)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkToggleNotifications(false)}
                title="Resume review-reminder notifications for every selected student."
              >
                <Bell className="w-4 h-4 mr-1 text-emerald-500" /> Resume reminders (cohort)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkToggleSRDisabled(true)}
                className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                title="Pause spaced repetition for the selected students. Reviews stop accumulating and reminders stop firing. Click again to resume."
              >
                <Ban className="w-4 h-4 mr-1" /> Pause spaced repetition
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkToggleSRDisabled(false)}
                title="Resume spaced repetition for the selected students. Their next course completion will seed a fresh review schedule."
              >
                <Power className="w-4 h-4 mr-1 text-emerald-500" /> Resume spaced repetition
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={openAssignDialog}
                disabled={selectedCourses.length === 0 || selectedStudents.length === 0}
                title={
                  selectedCourses.length === 0
                    ? "Pick a course first"
                    : selectedStudents.length === 0
                      ? "Select one or more students first"
                      : "Pick a specific question to put on the selected students' next-review queue"
                }
              >
                <Send className="w-4 h-4 mr-1" /> Add a review question
              </Button>
              <span className="text-xs text-muted-foreground self-center italic">
                Per-student toggles (exam-prep, pause) are on each card below.
              </span>
            </CardContent>
          </Card>

          {/* Per-student cards (inline-expand drill-down) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-600" />
                Per-student breakdown ({studentContextCards.length})
              </CardTitle>
              <CardDescription>
                Click a row to expand and see each review card for that student, with action buttons (make due now, send back, add a hint).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {studentContextCards.map(({ studentId, items, stats, isExpanded }) => {
                const display = studentDisplay(studentId)
                return (
                  <div
                    key={studentId}
                    className="rounded-lg border border-border bg-card hover:bg-muted/30 motion-safe:transition-colors"
                    data-testid={`student-card-${studentId}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleStudentExpanded(studentId)}
                      className="w-full px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-expanded={isExpanded}
                      aria-controls={`student-card-detail-${studentId}`}
                    >
                      {/* TIER 1 — identity (always visible) */}
                      <div className="flex items-center gap-3 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                        )}
                        <div className="shrink-0 w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
                          <GraduationCap className="w-3.5 h-3.5 text-violet-700" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground truncate text-sm">{display.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{display.email}</div>
                        </div>
                        <PerStudentGlobalControls studentId={studentId} />
                      </div>

                      {/* TIER 2 — stats + status badges (only renders if there's something to show).
                          Skipped entirely when the student has 0 cards AND no badges — keeps
                          the row quiet for empty schedules. */}
                      {(stats.total > 0 || stats.isPaused || stats.isExamMode) && (
                        <div className="mt-1.5 ml-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">{stats.total}</span>
                            <span title="Total review cards this student has on their schedule.">cards</span>
                          </div>
                          {stats.overdue > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-rose-600">{stats.overdue}</span>
                              <span title="Cards due for review right now.">due now</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <span className={`font-medium ${retentionColor(parseFloat(String(stats.avgEF)))}`}>
                              {stats.avgEF}
                            </span>
                            <span title="Memory strength. 1.3 (struggling) to 3.0 (rock-solid).">strength</span>
                          </div>
                          {stats.isPaused && (
                            <Badge variant="secondary" className="text-[10px] py-0" title="This student's reminders are paused. Reviews are still accumulating.">
                              Reminders paused
                            </Badge>
                          )}
                          {stats.isExamMode && (
                            <Badge className="text-[10px] py-0 bg-indigo-600" title="Hardest cards surface first.">
                              Exam-prep
                            </Badge>
                          )}
                        </div>
                      )}
                    </button>

                    {isExpanded && (
                      <div
                        id={`student-card-detail-${studentId}`}
                        className="border-t border-border px-3 py-3 space-y-2"
                        data-testid={`student-card-detail-${studentId}`}
                      >
                        {/*
                          Per-student drill-down panel. Replaces the previous
                          flat-list dump on 2026-08-13 — see
                          `components/sr-teacher/StudentCourseCardList.tsx`.
                          Behaviour:
                            - Empty state: same copy as before.
                            - Non-empty: grouped by course_id, sorted by
                              course name A→Z; first course auto-expanded;
                              teacher can toggle others.
                            - Search + sort: added in Step 3.
                        */}
                        <StudentCourseCardList
                          studentId={studentId}
                          items={items}
                          questionSummaryById={questionSummaryById}
                          actionLoading={actionLoading}
                          onBoost={handleBoost}
                          onRequestReset={requestHandleReset}
                          onOpenHintEditor={openHintEditor}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </>
      )}

      {/* Per-card Set Hint Dialog (ported 2026-08-09 from
          ReviewScheduler). One dialog at the page root, keyed on the
          current `hintEditor` state - only opens when the teacher
          clicks "Hint"/"Edit Hint" on a per-card row. Empty draft
          saves as `null` (clears the hint), which matches the
          backend's contract for "no hint". */}
      <Dialog
        open={hintEditor !== null}
        onOpenChange={(open) => {
          if (!open) closeHintEditor()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="mb-3">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-amber-600" />
              {hintEditor?.existingHint ? "Edit hint" : "Add hint"}
            </DialogTitle>
            <DialogDescription>
              Write a short note your student will see the next time they review this
              question. Leave blank to clear an existing hint.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={hintEditor?.draft ?? ""}
              onChange={(e) =>
                setHintEditor((prev) => (prev ? { ...prev, draft: e.target.value } : prev))
              }
              placeholder="e.g. Remember: focus on the verb tense, not the subject."
              className="h-11"
              maxLength={280}
              autoFocus
            />
            {/* F5 audit fix (2026-08-11): render a live preview of what the
                student will see below the input. The teacher's previous
                experience was typing into a void. Now they see the
                student-side framing — same Lightbulb icon, same sky-blue
                card, same "Need a hint?" label (mirroring ReviewSession.tsx
                lines 1723-1746) — so they can write appropriately
                student-facing language.

                Post-answer-only behaviour note: the student only sees the
                hint AFTER they answer incorrectly (per ReviewSession.tsx
                spoiler-avoidance rule, bug-1 fix 2026-08-01). The preview
                below shows the visual rendering; the helper text flags
                this so the teacher understands the timing. */}
            {hintEditor && (hintEditor.draft.trim() || hintEditor.existingHint) && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Student preview
                </div>
                <div
                  role="note"
                  aria-label="Teacher-set remediation hint preview"
                  data-testid="hint-student-preview"
                  className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900"
                >
                  <div className="flex items-start gap-2">
                    <Lightbulb
                      className="h-4 w-4 mt-0.5 flex-shrink-0 text-sky-600"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-medium mb-1">Need a hint?</p>
                      <p className="text-sky-800">
                        {(hintEditor.draft.trim() || hintEditor.existingHint || '').slice(0, 280)}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Shown to the student only after they answer incorrectly — not on a correct first try.
                </p>
              </div>
            )}
            {hintEditor?.existingHint && (
              <div className="text-xs text-muted-foreground">
                Current hint: <span className="italic">{hintEditor.existingHint}</span>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 sm:mt-6 gap-2 border-t border-border/50 pt-4">
            <Button variant="outline" onClick={closeHintEditor}>
              Cancel
            </Button>
            <Button
              onClick={saveHint}
              disabled={hintMutation.isPending}
            >
              {hintMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <MessageSquareText className="h-4 w-4" /> Save Hint
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Review Assignment Dialog (ported 2026-08-09 from
          ReviewScheduler). Lives at the page root so it overlays the
          entire page regardless of which Card the user triggered
          from. Uses `primaryCourseId` (the first selected course) for
          the assignable-questions fetch - see openAssignDialog() for
          the rationale. */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Add a review question
            </DialogTitle>
            <DialogDescription>
              {assignForStudents.length === 1 ? (
                <>
                  Pick a question to put on{' '}
                  <span className="font-medium text-foreground">
                    {studentDisplay(assignForStudents[0]).name}
                  </span>
                  &apos;s next-review queue. They&apos;ll see it the next time they open
                  the review screen.
                </>
              ) : assignForStudents.length > 1 ? (
                <>
                  Pick a question to put on the next-review queue for{' '}
                  <span className="font-medium text-foreground">
                    {assignForStudents.length} students
                  </span>
                  . Uncheck any you want to skip.
                </>
              ) : (
                'Pick a question to assign.'
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Student checkbox strip (multi-student case). Pre-fills with
              the cohort selection; the teacher can drop any before
              submitting. Renders only when there are 2+ students
              (single-student case is already conveyed in the
              description above). */}
          {assignForStudents.length > 1 && (
            <div
              className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5"
              data-testid="assign-student-strip"
            >
              {/* F4 audit fix (2026-08-11): header now carries a "Clear"
                  link so a teacher can wipe all recipients in one click
                  instead of unchecking each row. Saves tedious clicking
                  for cohorts of 20+ students. */}
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Recipients ({assignForStudents.length})
                </span>
                <button
                  type="button"
                  onClick={() => setAssignForStudents([])}
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                  aria-label="Remove all recipients"
                  data-testid="assign-clear-all-recipients"
                >
                  Clear
                </button>
              </div>
              <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1">
                {assignForStudents.map((studentId) => (
                  <label
                    key={studentId}
                    className="flex items-center gap-2 rounded-sm px-2 py-1 cursor-pointer hover:bg-background/60"
                  >
                    <Checkbox
                      checked
                      onCheckedChange={() => toggleAssignStudent(studentId)}
                      aria-label={`Remove ${studentDisplay(studentId).name} from assignment`}
                    />
                    <span className="text-sm">
                      {studentDisplay(studentId).name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {isLoadingAssignable ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading question
                catalogue...
              </div>
            ) : (assignableData?.questions ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-md">
                No questions found in this course's banks. Add banks to the course first.
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 pb-1">
                  <Library className="h-3.5 w-3.5" />
                  {assignableData?.questions.filter((q) => q.fromCourse).length ?? 0}{' '}
                  from this course ·{' '}
                  {assignableData?.questions.filter((q) => !q.fromCourse).length ?? 0}{' '}
                  cross-bank
                </div>
                <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
                  {assignableData?.questions.map((q) => {
                    const isSelected = selectedQuestionId === q.id
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setSelectedQuestionId(q.id)}
                        className={
                          'w-full text-left rounded-md border p-3 transition-colors ' +
                          (isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-border hover:bg-muted/40')
                        }
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium leading-snug">
                            {q.body}
                          </div>
                          {q.fromCourse ? (
                            <span className="shrink-0 text-[10px] uppercase tracking-wide font-medium rounded-full bg-primary/10 text-primary px-2 py-0.5">
                              Course
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] uppercase tracking-wide font-medium rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                              Cross-bank
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 text-xs text-muted-foreground">
                          from{' '}
                          <span className="italic">
                            {q.bankTitles.filter(Boolean).join(', ') || 'Unknown bank'}
                          </span>{' '}
                          · <span className="font-mono">{q.type}</span>
                        </div>
                        {q.hint && (
                          <div className="mt-1.5 text-xs text-muted-foreground italic">
                            Hint: {q.hint}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAssignDialogOpen(false)
                setSelectedQuestionId('')
                setAssignForStudents([])
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={submitAssign}
              disabled={!selectedQuestionId || assignForStudents.length === 0 || assignMutation.isPending}
            >
              {assignMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Adding…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />{' '}
                  {assignForStudents.length > 1
                    ? `Add to ${assignForStudents.length} students`
                    : 'Assign'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk-action confirm dialog (C4 audit fix, 2026-08-11) ──
          Replaces 3 native `window.confirm()` calls with one styled
          shadcn dialog. Title + description + button labels are
          derived from `pendingBulkAction.kind` so the same dialog
          handles notifications, SR-disabled, and exam-prep. The
          dialog only opens above BULK_CONFIRM_THRESHOLD; below that
          the bulk action runs silently. */}
      <ConfirmDialog
        open={pendingBulkAction !== null}
        onOpenChange={(open) => {
          if (!open && !bulkActionPending) setPendingBulkAction(null)
        }}
        pending={bulkActionPending}
        variant="destructive"
        title={bulkActionTitle(pendingBulkAction)}
        description={bulkActionDescription(pendingBulkAction)}
        confirmLabel={bulkActionConfirmLabel(pendingBulkAction)}
        onConfirm={async () => {
          if (pendingBulkAction) await pendingBulkAction.run()
        }}
      />

      {/* ── Per-card "Send back" confirm dialog (C4 audit fix, 2026-08-11) ──
          Replaces the native `confirm()` call for the per-card reset
          action. Single shared dialog, opened via `requestHandleReset`. */}
      <ConfirmDialog
        open={pendingReset !== null}
        onOpenChange={(open) => {
          if (!open && !resetPending) setPendingReset(null)
        }}
        pending={resetPending}
        variant="destructive"
        title="Send this card back?"
        description={
          <p>
            The student will have to relearn this card after their next course
            completion. Their current memory-strength score for it will be wiped.
            This can&rsquo;t be undone — you&rsquo;d need to manually assign the
            card again to bring it back.
          </p>
        }
        confirmLabel="Send back"
        onConfirm={async () => {
          if (pendingReset) {
            const { studentId, questionId } = pendingReset
            await runHandleReset(studentId, questionId)
          }
        }}
      />
    </div>
  )

  // Helper functions (C4 audit fix, 2026-08-11): derive the title,
  // description, and confirm-button label for the bulk-confirm dialog
  // from the pending action's kind. Keeping them as local helpers
  // avoids a giant conditional inside the JSX.
  function bulkActionTitle(action: typeof pendingBulkAction): string {
    if (!action) return ""
    switch (action.kind) {
      case "notifications":
        return action.enabled ? "Pause review reminders?" : "Resume review reminders?"
      case "sr_disabled":
        return action.enabled ? "Pause spaced repetition?" : "Resume spaced repetition?"
      case "exam_prep":
        return action.enabled ? "Enable exam-prep mode?" : "Disable exam-prep mode?"
    }
  }
  function bulkActionDescription(action: typeof pendingBulkAction): ReactNode {
    if (!action) return null
    const { courses, students, pairs } = action.summary
    switch (action.kind) {
      case "notifications":
        return (
          <p>
            You&rsquo;re about to {action.enabled ? "pause" : "resume"} review
            reminders for <strong>{pairs}</strong> (course &times; student) pair{pairs === 1 ? "" : "s"}
            {" "}(<strong>{courses}</strong> course{courses === 1 ? "" : "s"} &times;{" "}
            <strong>{students}</strong> student{students === 1 ? "" : "s"}).
            {!action.enabled && " Students will start getting review notifications again."}
          </p>
        )
      case "sr_disabled":
        return (
          <p>
            You&rsquo;re about to {action.enabled ? "pause" : "resume"} spaced
            repetition for <strong>{students}</strong> student{students === 1 ? "" : "s"}.
            {!action.enabled && " Their reviews and reminders will resume immediately."}
          </p>
        )
      case "exam_prep":
        return (
          <p>
            You&rsquo;re about to {action.enabled ? "enable" : "disable"} exam-prep
            mode for <strong>{pairs}</strong> (course &times; student) pair{pairs === 1 ? "" : "s"}
            {" "}(<strong>{courses}</strong> course{courses === 1 ? "" : "s"} &times;{" "}
            <strong>{students}</strong> student{students === 1 ? "" : "s"}).
          </p>
        )
    }
  }
  function bulkActionConfirmLabel(action: typeof pendingBulkAction): string {
    if (!action) return "Confirm"
    switch (action.kind) {
      case "notifications":
        return action.enabled ? "Pause reminders" : "Resume reminders"
      case "sr_disabled":
        return action.enabled ? "Pause" : "Resume"
      case "exam_prep":
        return action.enabled ? "Enable" : "Disable"
    }
  }
}
