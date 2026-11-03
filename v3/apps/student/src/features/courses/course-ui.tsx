import { BookOpenTextIcon, ClipboardCheckIcon, FileTextIcon, FolderKanbanIcon, MessageSquareTextIcon, PlayCircleIcon, ScaleIcon, type LucideIcon } from 'lucide-react';

import { GeneratedCover } from '@/components/generated-art';
import { Progress } from '@/components/ui/progress';
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
  if (variant === 'compact') {
    return (
      <p className={cn('text-xs text-sky-700 dark:text-sky-300', className)}>Study {percentStudied}%</p>
    );
  }
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-sky-700 dark:text-sky-300">Study mode</span> · {studiedItems} of {totalItems} videos &amp; articles
        </span>
        <span>{percentStudied}%</span>
      </div>
      <ProgressBar
        value={percentStudied}
        label="Study progress"
        className="[&_[data-slot=progress-indicator]]:bg-sky-500"
      />
    </div>
  );
}
