import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {
  peerReviewApi,
  type ReflectionScores,
  type ReflectionItemRef,
} from '@/lib/api/peer-reviews';

const itemKey = (s: ReflectionItemRef) => [s.courseVersionId, s.itemId];

export const peerReviewKeys = {
  myReflection: (s: ReflectionItemRef) => ['peer-reviews', 'mine', ...itemKey(s)],
  reviewQueue: (s: ReflectionItemRef) => ['peer-reviews', 'queue', ...itemKey(s)],
  instructorList: (courseVersionId: string, itemId?: string) => [
    'peer-reviews',
    'instructor',
    courseVersionId,
    itemId ?? 'all',
  ],
  instructorStats: (courseVersionId: string, itemId?: string) => [
    'peer-reviews',
    'instructor-stats',
    courseVersionId,
    itemId ?? 'all',
  ],
};

/** The caller's own reflection for a section, plus its score if unlocked. */
export function useMyReflection(section: ReflectionItemRef, enabled = true) {
  const result = useQuery({
    queryKey: peerReviewKeys.myReflection(section),
    queryFn: () => peerReviewApi.getMyReflection(section),
    enabled: enabled && Boolean(section.itemId),
  });
  return {...result, reflection: result.data?.reflection ?? null};
}

export function useSubmitReflection(section: ReflectionItemRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {text: string; confidence: number}) =>
      peerReviewApi.submitReflection(section, body),
    onSuccess: () => {
      // The reflection now exists and the queue has one more entry in it.
      queryClient.invalidateQueries({
        queryKey: peerReviewKeys.myReflection(section),
      });
      queryClient.invalidateQueries({
        queryKey: peerReviewKeys.reviewQueue(section),
      });
      toast.success('Reflection submitted');
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Could not submit your reflection'),
  });
}

/**
 * The next peer reflection to review. Not cached across submissions: every
 * successful review invalidates this so the next call pulls a fresh one.
 */
export function useNextReflectionToReview(section: ReflectionItemRef, enabled = true) {
  const result = useQuery({
    queryKey: peerReviewKeys.reviewQueue(section),
    queryFn: () => peerReviewApi.getNextForReview(section),
    enabled: enabled && Boolean(section.itemId),
    staleTime: 0,
  });
  return {...result, reflection: result.data?.reflection ?? null};
}

export function useSubmitReview(section: ReflectionItemRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      reflectionId: string;
      scores: ReflectionScores;
      helpful: boolean;
    }) =>
      peerReviewApi.submitReview(input.reflectionId, {
        scores: input.scores,
        helpful: input.helpful,
      }),
    onSuccess: () => {
      // Both the queue and the reciprocity counter on the author's own view
      // move with every review, so refresh the pair together.
      queryClient.invalidateQueries({
        queryKey: peerReviewKeys.reviewQueue(section),
      });
      queryClient.invalidateQueries({
        queryKey: peerReviewKeys.myReflection(section),
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Could not submit your review'),
  });
}

export function useInstructorReflections(
  courseId: string,
  courseVersionId: string,
  itemId?: string,
  enabled = true,
) {
  const result = useQuery({
    queryKey: peerReviewKeys.instructorList(courseVersionId, itemId),
    queryFn: () =>
      peerReviewApi.listForInstructor(courseId, courseVersionId, itemId),
    enabled: enabled && Boolean(courseId && courseVersionId),
  });
  return {...result, items: result.data?.items ?? []};
}

export function useInstructorReflectionStats(
  courseId: string,
  courseVersionId: string,
  itemId?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: peerReviewKeys.instructorStats(courseVersionId, itemId),
    queryFn: () =>
      peerReviewApi.getInstructorStats(courseId, courseVersionId, itemId),
    enabled: enabled && Boolean(courseId && courseVersionId),
  });
}
