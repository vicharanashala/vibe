import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {
  caseStudyApi,
  type CaseResponseInput,
  type CourseVersionRef,
  type PickOutcome,
} from '@/lib/api/case-studies';

export const caseStudyKeys = {
  myResponse: (caseStudyId: string) => ['case-studies', 'mine', caseStudyId],
  nextPair: (caseStudyId: string) => ['case-studies', 'pair', caseStudyId],
};

/**
 * Syncs the case record backing a CASE_STUDY item and returns its content.
 * Runs once when the learner opens the item; the peer-review hooks below then
 * key on the item's own id.
 */
export function useEnsureCaseForItem(ref: CourseVersionRef, itemId: string, enabled = true) {
  const result = useQuery({
    queryKey: ['case-studies', 'ensure', itemId],
    queryFn: () => caseStudyApi.ensureCase(ref, itemId),
    enabled: enabled && Boolean(ref.courseId && ref.versionId && itemId),
    staleTime: Infinity,
  });
  return {...result, caseStudy: result.data ?? null};
}

export function useMyCaseResponse(caseStudyId: string, enabled = true) {
  const result = useQuery({
    queryKey: caseStudyKeys.myResponse(caseStudyId),
    queryFn: () => caseStudyApi.getMyResponse(caseStudyId),
    enabled: enabled && Boolean(caseStudyId),
  });
  return {
    ...result,
    response: result.data?.response ?? null,
    eligibleForRevision: result.data?.eligibleForRevision ?? false,
    picksRequired: result.data?.picksRequired ?? 0,
    picksCompleted: result.data?.picksCompleted ?? 0,
  };
}

export function useSubmitCaseResponse(ref: CourseVersionRef, caseStudyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (response: CaseResponseInput) => caseStudyApi.submitResponse(caseStudyId, response),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: caseStudyKeys.myResponse(caseStudyId)});
      toast.success('Response submitted');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not submit your response'),
  });
}

/**
 * The next pair to review. Not cached across picks — every successful pick
 * invalidates this so the next call serves a fresh pair, mirroring
 * useNextReflectionToReview's staleTime:0 contract.
 */
export function useNextComparisonPair(caseStudyId: string, enabled = true) {
  const result = useQuery({
    queryKey: caseStudyKeys.nextPair(caseStudyId),
    queryFn: () => caseStudyApi.getNextPair(caseStudyId),
    enabled: enabled && Boolean(caseStudyId),
    staleTime: 0,
  });
  return {...result, pair: result.data?.pair ?? null};
}

export function useSubmitPick(ref: CourseVersionRef, caseStudyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {comparisonId: string; outcome: PickOutcome}) =>
      caseStudyApi.submitPick(input.comparisonId, input.outcome),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: caseStudyKeys.nextPair(caseStudyId)});
      // Refresh my-response so the "reviews done" counter advances after a pick.
      queryClient.invalidateQueries({queryKey: caseStudyKeys.myResponse(caseStudyId)});
    },
    onError: (error: Error) => toast.error(error.message || 'Could not submit your pick'),
  });
}

export function useReviseResponse(ref: CourseVersionRef, caseStudyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (response: CaseResponseInput) => caseStudyApi.reviseResponse(caseStudyId, response),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: caseStudyKeys.myResponse(caseStudyId)});
      toast.success('Response resubmitted');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not revise your response'),
  });
}

export function useCaseStudyResponses(
  courseId: string,
  versionId: string,
  itemId: string,
  enabled = true,
) {
  const result = useQuery({
    queryKey: ['case-studies', 'instructor-responses', itemId],
    queryFn: () => caseStudyApi.listResponses(courseId, versionId, itemId),
    enabled: enabled && Boolean(courseId && versionId && itemId),
  });
  return {...result, responses: result.data?.responses ?? []};
}

