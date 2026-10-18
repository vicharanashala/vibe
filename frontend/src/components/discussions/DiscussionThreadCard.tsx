import { Link } from "@tanstack/react-router";
import { Calendar, MessageSquare, Pin } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DiscussionThread } from "@/types/discussion.types";
import { cn } from "@/utils/utils";

import { DiscussionModerationMenu } from "./DiscussionModerationMenu";

interface DiscussionThreadCardProps {
    thread: DiscussionThread;
    /**
     * URL builder for the per-thread view. Receives the thread id and must
     * return a route string the router knows about.
     */
    hrefBuilder: (threadId: string) => string;
    /**
     * Number of replies the card should advertise. Optional — when
     * omitted the card falls back to "0 replies" so it stays
     * presentable in list contexts that haven't fetched reply counts.
     */
    replyCount?: number;
    /**
     * Whether the current viewer is the thread's author. Drives the
     * own-content Edit/Delete entry in the moderation menu.
     */
    isAuthor?: boolean;
    /**
     * Whether the current viewer is a course moderator (teacher). Drives
     * the Pin/Unpin + Delete-any menu entries.
     */
    isTeacher?: boolean;
    onEdit?: (threadId: string) => void;
    onDelete?: (threadId: string) => void;
    onPin?: (threadId: string) => void;
    onUnpin?: (threadId: string) => void;
}

/** A trimmed preview of the body — first non-empty line, capped at 200 chars. */
function previewOf(body: string): string {
    const firstLine = body
        .split(/\r?\n/)
        .map(line => line.trim())
        .find(line => line.length > 0) ?? "";
    if (firstLine.length <= 200) return firstLine;
    return `${firstLine.slice(0, 200).trimEnd()}…`;
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
    return id.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "??";
}

/**
 * Single thread card in the discussion list.
 *
 * Visual contract (Milestone B):
 *   - Pinned badge in the title row when `thread.pinned === true`
 *   - Author avatar + authorId-derived initials
 *   - Created-at timestamp (ISO → human)
 *   - First-line preview of the body
 *   - Whole card is a router link to the thread view
 */
export function DiscussionThreadCard({
    thread,
    hrefBuilder,
    replyCount,
    isAuthor,
    isTeacher,
    onEdit,
    onDelete,
    onPin,
    onUnpin,
}: DiscussionThreadCardProps) {
    const displayedReplies =
        typeof replyCount === "number" ? replyCount : 0;
    const hasAnyModerAction = Boolean(
        onDelete && (isAuthor || isTeacher),
    ) || Boolean(isTeacher && (onPin || onUnpin)) || Boolean(onEdit && (isAuthor || isTeacher));
    return (
        <Link
            to={hrefBuilder(thread._id)}
            className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl"
            data-testid="discussion-thread-card"
            data-thread-id={thread._id}
        >
            <Card
                className={cn(
                    "transition-all duration-200 hover:shadow-md hover:border-primary/40 cursor-pointer",
                    thread.pinned && "border-l-4 border-l-primary",
                )}
            >
                <CardHeader className="pb-2 space-y-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3 items-start min-w-0 flex-1">
                            <Avatar className="h-9 w-9 border border-border/30 shrink-0">
                                <AvatarImage
                                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${thread.authorId}`}
                                    alt=""
                                />
                                <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-primary text-xs font-bold">
                                    {initialsOf(thread.authorId)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base font-semibold leading-tight truncate">
                                        {thread.title}
                                    </h3>
                                    {thread.pinned && (
                                        <Badge
                                            variant="secondary"
                                            className="gap-1 text-[10px] h-5 px-1.5 shrink-0"
                                            data-testid="discussion-pinned-badge"
                                        >
                                            <Pin className="h-3 w-3" />
                                            Pinned
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {formatDate(thread.createdAt)}
                                    </span>
                                    <span
                                        className="flex items-center gap-1"
                                        data-testid="discussion-reply-count"
                                    >
                                        <MessageSquare className="h-3 w-3" />
                                        <span>
                                            {displayedReplies}{" "}
                                            {displayedReplies === 1
                                                ? "reply"
                                                : "replies"}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>
                        {hasAnyModerAction && (
                            <DiscussionModerationMenu
                                itemKind="thread"
                                canPin={Boolean(isTeacher)}
                                canEdit={
                                    Boolean(onEdit) &&
                                    Boolean(isAuthor || isTeacher)
                                }
                                canDelete={
                                    Boolean(onDelete) &&
                                    Boolean(isAuthor || isTeacher)
                                }
                                pinned={thread.pinned}
                                onEdit={() => onEdit?.(thread._id)}
                                onDelete={() => onDelete?.(thread._id)}
                                onPin={() => onPin?.(thread._id)}
                                onUnpin={() => onUnpin?.(thread._id)}
                            />
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                        {previewOf(thread.body)}
                    </p>
                </CardContent>
            </Card>
        </Link>
    );
}

/**
 * Skeleton placeholder for a single card slot — used by `DiscussionListSkeleton`.
 */
export function DiscussionThreadCardSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-2 space-y-0">
                <div className="flex items-start gap-3">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="space-y-2 flex-1 min-w-0">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0 pb-4 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
            </CardContent>
        </Card>
    );
}