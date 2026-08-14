import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {commentApi, type CommentItemRef} from '@/lib/api/comments';

const key = (r: CommentItemRef) => ['comments', r.courseId, r.courseVersionId, r.itemId];

export function useComments(ref: CommentItemRef, enabled = true) {
  const result = useQuery({
    queryKey: key(ref),
    queryFn: () => commentApi.list(ref),
    enabled: enabled && Boolean(ref.itemId),
  });
  return {...result, comments: result.data?.comments ?? []};
}

export function usePostComment(ref: CommentItemRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {text: string; parentCommentId?: string}) => commentApi.post(ref, body),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: key(ref)});
    },
    onError: (error: Error) => toast.error(error.message || 'Could not post your comment'),
  });
}
