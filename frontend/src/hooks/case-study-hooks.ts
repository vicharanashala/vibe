import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {
  caseStudyApi,
  type CourseVersionRef,
  type PickOutcome,
} from '@/lib/api/case-studies';

export const caseStudyKeys = {
  list: (r: CourseVersionRef) => ['case-studies', 'list', r.courseId, r.versionId],
  myResponse: (caseStudyId: string) => ['case-studies', 'mine', caseStudyId],
  nextPair: (caseStudyId: string) => ['case-studies', 'pair', caseStudyId],
};

export function useMyCaseResponses(ref: CourseVersionRef, enabled = true) {
  const result = useQuery({
    queryKey: caseStudyKeys.list(ref),
    queryFn: () => caseStudyApi.listCases(ref),
    enabled: enabled && Boolean(ref.courseId && ref.versionId),
  });
  return {...result, cases: result.data?.cases ?? []};
}

export function useMyCaseResponse(caseStudyId: string, enabled = true) {
  const result = useQuery({
    queryKey: caseStudyKeys.myResponse(caseStudyId),
    queryFn: () => caseStudyApi.getMyResponse(caseStudyId),
    enabled: enabled && Boolean(caseStudyId),
  });
  return {...result, response: result.data?.response ?? null};
}

export function useSubmitCaseResponse(ref: CourseVersionRef, caseStudyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => caseStudyApi.submitResponse(caseStudyId, text),
    onSuccess: () => {
      // The case list's locked/writable states move together — case N+1
      // unlocks in the same instant case N is submitted.
      queryClient.invalidateQueries({queryKey: caseStudyKeys.list(ref)});
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
      queryClient.invalidateQueries({queryKey: caseStudyKeys.list(ref)});
    },
    onError: (error: Error) => toast.error(error.message || 'Could not submit your pick'),
  });
}

export function useReviseResponse(ref: CourseVersionRef, caseStudyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => caseStudyApi.reviseResponse(caseStudyId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: caseStudyKeys.list(ref)});
      queryClient.invalidateQueries({queryKey: caseStudyKeys.myResponse(caseStudyId)});
      toast.success('Response resubmitted');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not revise your response'),
  });
}
