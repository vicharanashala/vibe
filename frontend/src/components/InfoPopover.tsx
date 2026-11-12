import { Info } from "lucide-react";
import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface InfoPopoverProps {
  /** Heading shown at the top of the dialog (e.g. "How Spaced Repetition Works"). */
  title: string;
  /** Body content rendered below the heading. Scrollable if taller than the viewport. */
  children: ReactNode;
  /** Optional ARIA label for the trigger button. Defaults to the title. */
  ariaLabel?: string;
  /** Optional extra classes on the trigger button (e.g. for placement tweaks). */
  triggerClassName?: string;
}

/**
 * A small "i" icon button that opens a centered modal dialog with explanatory
 * content. Used by the Spaced Repetition module to give students and teachers
 * a one-click explanation of how the system works without leaving the page.
 *
 * Implemented as a shadcn `Dialog` (Radix-backed) rather than a floating
 * popover so the help text has room to breathe — ~600px wide with internal
 * scroll on shorter viewports. Close behaviors:
 *   - the built-in X button (top right of the dialog)
 *   - click on the backdrop
 *   - press Escape
 *
 * No interactive state needs to live in this component — the Dialog handles
 * open/close internally via Radix, and the trigger button toggles it.
 */
export function InfoPopover({
  title,
  children,
  ariaLabel,
  triggerClassName,
}: InfoPopoverProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? title}
          className={
            "inline-flex h-6 w-6 items-center justify-center rounded-full " +
            "text-slate-500 hover:text-slate-900 hover:bg-slate-100 " +
            "focus:outline-none focus:ring-2 focus:ring-slate-300 " +
            "transition-colors " +
            (triggerClassName ?? "")
          }
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="w-full max-w-2xl gap-0 p-0 sm:rounded-lg border border-slate-200"
      >
        <DialogHeader className="border-b border-slate-200 px-6 py-4 pr-12 text-left">
          <DialogTitle className="text-base font-semibold text-slate-900">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(85vh-5rem)] overflow-y-auto px-6 py-5 text-sm leading-relaxed text-slate-700">
          <div className="space-y-4">{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
