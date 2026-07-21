import {useState} from 'react';
import {Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {
  useMyReflection,
  useNextReflectionToReview,
  useSubmitReflection,
  useSubmitReview,
} from '@/hooks/peer-review-hooks';
import type {SectionRef} from '@/lib/api/peer-reviews';
import ReflectionComposer from './ReflectionComposer';
import MyReflectionCard from './MyReflectionCard';
import PeerReviewQueue from './PeerReviewQueue';

interface SectionReflectionPanelProps {
  section: SectionRef;
}

/**
 * The student-facing entry point for one section.
 *
 * Writing comes first and reviewing is only offered afterwards: a student who
 * has read ten peer answers before writing their own would be summarising the
 * cohort rather than recalling the lecture, which is the thing being measured.
 */
export default function SectionReflectionPanel({
  section,
}: SectionReflectionPanelProps) {
  const [isReviewing, setIsReviewing] = useState(false);

  const {reflection: mine, isLoading} = useMyReflection(section);
  const submitReflection = useSubmitReflection(section);

  const hasSubmitted = Boolean(mine);
  const {reflection: peerReflection, isLoading: isQueueLoading} =
    useNextReflectionToReview(section, hasSubmitted && isReviewing);
  const submitReview = useSubmitReview(section);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading
      </div>
    );
  }

  if (!hasSubmitted) {
    return (
      <ReflectionComposer
        isSubmitting={submitReflection.isPending}
        onSubmit={input => submitReflection.mutateAsync(input)}
      />
    );
  }

  const reviewsRemaining = Math.max(
    mine!.reviewsRequired - mine!.reviewsCompleted,
    0,
  );

  if (isReviewing) {
    return (
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
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <MyReflectionCard reflection={mine!} />
      {reviewsRemaining > 0 ? (
        <Button className="w-full" onClick={() => setIsReviewing(true)}>
          Review peers ({reviewsRemaining} to go)
        </Button>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setIsReviewing(true)}
        >
          Review more peers
        </Button>
      )}
    </div>
  );
}
