import { BookOpenTextIcon, InfoIcon, ClipboardCheckIcon, FileTextIcon, FolderKanbanIcon, MessageSquareTextIcon, PlayCircleIcon, ScaleIcon, type LucideIcon } from 'lucide-react';

import { GeneratedCover } from '@/components/generated-art';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/features/learn/queries';

/** Course cover: deterministic generative art (boring-avatars), seeded by the course id. */
export function CourseCover({ name, seed, className }: { name: string; seed?: string; className?: string }) {
  return <GeneratedCover seed={seed ?? name} title={name} className={className} />;
}

/** shadcn Progress with the app's defaults (clamped, rounded, labelled). */
export function ProgressBar({ value, className, label }: { value: number; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return <Progress value={pct} aria-label={label ?? 'Progress'} className={cn('w-full gap-0', className)} />;
}

const ITEM_TYPES: Record<string, { label: string; icon: LucideIcon }> = {
  VIDEO: { label: 'Video', icon: PlayCircleIcon },
  QUIZ: { label: 'Quiz', icon: ClipboardCheckIcon },
  BLOG: { label: 'Reading', icon: FileTextIcon },
  ARTICLE: { label: 'Reading', icon: FileTextIcon },
  PROJECT: { label: 'Project', icon: FolderKanbanIcon },
  FEEDBACK: { label: 'Feedback', icon: MessageSquareTextIcon },
  REFLECTION: { label: 'Reflection', icon: BookOpenTextIcon },
  CASE_STUDY: { label: 'Case study', icon: ScaleIcon },
};

export function itemTypeMeta(type: string) {
  return ITEM_TYPES[typeof type === 'string' ? type.toUpperCase() : ''] ?? { label: 'Lesson', icon: FileTextIcon };
}

export function percentOf(e: { percentCompleted?: number; completedItems?: number; contentCounts?: { totalItems?: number } }) {
  if (typeof e.percentCompleted === 'number') return e.percentCompleted;
  const total = e.contentCounts?.totalItems ?? 0;
  return total ? ((e.completedItems ?? 0) / total) * 100 : 0;
}

const TONES = {
  strict: {
    dot: 'bg-emerald-500',
    bar: '[&_[data-slot=progress-indicator]]:bg-emerald-500',
    value: 'text-foreground',
  },
  study: {
    dot: 'bg-sky-500',
    bar: '[&_[data-slot=progress-indicator]]:bg-sky-500',
    value: 'text-sky-700 dark:text-sky-300',
  },
} as const;

export const STRICT_PROGRESS_HINT =
  'Lessons completed in strict mode. This is your course progress: it counts towards completion and your certificate.';
export const STUDY_PROGRESS_HINT =
  'Videos and articles you’ve studied in study mode or completed in strict mode. It doesn’t count towards completion or your certificate.';

/**
 * One progress figure: a coloured dot and label, the percentage, a slim bar
 * and an optional "N of M" caption. Strict (green) and study (blue) use the
 * same colours as the mode switcher, so the two read as a pair.
 */
export function ProgressMeter({
  tone,
  label,
  value,
  caption,
  hint,
  ariaLabel,
  size = 'md',
  className,
}: {
  tone: keyof typeof TONES;
  label: string;
  value: number;
  caption?: string;
  /** Shown in a tooltip on an info icon next to the label. */
  hint?: string;
  ariaLabel?: string;
  size?: 'md' | 'sm';
  className?: string;
}) {
  const t = TONES[tone];
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('flex min-w-0 items-center gap-1.5 text-muted-foreground', size === 'sm' ? 'text-xs' : 'text-sm')}>
          <span className={cn('size-2 shrink-0 rounded-full', t.dot)} aria-hidden />
          <span className="truncate">{label}</span>
          {hint && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex shrink-0 rounded-full text-muted-foreground/70 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`About ${label.toLowerCase()} progress`}
                  />
                }
              >
                <InfoIcon className="size-3.5" aria-hidden />
              </TooltipTrigger>
              <TooltipContent className="max-w-64">{hint}</TooltipContent>
            </Tooltip>
          )}
        </span>
        <span className={cn('shrink-0 font-semibold tabular-nums', t.value, size === 'sm' ? 'text-xs' : 'text-lg leading-none')}>
          {pct}%
        </span>
      </div>
      <ProgressBar
        value={pct}
        label={ariaLabel ?? `${label} progress`}
        className={cn(size === 'sm' ? 'mt-1.5 [&_[data-slot=progress-track]]:h-1' : 'mt-2', t.bar)}
      />
      {caption && <p className="mt-1.5 text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}

/**
 * The student's study progress (studied or completed videos and articles that
 * allow study mode), shown next to — never instead of — strict progress.
 * Renders nothing until it loads, if it fails, or when nothing can be studied.
 */
export function StudyProgressSummary({
  courseId,
  versionId,
  variant = 'full',
  className,
}: {
  courseId: string;
  versionId: string;
  variant?: 'full' | 'compact';
  className?: string;
}) {
  const study = useStudyProgress(courseId, versionId);
  if (!study.isSuccess || study.data.totalItems === 0) return null;
  const { studiedItems, totalItems, percentStudied } = study.data;
  return (
    <ProgressMeter
      tone="study"
      label="Study"
      value={percentStudied}
      ariaLabel="Study progress"
      size={variant === 'compact' ? 'sm' : 'md'}
      caption={variant === 'compact' ? undefined : `${studiedItems} of ${totalItems} videos & articles`}
      hint={variant === 'compact' ? undefined : STUDY_PROGRESS_HINT}
      className={className}
    />
  );
}
