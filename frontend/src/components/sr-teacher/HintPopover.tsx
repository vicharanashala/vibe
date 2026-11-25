"use client"

import { useState } from "react"
import { Lightbulb, Pencil } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/utils/utils"

interface HintPopoverProps {
  /** The current hint text. `null` / empty means "no hint set yet" — renders an Add affordance. */
  hint: string | null
  /** Tail of the question id, used in the popover header so teachers know which card they're on. */
  questionIdShort: string
  /** Called when the teacher clicks the Edit link inside the popover. */
  onEdit: () => void
  /** Optional extra classes on the trigger chip. */
  triggerClassName?: string
}

/**
 * Per-card "hint" affordance for the teacher SR dashboard.
 *
 * Two visual states:
 *  - **No hint set** — renders a small ghost button `[Add hint]`. Clicking
 *    it invokes `onEdit` directly (no popover shown — there's nothing to
 *    preview yet).
 *  - **Hint set** — renders a small amber-accented chip `[💡 Hint]`.
 *    Clicking it opens a **speech-bubble popover anchored above the row**
 *    (Radix `side="top"`) showing the hint text + an Edit link.
 *
 * The trigger calls `e.stopPropagation()` so clicking the chip never
 * bubbles up to a parent row toggler (the row is inside a `<button>` that
 * expands the student card on click).
 *
 * Click-outside / Escape closes the popover (Radix default).
 */
export function HintPopover({
  hint,
  questionIdShort,
  onEdit,
  triggerClassName,
}: HintPopoverProps) {
  const [open, setOpen] = useState(false)
  const hasHint = !!hint && hint.trim().length > 0

  // No hint set → render the "Add hint" button only. No popover state.
  if (!hasHint) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs",
          "text-amber-700 hover:bg-amber-50 hover:text-amber-800",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
          "transition-colors",
          triggerClassName,
        )}
        title="Write a short note your student will see next time they review this question"
      >
        <Lightbulb className="h-3 w-3" />
        <span>Add hint</span>
      </button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs",
            "bg-amber-100 text-amber-800 hover:bg-amber-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
            "transition-colors",
            triggerClassName,
          )}
          title="View the hint you've set for this card"
          aria-label={`View hint for question ${questionIdShort}`}
        >
          <Lightbulb className="h-3 w-3 fill-amber-500" />
          <span>Hint</span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-72 p-0"
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => {
          // Don't steal focus from the trigger — keep the teacher's cursor
          // where they clicked. The text is static + has an Edit button,
          // so focus-on-open isn't useful here.
          e.preventDefault()
        }}
      >
        {/* Speech bubble: rounded card with a small downward arrow.
            The arrow is rendered by setting side="top" + sideOffset;
            Radix handles the positioning. We add a small "tail" via
            a pseudo-element via a child div with absolute positioning.
            Tailwind doesn't have a built-in triangle utility, so we
            use a small rotated square as the arrow for cleanliness. */}
        <div className="relative px-3 py-2.5 pr-2">
          {/* Arrow pointing down at the trigger (only visible when side="top") */}
          <div
            aria-hidden="true"
            className="absolute -bottom-1.5 right-4 h-3 w-3 rotate-45 bg-popover border-r border-b border-border"
          />
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Hint for Q…{questionIdShort}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onEdit()
              }}
              className="h-6 px-1.5 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-50"
              title="Edit this hint"
            >
              <Pencil className="h-3 w-3" />
              <span className="ml-1">Edit</span>
            </Button>
          </div>
          <p className="text-sm text-foreground leading-snug whitespace-pre-wrap break-words">
            {hint}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
