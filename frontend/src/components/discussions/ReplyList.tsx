import { Calendar, MessagesSquare } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { DiscussionReply } from "@/types/discussion.types";

import { DiscussionModerationMenu } from "./DiscussionModerationMenu";

interface ReplyListProps {
    replies: DiscussionReply[];
    /** Whether the caller is a teacher / moderator (drives Pin/Delete menu). */
    isTeacher: boolean;
    /** Current viewer's Firebase UID — used to gate own-content Edit/Delete. */
    currentUserUid: string | undefined;
    onDelete: (replyId: string) => void;
}

/**
 * Chronological list of replies for a thread. Empty state copy matches
 * the tone Milestone B established in the placeholder.
 *
 * Each row exposes the moderation menu:
 *   - Teacher (any reply in their course) sees Delete.
 *   - Author sees Edit + Delete on their own reply.
 *
 * Both are gated via the existing server-side CASL ability; the props
 * here (`isTeacher`, `currentUserUid`) just decide whether the menu is
 * rendered at all.
 */
export function ReplyList({
    replies,
    isTeacher,
    currentUserUid,
    onDelete,
}: ReplyListProps) {
    if (replies.length === 0) {
        return (
            <Card
                data-testid="discussion-replies-empty"
                className="border border-dashed bg-muted/20"
            >
                <CardContent className="py-8 px-6 text-center">
                    <MessagesSquare className="h-7 w-7 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                        No replies yet. Be the first to help your classmates.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div
            className="space-y-3"
            data-testid="discussion-replies-list"
            data-reply-count={replies.length}
        >
            {replies.map(reply => {
                const isAuthor =
                    !!currentUserUid &&
                    !!reply.authorFirebaseUid &&
                    reply.authorFirebaseUid === currentUserUid;
                const canEdit = isAuthor;
                const canDelete = isAuthor || isTeacher;
                return (
                    <ReplyRow
                        key={reply._id}
                        reply={reply}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onDelete={() => onDelete(reply._id)}
                    />
                );
            })}
        </div>
    );
}

interface ReplyRowProps {
    reply: DiscussionReply;
    canEdit: boolean;
    canDelete: boolean;
    onDelete: () => void;
}

function initialsOf(id: string): string {
    return (
        id.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "??"
    );
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function ReplyRow({reply, canEdit, canDelete, onDelete}: ReplyRowProps) {
    return (
        <Card data-testid="discussion-reply" data-reply-id={reply._id}>
            <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 border border-border/30 shrink-0">
                        <AvatarImage
                            src={
                                "https://api.dicebear.com/7.x/initials/svg?seed=" +
                                reply.authorId
                            }
                            alt=""
                        />
                        <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-primary text-[10px] font-bold">
                            {initialsOf(reply.authorId)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                    <span
                                        data-testid="discussion-reply-author"
                                        className="font-medium text-foreground"
                                    >
                                        {initialsOf(reply.authorId)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {formatDate(reply.createdAt)}
                                    </span>
                                </div>
                                <p
                                    className="text-sm text-foreground/90 whitespace-pre-line mt-1"
                                    data-testid="discussion-reply-body"
                                >
                                    {reply.body}
                                </p>
                            </div>
                            <DiscussionModerationMenu
                                itemKind="reply"
                                canEdit={canEdit}
                                canDelete={canDelete}
                                onDelete={onDelete}
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}