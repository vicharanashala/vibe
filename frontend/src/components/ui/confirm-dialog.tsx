"use client"

import { useState, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/utils/utils"

export interface ConfirmDialogProps {
  /** Whether the dialog is open. */
  open: boolean
  /** Called when the dialog requests to close (Cancel button, Escape, X, overlay click). */
  onOpenChange: (open: boolean) => void
  /** Called when the user confirms the action. */
  onConfirm: () => void | Promise<void>
  /** Dialog title — required. Should be a short imperative sentence. */
  title: string
  /** Required description text — explains what will happen if the teacher confirms. */
  description: ReactNode
  /** Confirm button label. Defaults to "Confirm". */
  confirmLabel?: string
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string
  /**
   * Visual treatment of the confirm button. `"default"` = primary blue.
   * `"destructive"` = red border/text, used when the action is hard to
   * undo (e.g. reset/pause cohorts). Defaults to "default".
   */
  variant?: "default" | "destructive"
  /**
   * Optional icon rendered next to the title. Defaults to AlertTriangle
   * in destructive mode (red), nothing otherwise.
   */
  icon?: ReactNode
  /**
   * When true, the confirm button is disabled and shows a spinner.
   * Use when the onConfirm handler is async. Defaults to false.
   */
  pending?: boolean
  /** Optional extra classes on the content card. */
  className?: string
}

/**
 * Reusable confirmation dialog (added 2026-08-11, audit C4).
 *
 * Replaces the 4 `window.confirm()` / `confirm()` call sites in
 * `TeacherSRDashboard.tsx` (bulkToggleNotifications, bulkToggleSRDisabled,
 * bulkToggleExamPrep, handleReset) with a styled shadcn Dialog that
 * matches the rest of the dashboard's UI.
 *
 * Usage pattern (matches React's controlled-dialog pattern):
 *
 * ```tsx
 * const [open, setOpen] = useState(false)
 * const [pending, setPending] = useState(false)
 * async function go() {
 *   setPending(true)
 *   try {
 *     await mutation.mutateAsync(...)
 *     setOpen(false)
 *   } finally {
 *     setPending(false)
 *   }
 * }
 * return (
 *   <>
 *     <Button onClick={() => setOpen(true)}>Bulk-pause reminders</Button>
 *     <ConfirmDialog
 *       open={open}
 *       onOpenChange={setOpen}
 *       onConfirm={go}
 *       pending={pending}
 *       variant="destructive"
 *       title="Pause review reminders for the cohort?"
 *       description={
 *         <p>
 *           You're about to pause review reminders for <strong>12 students</strong>
 *           across <strong>3 courses</strong>. They won't get reminder notifications
 *           until you resume them.
 *         </p>
 *       }
 *       confirmLabel="Pause reminders"
 *     />
 *   </>
 * )
 * ```
 *
 * Visual notes:
 *  - Same backdrop/overlay as the existing Assign + Hint dialogs
 *    (uses the shared `@/components/ui/dialog` primitives).
 *  - Destructive variant uses red confirm button + amber AlertTriangle
 *    icon next to the title — colour cue that this action has lasting
 *    effects (matches the original `window.confirm()`'s "wait, are you
 *    sure?" semantics, now stylistically consistent with the page).
 *  - Escape, X, overlay-click, and Cancel all close via `onOpenChange(false)`.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  icon,
  pending = false,
  className,
}: ConfirmDialogProps) {
  const isDestructive = variant === "destructive"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-md", className)} data-testid="confirm-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon !== undefined ? (
              icon
            ) : isDestructive ? (
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
            ) : null}
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground">{description}</div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            data-testid="confirm-dialog-cancel"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={pending}
            data-testid="confirm-dialog-confirm"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Helper hook (added 2026-08-11) for the common "open + pending" pair
 * of useState calls every confirm dialog needs. Saves a few lines per
 * call site and keeps the dialog plumbing in one place.
 */
export function useConfirmDialogState() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  return { open, setOpen, pending, setPending } as const
}