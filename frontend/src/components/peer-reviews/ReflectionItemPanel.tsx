import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {ArrowRight, Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useStartItem, useStopItem} from '@/hooks/hooks';
import {useCourseStore} from '@/store/course-store';
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
  /** True when this item was already completed on an earlier visit. */
  isAlreadyWatched?: boolean;
  /** Shared set of item ids completed this session, to avoid double-stopping. */
  completedItemIdsRef: React.RefObject<Set<string>>;
}

export interface ReflectionItemPanelRef {
  /** Called by the item container when the student navigates away. */
  stopItem: () => Promise<void>;
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
const ReflectionItemPanel = forwardRef<
  ReflectionItemPanelRef,
  ReflectionItemPanelProps
>(function ReflectionItemPanel(
  {
    courseId,
    courseVersionId,
    itemId,
    title,
    prompt,
    onNext,
    isProgressUpdating = false,
    isAlreadyWatched = false,
    completedItemIdsRef,
  },
  ref,
) {
  const [isReviewing, setIsReviewing] = useState(false);
  const itemRef = {courseId, courseVersionId, itemId};

  // Progress is recorded exactly as an article records it: started on arrival,
  // stopped on the way out. Without this the item never completes, and with
  // linear progression enabled the next lesson stays locked.
  const {currentCourse, setWatchItemId} = useCourseStore();
  const startItem = useStartItem();
  const stopItem = useStopItem();
  const itemStartedRef = useRef(false);
  const startSentRef = useRef(false);

  const alreadyDone = () =>
    isAlreadyWatched || completedItemIdsRef.current?.has(itemId);

  // Fire the start once on arrival.
  useEffect(() => {
    if (startSentRef.current || !currentCourse?.itemId || alreadyDone()) return;
    startSentRef.current = true;
    startItem.mutate({
      params: {
        path: {courseId, courseVersionId},
      },
      body: {
        itemId,
        moduleId: currentCourse.moduleId ?? '',
        sectionId: currentCourse.sectionId ?? '',
        cohortId: currentCourse.cohortId || undefined,
      },
    } as any);
  }, [itemId, currentCourse?.itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The stop needs the watchItemId the start returns; the item counts as
  // started only once that lands. Marking it started on mount (before the id
  // exists) is what made stopItem no-op earlier — so the item never completed
  // and the next lesson stayed locked.
  useEffect(() => {
    if (
      startItem.data?.watchItemId &&
      startSentRef.current &&
      !itemStartedRef.current
    ) {
      setWatchItemId(startItem.data.watchItemId);
      itemStartedRef.current = true;
    }
  }, [startItem.data?.watchItemId, setWatchItemId]);

  useImperativeHandle(ref, () => ({
    stopItem: async () => {
      if (!currentCourse?.watchItemId || !itemStartedRef.current) return;
      if (alreadyDone()) return;
      await stopItem.mutateAsync({
        params: {path: {courseId, courseVersionId}},
        body: {
          watchItemId: currentCourse.watchItemId,
          itemId,
          moduleId: currentCourse.moduleId ?? '',
          sectionId: currentCourse.sectionId ?? '',
          cohortId: currentCourse.cohortId || undefined,
        },
      } as any);
      completedItemIdsRef.current?.add(itemId);
      itemStartedRef.current = false;
    },
  }));

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
        {reviewsRemaining > 0 ? (
          <Button className="flex-1" onClick={() => setIsReviewing(true)}>
            Review peers ({reviewsRemaining} to go)
          </Button>
        ) : null}
        <Button
          variant={reviewsRemaining > 0 ? 'secondary' : 'default'}
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
      {mine!.reviewsRequired > 0 && reviewsRemaining === 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          You've completed all {mine!.reviewsRequired} of your reviews.
        </p>
      ) : null}
    </div>,
  );
});

export default ReflectionItemPanel;
