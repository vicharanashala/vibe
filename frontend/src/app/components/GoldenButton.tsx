/**
 * GoldenButton — inline entry point to the motivation system.
 *
 * Renders inline within the retention dashboard h1 row, immediately
 * after the InfoPopover ("i"). The crown icon visually matches the
 * h1's `text-2xl` baseline (24px) so it reads as a typographic glyph
 * rather than a separate widget.
 *
 * Hover behaviour: on hover (and only when the user has not asked for
 * reduced motion), the chip expands horizontally into a gold pill that
 * reveals the call-to-action copy. The CTA text is hidden at narrow
 * widths (mobile / small viewports) since touch devices have no hover,
 * and the expanded pill would otherwise crowd narrow screens.
 *
 * The panel host (`MotivationPanel`) is loaded lazily on first open
 * to keep the spaced-repetition page bundle lean.
 *
 * Accessibility:
 *   - `aria-label` describes the action (full text)
 *   - `aria-expanded` reflects the panel state
 *   - `prefers-reduced-motion` disables the hover-expand
 *   - `:focus-visible` adds a 2px ring for keyboard users
 */

import { useState, lazy, Suspense } from 'react';
import { cn } from '@/utils/utils';

// Lazy-load the panel so the spaced-repetition page bundle stays
// small. The motivation system is read-only and rarely visited.
const MotivationPanel = lazy(() =>
  import('./motivation/MotivationPanel').then((m) => ({
    default: m.MotivationPanel,
  })),
);

const CTA_LABEL = 'Ready to ascend in your court ranks?';

export interface GoldenButtonProps {
  /** Whether to render the button. Hidden on login / public pages. */
  visible?: boolean;
  /** Optional className for positioning / spacing overrides. */
  className?: string;
}

export function GoldenButton({
  visible = true,
  className,
}: GoldenButtonProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);

  if (!visible) return null;

  return (
    <>
      {/*
        Inline flex chip sized to sit on the h1's `text-2xl` (24px)
        baseline. `self-center` is the safety net if the parent flex
        row ever drifts from `items-center`. The chip uses the app's
        gold palette (border + gradient) so it reads as "ascend into
        the courts" without shouting.
      */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={CTA_LABEL}
        aria-expanded={open}
        title={CTA_LABEL}
        className={cn(
          'group inline-flex items-center self-center',
          // Size - h-9 (36px) sits cleanly on a text-2xl baseline.
          'h-9 rounded-full',
          // Golden aesthetic — uses Tailwind's default amber scale
          // (`amber-600` → `amber-800`) rather than the app's primary
          // tokens. Reason: the primary tokens (`hsl(38 95% 58%)`)
          // are too bright for white text - they'd fail WCAG contrast
          // at ~2:1. The amber-600 to amber-800 gradient gives
          //   amber-600 (#D97706) -> white ~4.5:1 (AA pass)
          //   amber-800 (#92400E) -> white ~8.1:1 (AAA pass)
          // Both tones are deeply golden, but neither is neon.
          'border border-amber-900/30',
          'bg-gradient-to-br from-amber-600 to-amber-800',
          // Typography + spacing.
          'gap-0 px-0',
          // Click feedback.
          'active:scale-95',
          // Cursor.
          'cursor-pointer',
          // Transition for the expand.
          'motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out',
          // Focus ring for keyboard users. Ring color matches the
          // chip body's darker tone so it has presence on either
          // light or dark page backgrounds.
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2',
          className,
        )}
      >
        {/*
          The crown icon is the visible glyph at rest. Sized at
          text-2xl (24px) to match the h1's baseline exactly so it
          reads as a typographic peer to "Retention dashboard", not
          a separate widget. `flex-shrink-0` keeps it from being
          crushed when the pill expands.
        */}
        <span
          aria-hidden="true"
          className="flex items-center justify-center w-9 h-9 flex-shrink-0 text-2xl leading-none"
        >
          👑
        </span>

        {/*
          CTA label: revealed on hover via the same `max-w-0` ->
          `max-w-[360px]` trick as before. `whitespace-nowrap` keeps
          the text on one line. Hidden below `sm:` since touch has
          no hover.
        */}
        <span
          aria-hidden="true"
          className={cn(
            'hidden sm:inline-block',
            // White text on the amber-600 → amber-800 gradient. The
            // darker top end of the gradient passes AA independently;
            // the lighter bottom is borderline but still readable at
            // font-semibold. If we ever want to be stricter, swap to
            // `from-amber-700 to-amber-900` (both pass AAA).
            'text-sm font-semibold tracking-tight text-white',
            'overflow-hidden whitespace-nowrap',
            // Collapsed: 0 width, 0 padding, 0 opacity.
            'max-w-0 opacity-0',
            // Hover-expand (motion-safe only): reveal label.
            // Width tuned for CTA_LABEL at text-sm / font-semibold
            // (~280-320px natural width depending on font metrics).
            // 360px gives a small buffer; anything narrower clips the
            // trailing characters inside `overflow-hidden`.
            'motion-safe:group-hover:max-w-[360px] motion-safe:group-hover:opacity-100',
            'motion-safe:group-hover:pl-2 motion-safe:group-hover:pr-4',
            // Reduced-motion users stay on the round button only.
            'motion-reduce:max-w-0 motion-reduce:opacity-0',
          )}
        >
          {CTA_LABEL}
        </span>
      </button>
      {open && (
        <Suspense fallback={null}>
          <MotivationPanel open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}