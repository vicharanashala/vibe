import { Skeleton } from '@/components/ui/skeleton';

import { ErrorText } from '../studio-ui';
import { ArticleEditor } from './article-editor';
import { FeedbackEditor } from './feedback-editor';
import { useLesson, type LessonLocation, type LessonType } from './lesson-api';
import { QuizEditor } from './quiz-editor';
import { VideoEditor } from './video-editor';

/** Opens the right editor for a new lesson (`type`) or an existing one (`itemId`). */
export function LessonEditorPage({ loc, itemId, type }: { loc: LessonLocation; itemId?: string; type?: LessonType }) {
  const lesson = useLesson(loc, itemId);

  if (itemId && lesson.isPending) {
    return (
      <div className="mx-auto grid max-w-[44rem] gap-4 px-5 pt-24">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (itemId && lesson.isError) {
    return (
      <div className="mx-auto max-w-[44rem] px-5 pt-24">
        <ErrorText error={lesson.error} />
      </div>
    );
  }

  const item = lesson.data;
  // Remount per item so a newly published lesson starts from its saved state.
  const key = item?._id ?? `new-${type}`;
  switch (item?.type ?? type) {
    case 'BLOG':
      return <ArticleEditor key={key} loc={loc} item={item} />;
    case 'VIDEO':
      return <VideoEditor key={key} loc={loc} item={item} />;
    case 'QUIZ':
      return <QuizEditor key={key} loc={loc} item={item} />;
    case 'FEEDBACK':
      return <FeedbackEditor key={key} loc={loc} item={item} />;
    default:
      return (
        <div className="mx-auto max-w-[44rem] px-5 pt-24 text-sm text-muted-foreground">
          {item ? `“${item.name}” is a ${item.type.toLowerCase()} lesson, which the studio can’t edit yet.` : 'Pick a lesson type to start.'}
        </div>
      );
  }
}
