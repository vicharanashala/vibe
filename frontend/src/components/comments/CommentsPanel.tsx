import {useState} from 'react';
import {ChevronDown, ChevronUp, Loader2, MessageSquare, Send} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {cn} from '@/utils/utils';
import {useComments, usePostComment} from '@/hooks/comment-hooks';
import type {CommentItemRef, CommentView} from '@/lib/api/comments';

interface CommentsPanelProps {
  itemRef: CommentItemRef;
}

/**
 * Deliberately small (PLANNING.md §6): a flat, collapsible comment thread
 * under a video item — post + one-level reply, no voting, no moderation
 * queue. The client itself is unsure this feature is worth building big, so
 * it stays a short column beside the player rather than a separate page.
 */
export default function CommentsPanel({itemRef}: CommentsPanelProps) {
  const [open, setOpen] = useState(false);
  const {comments, isLoading} = useComments(itemRef, open);

  const topLevel = comments.filter(c => !c.parentCommentId);
  const repliesByParent = new Map<string, CommentView[]>();
  for (const c of comments) {
    if (c.parentCommentId) {
      const list = repliesByParent.get(c.parentCommentId) ?? [];
      list.push(c);
      repliesByParent.set(c.parentCommentId, list);
    }
  }

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comments {comments.length > 0 ? `(${comments.length})` : ''}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open ? (
        <div className="space-y-4 border-t p-4">
          <ComposeBox itemRef={itemRef} />
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading comments…
            </div>
          ) : topLevel.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">Be the first to comment.</p>
          ) : (
            <ul className="space-y-4">
              {topLevel.map(comment => (
                <li key={comment.commentId} className="space-y-2">
                  <CommentRow comment={comment} />
                  {(repliesByParent.get(comment.commentId) ?? []).map(reply => (
                    <div key={reply.commentId} className="ml-8">
                      <CommentRow comment={reply} />
                    </div>
                  ))}
                  <ReplyBox itemRef={itemRef} parentCommentId={comment.commentId} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CommentRow({comment}: {comment: CommentView}) {
  return (
    <div className="rounded-md bg-muted/40 p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold">{comment.authorName}</span>
        <span className="text-[11px] text-muted-foreground">
          {new Date(comment.createdAt).toLocaleDateString()}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-line text-sm">{comment.text}</p>
    </div>
  );
}

function ComposeBox({itemRef}: {itemRef: CommentItemRef}) {
  const [text, setText] = useState('');
  const post = usePostComment(itemRef);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await post.mutateAsync({text: trimmed});
    setText('');
  };

  return (
    <div className="flex items-end gap-2">
      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Add a comment…"
        rows={2}
        className="min-h-0 resize-none text-sm"
      />
      <Button size="icon" onClick={submit} disabled={!text.trim() || post.isPending} className="shrink-0">
        {post.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function ReplyBox({itemRef, parentCommentId}: {itemRef: CommentItemRef; parentCommentId: string}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const post = usePostComment(itemRef);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('ml-8 text-xs text-muted-foreground hover:underline')}
      >
        Reply
      </button>
    );
  }

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await post.mutateAsync({text: trimmed, parentCommentId});
    setText('');
    setOpen(false);
  };

  return (
    <div className="ml-8 flex items-end gap-2">
      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Write a reply…"
        rows={2}
        className="min-h-0 resize-none text-sm"
        autoFocus
      />
      <Button size="icon" onClick={submit} disabled={!text.trim() || post.isPending} className="shrink-0">
        {post.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}
