import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {
  peerReviewApi,
  type ReflectionScores,
  type SectionRef,
} from '@/lib/api/peer-reviews';

const sectionKey = (s: SectionRef) => [s.courseVersionId, s.sectionId];

export const peerReviewKeys = {
  myReflection: (s: SectionRef) => ['peer-reviews', 'mine', ...sectionKey(s)],
  reviewQueue: (s: SectionRef) => ['peer-reviews', 'queue', ...sectionKey(s)],
  instructorList: (courseVersionId: string, sectionId?: string) => [
    'peer-reviews',
    'instructor',
    courseVersionId,
    sectionId ?? 'all',
  ],
  instructorStats: (courseVersionId: string, sectionId?: string) => [
    'peer-reviews',
    'instructor-stats',
    courseVersionId,
    sectionId ?? 'all',
  ],
};

/** The caller's own reflection for a section, plus its score if unlocked. */
export function useMyReflection(section: SectionRef, enabled = true) {
  const result = useQuery({
    queryKey: peerReviewKeys.myReflection(section),
    queryFn: () => peerReviewApi.getMyReflection(section),
    enabled: enabled && Boolean(section.sectionId),
  });
  return {...result, reflection: result.data?.reflection ?? null};
}

export function useSubmitReflection(section: SectionRef) {
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
export function useNextReflectionToReview(section: SectionRef, enabled = true) {
  const result = useQuery({
    queryKey: peerReviewKeys.reviewQueue(section),
    queryFn: () => peerReviewApi.getNextForReview(section),
    enabled: enabled && Boolean(section.sectionId),
    staleTime: 0,
  });
  return {...result, reflection: result.data?.reflection ?? null};
}

export function useSubmitReview(section: SectionRef) {
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
  sectionId?: string,
  enabled = true,
) {
  const result = useQuery({
    queryKey: peerReviewKeys.instructorList(courseVersionId, sectionId),
    queryFn: () =>
      peerReviewApi.listForInstructor(courseId, courseVersionId, sectionId),
    enabled: enabled && Boolean(courseId && courseVersionId),
  });
  return {...result, items: result.data?.items ?? []};
}

export function useInstructorReflectionStats(
  courseId: string,
  courseVersionId: string,
  sectionId?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: peerReviewKeys.instructorStats(courseVersionId, sectionId),
    queryFn: () =>
      peerReviewApi.getInstructorStats(courseId, courseVersionId, sectionId),
    enabled: enabled && Boolean(courseId && courseVersionId),
  });
}
