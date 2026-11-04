import { Info, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Sort modes for the per-course question list inside the per-student
 * drill-down (added 2026-08-13; `ef-desc` added 2026-08-22).
 *
 * - `alpha`: alphabetical by question body. Default — what Emie asked for
 *   first. Stable, predictable, matches a teacher's mental model of "where
 *   do I find question X?".
 * - `ef-asc`: lowest EF first ("hardest first"). EF is the SM-2
 *   easiness factor (1.3 = struggling, 3.0 = rock-solid). This is the
 *   closest honest proxy for "this is the question the student is
 *   struggling with". We deliberately did NOT call it "difficulty"
 *   because `ReviewItem` and `QuestionSummary` carry no question-level
 *   difficulty field — EF measures the student's retention, not the
 *   question's inherent hardness.
 * - `ef-desc`: highest EF first ("easiest first"). Surfaced on
 *   2026-08-22 at Emie's request — useful when a teacher wants to
 *   spot the cards the student has already mastered (e.g. to decide
 *   which to clear, or which to skip when time-boxing a review pass).
 *   Same EF-alpha tiebreaker as `ef-asc` so the order stays stable
 *   across renders.
 */
export type QuestionSortMode = 'alpha' | 'ef-asc' | 'ef-desc';

export interface SearchAndSortBarProps {
  /** Current search query (controlled). Empty string = no filter. */
  searchQuery: string;
  /** Called on every keystroke. Parent is responsible for debouncing. */
  onSearchChange: (value: string) => void;
  /** Current sort mode (controlled). */
  sortMode: QuestionSortMode;
  /** Called when the sort dropdown changes. */
  onSortChange: (mode: QuestionSortMode) => void;
  /** How many questions the (filtered) list currently shows. Rendered to the right of the sort dropdown. */
  resultCount: number;
  /** Total questions before filtering. Used in the "N of M" hint when filtered. */
  totalCount: number;
  /** Optional className applied to the outer flex container. */
  className?: string;
  /**
   * Optional tooltip text for an info-icon next to the sort dropdown.
   * When provided, renders a small "i" icon that surfaces a tooltip
   * explaining the sort modes (typically used to disambiguate
   * domain-specific jargon like EF). When omitted, no info icon is
   * rendered — keeps the bar minimal for callers who don't need it.
   */
  sortInfoText?: string;
}

/**
 * Per-course search + sort bar for the per-student drill-down in
 * TeacherSRDashboard. Added 2026-08-13.
 *
 * Why a separate component:
 *   1. Keeps TeacherSRDashboard.tsx readable — the dashboard is already
 *      ~1500 lines and the per-course render block was about to grow
 *      another ~50 lines without extraction.
 *   2. One place to tweak the bar's UX (placeholder copy, sort options,
 *      result-count wording) without grepping across the dashboard.
 *
 * Layout:
 *
 *   ┌───────────────────────────────────────────────────────────┐
 *   │ 🔍 [search input ........................]  Sort [▾]  N │
 *   └───────────────────────────────────────────────────────────┘
 *
 *   - Search input fills available width (flex-1).
 *   - Sort dropdown is right-aligned, fixed width via the trigger.
 *   - Result count sits to the right of the dropdown:
 *       - if `searchQuery === ''`: shows `N` (just the total).
 *       - if filtered: shows `N of M` so the teacher knows how many
 *         were hidden by the search.
 *
 * Accessibility:
 *   - Search input has a visible label hidden via sr-only (keeps
 *     layout clean for sighted users, screen-reader friendly).
 *   - Sort dropdown is keyboard-navigable via Radix.
 *   - The result count uses `aria-live="polite"` so screen readers
 *     announce the change as the teacher types.
 *
 * Debouncing:
 *   - This component is *controlled* — it does NOT debounce. The
 *     dashboard does the debounce (~150ms) before calling setState, so
 *     the filter recompute doesn't fire on every keystroke. Doing it
 *     here would require either a useEffect inside this component or a
 *     ref-based timer; either would push state up the tree which is
 *     what we already do. Simpler to keep this dumb.
 */
export function SearchAndSortBar({
  searchQuery,
  onSearchChange,
  sortMode,
  onSortChange,
  resultCount,
  totalCount,
  className,
  sortInfoText,
}: SearchAndSortBarProps) {
  const isFiltered = searchQuery.trim().length > 0;
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {/* Search input — fills available width */}
      <div className="relative flex-1 min-w-0">
        <label htmlFor="sr-course-search" className="sr-only">
          Search questions in this course
        </label>
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          id="sr-course-search"
          type="text"
          inputMode="search"
          placeholder="Search questions…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
      </div>

      {/* Sort dropdown */}
      <div className="shrink-0 flex items-center gap-1">
        <label htmlFor="sr-course-sort" className="sr-only">
          Sort questions by
        </label>
        <Select
          value={sortMode}
          onValueChange={(v) => onSortChange(v as QuestionSortMode)}
        >
          <SelectTrigger id="sr-course-sort" className="h-8 text-sm w-[190px]" size="sm">
            <SelectValue placeholder="Sort by…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alpha">Alphabetical</SelectItem>
            <SelectItem value="ef-asc">EF (hardest first)</SelectItem>
            <SelectItem value="ef-desc">EF (easiest first)</SelectItem>
          </SelectContent>
        </Select>
        {/*
          Optional sort-info tooltip. Rendered only when the caller
          supplies `sortInfoText` (so this component stays generic and
          callers that don't need jargon-disambiguation get a slimmer
          bar). Tooltip primitive is the shadcn Radix wrapper — hover
          or focus surfaces the explanation; click-through is not
          required for this kind of context.
        */}
        {sortInfoText && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Sort options explained"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end" sideOffset={6} className="max-w-xs text-xs leading-snug">
              {sortInfoText}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Result count — small, muted, polite live region */}
      <div
        className="shrink-0 text-xs text-muted-foreground tabular-nums whitespace-nowrap"
        aria-live="polite"
        title={
          isFiltered
            ? `${resultCount} of ${totalCount} questions match your search.`
            : `${totalCount} questions in this course.`
        }
      >
        {isFiltered ? `${resultCount} of ${totalCount}` : totalCount}
      </div>
    </div>
  );
}
