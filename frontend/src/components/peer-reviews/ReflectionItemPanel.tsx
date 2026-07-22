import {useState} from 'react';
import {ArrowRight, Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {
  useMyReflection,
  useNextReflectionToReview,
  useSubmitReflection,
  useSubmitReview,
} from '@/hooks/peer-review-hooks';
import ReflectionComposer from './ReflectionComposer';
import MyReflectionCard from './MyReflectionCard';
import PeerReviewQueue from './PeerReviewQueue';

interface ReflectionItemPanelProps {
  courseId: string;
  courseVersionId: string;
  itemId: string;
  /** Item title, shown as the heading. */
  title?: string;
  /** Optional instructor prompt configured on the item. */
  prompt?: string;
  /** Advances to the next item in the section. */
  onNext: () => void;
  isProgressUpdating?: boolean;
}

/**
 * The student-facing view of a REFLECTION item.
 *
 * Writing comes first and reviewing is only offered afterwards: a student who
 * had read ten peer answers before writing their own would be summarising the
 * cohort rather than recalling the lecture, which is the thing being measured.
 *
 * Reviewing never blocks `onNext` — the reciprocity pressure is that the score
 * stays hidden, not that the course does.
 */
export default function ReflectionItemPanel({
  courseId,
  courseVersionId,
  itemId,
  title,
  prompt,
  onNext,
  isProgressUpdating = false,
}: ReflectionItemPanelProps) {
  const [isReviewing, setIsReviewing] = useState(false);
  const itemRef = {courseId, courseVersionId, itemId};

  const {reflection: mine, isLoading} = useMyReflection(itemRef);
  const submitReflection = useSubmitReflection(itemRef);

  const hasSubmitted = Boolean(mine);
  const {reflection: peerReflection, isLoading: isQueueLoading} =
    useNextReflectionToReview(itemRef, hasSubmitted && isReviewing);
  const submitReview = useSubmitReview(itemRef);

  // The item container gives this a full-height box; center the card in it
  // rather than letting it sit crammed against the top of a tall empty page.
  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-full justify-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-2xl space-y-4">
        {title ? (
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        ) : null}
        {children}
      </div>
    </div>
  );

  if (isLoading) {
    return shell(
      <div className="flex items-center justify-center gap-2 rounded-lg border p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading
      </div>,
    );
  }

  if (!hasSubmitted) {
    return shell(
      <ReflectionComposer
        prompt={prompt}
        isSubmitting={submitReflection.isPending}
        onSubmit={input => submitReflection.mutateAsync(input)}
      />,
    );
  }

  const reviewsRemaining = Math.max(
    mine!.reviewsRequired - mine!.reviewsCompleted,
    0,
  );

  if (isReviewing) {
    return shell(
      <div className="space-y-3">
        <PeerReviewQueue
          reflection={peerReflection}
          isLoading={isQueueLoading}
          isSubmitting={submitReview.isPending}
          onSubmit={input => submitReview.mutateAsync(input)}
        />
        <Button variant="ghost" onClick={() => setIsReviewing(false)}>
          Back to my reflection
        </Button>
      </div>,
    );
  }

  return shell(
    <div className="space-y-3">
      <MyReflectionCard reflection={mine!} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="flex-1"
          variant={reviewsRemaining > 0 ? 'default' : 'outline'}
          onClick={() => setIsReviewing(true)}
        >
          {reviewsRemaining > 0
            ? `Review peers (${reviewsRemaining} to go)`
            : 'Review more peers'}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={onNext}
          disabled={isProgressUpdating}
        >
          {isProgressUpdating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>,
  );
}
