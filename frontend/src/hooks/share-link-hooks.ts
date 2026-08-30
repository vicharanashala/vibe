import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createShareLinks,
  getQuickShares,
  getShareLinkAnalytics,
  quickShare,
  revokeShareLink,
  validateYouTubeUrl,
} from '@/lib/api/share-links';
import type {
  CreateShareLinksInput,
  QuickShareInput,
} from '@/types/share-link.types';

const shareLinkKeys = {
  analytics: (courseId: string, versionId: string, cohortId?: string) =>
    ['share-links', courseId, versionId, cohortId ?? 'all'] as const,
};

/** Who the course was shared with, and what each of them watched. */
export function useShareLinkAnalytics(
  courseId: string,
  versionId: string,
  cohortId?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: shareLinkKeys.analytics(courseId, versionId, cohortId),
    queryFn: () => getShareLinkAnalytics(courseId, versionId, cohortId),
    enabled: enabled && !!courseId && !!versionId,
  });
}

export function useCreateShareLinks(courseId: string, versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShareLinksInput) =>
      createShareLinks(courseId, versionId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['share-links', courseId, versionId],
      });
    },
  });
}

export function useRevokeShareLink(courseId: string, versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shareLinkId: string) => revokeShareLink(shareLinkId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['share-links', courseId, versionId],
      });
    },
  });
}

/** Videos shared outside any course, and who watched them. */
export function useQuickShares() {
  return useQuery({
    queryKey: ['share-links', 'quick'],
    queryFn: getQuickShares,
  });
}

export function useQuickShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: QuickShareInput) => quickShare(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-links', 'quick'] });
    },
  });
}

/**
 * Checks a pasted YouTube URL. An unplayable video resolves normally with
 * `embeddable: false` — it is an answer to show, not an error to swallow.
 */
export function useValidateYouTubeUrl() {
  return useMutation({
    mutationFn: (url: string) => validateYouTubeUrl(url),
  });
}
