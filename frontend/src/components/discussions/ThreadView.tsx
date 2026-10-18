import { ArrowLeft, Calendar, MessageSquare, Pin } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    useDeleteDiscussionReply,
    useDeleteDiscussionThread,
    useDiscussionThread,
    usePinDiscussionThread,
} from "@/hooks/discussion-hooks";
import type {
    DiscussionError,
    DiscussionReply,
    DiscussionThread,
} from "@/types/discussion.types";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";

import ConfirmationModal from "@/app/pages/teacher/components/confirmation-modal";
import { DiscussionErrorState } from "./DiscussionErrorState";
import { DiscussionModerationMenu } from "./DiscussionModerationMenu";
import { EditThreadForm } from "./EditThreadForm";
import { ReplyForm } from "./ReplyForm";
import { ReplyList } from "./ReplyList";

interface ThreadViewProps {
    threadId: string;
    listHref: string;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function initialsOf(id: string): string {
    const s = id.replace(/[^a-zA-Z]/g, "");
    const out = (s.length >= 2 ? s.slice(0, 2) : s).toUpperCase();
    return out.length > 0 ? out : "??";
}

/**
 * Confirm dialog state — only one of these can be active at a time.
 * The target is the id of the thing to delete; the kind tells the copy
 * which message to show.
 */
type ConfirmState =
    | {kind: "thread"; threadId: string; title: string}
    | {kind: "reply"; replyId: string; preview: string}
    | null;

/**
 * The /teacher/.../discussions page and the /student/.../discussions
 * page both render this component. The page chrome decides layout and
 * auth-context boundaries; this component figures out "is the current
 * user a teacher / instructor?" by reading the auth store's `role`,
 * which mirrors the convention `AnnouncementItem` already uses.
 */
function useIsTeacher(): boolean {
    const user = useAuthStore(s => s.user);
    return user?.role === "teacher" || user?.role === "admin";
}

function renderThreadBody(
    thread: DiscussionThread,
    replies: DiscussionReply[],
    isAuthor: boolean,
    isTeacher: boolean,
    currentUserUid: string | undefined,
    onAskDeleteThread: (thread: DiscussionThread) => void,
    onAskDeleteReply: (reply: DiscussionReply) => void,
    onPin: () => void,
    onUnpin: () => void,
    onAskEdit: () => void,
) {
    return (
        <>
            <Card data-testid="discussion-thread-detail">
                <CardHeader className="pb-2 space-y-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3 items-start min-w-0 flex-1">
                            <Avatar className="h-10 w-10 border border-border/30 shrink-0">
                                <AvatarImage
                                    src={
                                        "https://api.dicebear.com/7.x/initials/svg?seed=" +
                                        thread.authorId
                                    }
                                    alt=""
                                />
                                <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-primary text-xs font-bold">
                                    {initialsOf(thread.authorId)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1
                                        className="text-xl font-semibold leading-tight"
                                        data-testid="discussion-thread-title"
                                    >
                                        {thread.title}
                                    </h1>
                                    {thread.pinned ? (
                                        <Badge
                                            variant="secondary"
                                            className="gap-1 text-[10px] h-5 px-1.5 shrink-0"
                                        >
                                            <Pin className="h-3 w-3" />
                                            Pinned
                                        </Badge>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                    <span
                                        className="flex items-center gap-1"
                                        data-testid="discussion-thread-author"
                                    >
                                        {initialsOf(thread.authorId)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {formatDate(thread.createdAt)}
                                    </span>
                                    <span
                                        className="flex items-center gap-1"
                                        data-testid="discussion-thread-reply-count"
                                    >
                                        <MessageSquare className="h-3 w-3" />
                                        <span>
                                            {replies.length}{" "}
                                            {replies.length === 1
                                                ? "reply"
                                                : "replies"}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>
                        <DiscussionModerationMenu
                            itemKind="thread"
                            canPin={isTeacher}
                            canEdit={isAuthor || isTeacher}
                            canDelete={isAuthor || isTeacher}
                            pinned={thread.pinned}
                            onEdit={onAskEdit}
                            onDelete={() => onAskDeleteThread(thread)}
                            onPin={onPin}
                            onUnpin={onUnpin}
                        />
                    </div>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                    <p
                        className="text-sm text-foreground/90 whitespace-pre-line"
                        data-testid="discussion-thread-body"
                    >
                        {thread.body}
                    </p>
                </CardContent>
            </Card>

            <div className="space-y-3">
                <h2
                    className="text-sm font-semibold text-muted-foreground"
                    data-testid="discussion-replies-heading"
                >
                    {replies.length === 0
                        ? "Replies"
                        : `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
                </h2>
                <ReplyForm threadId={thread._id} />
                <ReplyList
                    replies={replies}
                    isTeacher={isTeacher}
                    currentUserUid={currentUserUid}
                    onDelete={replyId => {
                        const target = replies.find(r => r._id === replyId);
                        if (target) onAskDeleteReply(target);
                    }}
                />
            </div>
        </>
    );
}

function ThreadViewSkeleton() {
    return (
        <div
            className="space-y-4"
            data-testid="discussion-thread-skeleton"
            aria-busy="true"
            aria-live="polite"
        >
            <Card>
                <CardHeader className="pb-2 space-y-0">
                    <div className="flex items-start gap-3">
                        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                        <div className="space-y-2 flex-1 min-w-0">
                            <Skeleton className="h-5 w-2/3" />
                            <Skeleton className="h-3 w-1/3" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0 pb-4 space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                </CardContent>
            </Card>
            <Card>
                <CardContent className="py-10 px-6 text-center space-y-2">
                    <Skeleton className="h-6 w-6 rounded-full mx-auto" />
                    <Skeleton className="h-4 w-1/3 mx-auto" />
                    <Skeleton className="h-3 w-2/3 mx-auto" />
                </CardContent>
            </Card>
        </div>
    );
}

export function ThreadView({threadId, listHref}: ThreadViewProps) {
    const {data, isLoading, error: fetchError, refetch} =
        useDiscussionThread(threadId);
    const thread = data ? data.thread : null;
    const replies = data ? data.replies : [];

    const isTeacher = useIsTeacher();
    const user = useAuthStore(s => s.user);
    const currentUserUid = user?.uid;

    const {mutateAsync: deleteThread} = useDeleteDiscussionThread();
    const {mutateAsync: deleteReply} = useDeleteDiscussionReply();
    const {pin, unpin} = usePinDiscussionThread();

    // Confirm + delete state
    const [confirm, setConfirm] = useState<ConfirmState>(null);
    const [deleting, setDeleting] = useState(false);

    // Inline edit state
    const [editing, setEditing] = useState(false);

    const handleConfirmDelete = async () => {
        if (!confirm) return;
        setDeleting(true);
        try {
            if (confirm.kind === "thread") {
                await deleteThread(confirm.threadId);
                toast.success("Thread deleted");
            } else {
                await deleteReply(confirm.replyId);
                toast.success("Reply deleted");
            }
            await refetch();
            setConfirm(null);
        } catch (err) {
            toast.error(
                (err as DiscussionError)?.message ??
                    "Could not delete that item",
            );
        } finally {
            setDeleting(false);
        }
    };

    const handlePin = async () => {
        if (!thread) return;
        try {
            await pin(thread._id);
            toast.success("Thread pinned");
            await refetch();
        } catch (err) {
            toast.error(
                (err as DiscussionError)?.message ??
                    "Could not pin that thread",
            );
        }
    };

    const handleUnpin = async () => {
        if (!thread) return;
        try {
            await unpin(thread._id);
            toast.success("Thread unpinned");
            await refetch();
        } catch (err) {
            toast.error(
                (err as DiscussionError)?.message ??
                    "Could not unpin that thread",
            );
        }
    };

    const handleEditSaved = async (updated: DiscussionThread) => {
        setEditing(false);
        toast.success("Thread updated");
        // Refetch the bundled detail so the edited title / body is the
        // canonical source.
        await refetch();
        void updated;
    };

    const isAuthor =
        !!thread &&
        !!currentUserUid &&
        !!thread.authorFirebaseUid &&
        thread.authorFirebaseUid === currentUserUid;

    return (
        <div className="flex-1 min-w-0">
            <div className="space-y-6">
                <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="gap-2 -ml-2 text-muted-foreground"
                    data-testid="discussion-back-to-list"
                >
                    <Link to={listHref as any}>
                        <ArrowLeft className="h-4 w-4" />
                        Back to discussions
                    </Link>
                </Button>
                {isLoading ? (
                    <ThreadViewSkeleton />
                ) : fetchError ? (
                    <DiscussionErrorState
                        error={fetchError}
                        onRetry={refetch}
                    />
                ) : thread ? (
                    editing ? (
                        <EditThreadForm
                            thread={thread}
                            onSaved={handleEditSaved}
                            onCancel={() => setEditing(false)}
                        />
                    ) : (
                        renderThreadBody(
                            thread,
                            replies,
                            isAuthor,
                            isTeacher,
                            currentUserUid,
                            t =>
                                setConfirm({
                                    kind: "thread",
                                    threadId: t._id,
                                    title: t.title,
                                }),
                            r =>
                                setConfirm({
                                    kind: "reply",
                                    replyId: r._id,
                                    preview:
                                        r.body.length > 60
                                            ? r.body.slice(0, 60) + "…"
                                            : r.body,
                                }),
                            handlePin,
                            handleUnpin,
                            () => setEditing(true),
                        )
                    )
                ) : (
                    <DiscussionErrorState
                        error={{
                            kind: "not_found",
                            message: "This thread could not be found.",
                        }}
                    />
                )}
            </div>

            <ConfirmationModal
                isOpen={!!confirm}
                onClose={() => {
                    if (!deleting) setConfirm(null);
                }}
                onConfirm={handleConfirmDelete}
                title={
                    confirm?.kind === "thread"
                        ? "Delete thread"
                        : "Delete reply"
                }
                description={
                    confirm?.kind === "thread"
                        ? `Are you sure you want to delete "${confirm?.title ?? ""}"? Replies will be removed too. This action cannot be undone.`
                        : `Are you sure you want to delete this reply? "${confirm?.kind === "reply" ? confirm.preview : ""}" — This action cannot be undone.`
                }
                confirmText="Delete"
                isDestructive
                isLoading={deleting}
                loadingText="Deleting…"
            />
        </div>
    );
}