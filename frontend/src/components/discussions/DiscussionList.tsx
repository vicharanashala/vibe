import { useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import {
    useDeleteDiscussionThread,
    useDiscussionThreads,
    usePinDiscussionThread,
} from "@/hooks/discussion-hooks";
import { useAuthStore } from "@/store/auth-store";
import type {
    DiscussionError,
    DiscussionThread,
} from "@/types/discussion.types";

import ConfirmationModal from "@/app/pages/teacher/components/confirmation-modal";
import { CreateDiscussionDialog } from "./CreateDiscussionDialog";
import { DiscussionErrorState } from "./DiscussionErrorState";
import { DiscussionListSkeleton } from "./DiscussionListSkeleton";
import { DiscussionThreadCard } from "./DiscussionThreadCard";
import { EmptyDiscussionState } from "./EmptyDiscussionState";

interface DiscussionListProps {
    courseId: string;
    /** Resolved from `useCourseStore.currentCourse.cohortId`. */
    cohortId: string | null;
    /**
     * Builder for the per-thread deep-link URL. The parent page knows its
     * own route shape (`/teacher/courses/...` vs `/student/courses/...`),
     * so we accept it rather than re-deriving.
     */
    threadHrefBuilder: (threadId: string) => string;
    /** Optional right-aligned header actions (e.g. extra buttons). */
    headerActions?: React.ReactNode;
}

/**
 * The list page body — orchestrates the loading / empty / error / data
 * states for the discussion thread list. Renders inside the existing
 * teacher/student layout's main content panel, exactly like the
 * announcements list does.
 *
 * Milestone C wiring: the list carries the moderation handlers (Pin /
 * Unpin / Delete / Edit) and the confirmation dialog. Each card
 * decides whether to surface the menu based on the current viewer's
 * identity vs the thread's author — same logic the backend enforces.
 */
export function DiscussionList({
    courseId,
    cohortId,
    threadHrefBuilder,
    headerActions,
}: DiscussionListProps) {
    const navigate = useNavigate();
    const {data, isLoading, error, refetch} = useDiscussionThreads(courseId);
    const [createOpen, setCreateOpen] = useState(false);

    const user = useAuthStore(s => s.user);
    const isTeacher =
        user?.role === "teacher" || user?.role === "admin";
    const currentUserUid = user?.uid;

    const {mutateAsync: deleteThread} = useDeleteDiscussionThread();
    const {pin, unpin} = usePinDiscussionThread();

    const [confirmTarget, setConfirmTarget] = useState<DiscussionThread | null>(
        null,
    );
    const [deleting, setDeleting] = useState(false);

    const handleConfirmDelete = async () => {
        if (!confirmTarget) return;
        setDeleting(true);
        try {
            await deleteThread(confirmTarget._id);
            toast.success("Thread deleted");
            await refetch();
            setConfirmTarget(null);
        } catch (err) {
            toast.error(
                (err as DiscussionError)?.message ??
                    "Could not delete that thread",
            );
        } finally {
            setDeleting(false);
        }
    };

    const handlePin = async (threadId: string) => {
        try {
            await pin(threadId);
            toast.success("Thread pinned");
            await refetch();
        } catch (err) {
            toast.error(
                (err as DiscussionError)?.message ??
                    "Could not pin that thread",
            );
        }
    };

    const handleUnpin = async (threadId: string) => {
        try {
            await unpin(threadId);
            toast.success("Thread unpinned");
            await refetch();
        } catch (err) {
            toast.error(
                (err as DiscussionError)?.message ??
                    "Could not unpin that thread",
            );
        }
    };

    const handleEdit = (threadId: string) => {
        // Edit happens on the thread detail page, not in the list —
        // navigate there so the inline edit form is available.
        navigate({to: threadHrefBuilder(threadId) as any});
    };

    return (
        <div className="flex-1 min-w-0">
            <div className="space-y-6">
                <PageHeader
                    title="Discussions"
                    description="Conversations with everyone in your cohort"
                    actions={
                        <div className="flex items-center gap-2">
                            {headerActions}
                            <Button
                                size="sm"
                                className="gap-2"
                                onClick={() => setCreateOpen(true)}
                                data-testid="discussion-create-button"
                                disabled={!cohortId}
                                title={
                                    cohortId
                                        ? "Start a new thread"
                                        : "Open a course first to start a thread"
                                }
                            >
                                <Plus className="h-4 w-4" />
                                Create Thread
                            </Button>
                        </div>
                    }
                />

                {isLoading ? (
                    <DiscussionListSkeleton />
                ) : error ? (
                    <DiscussionErrorState error={error} onRetry={refetch} />
                ) : data.length === 0 ? (
                    <EmptyDiscussionState
                        onStartThread={
                            cohortId
                                ? () => setCreateOpen(true)
                                : undefined
                        }
                    />
                ) : (
                    <div
                        className="grid gap-4"
                        data-testid="discussion-list"
                    >
                        {data.map(thread => {
                            const isAuthor =
                                !!currentUserUid &&
                                !!thread.authorFirebaseUid &&
                                thread.authorFirebaseUid ===
                                    currentUserUid;
                            return (
                                <DiscussionThreadCard
                                    key={thread._id}
                                    thread={thread}
                                    hrefBuilder={threadHrefBuilder}
                                    isAuthor={isAuthor}
                                    isTeacher={isTeacher}
                                    onEdit={handleEdit}
                                    onDelete={t =>
                                        setConfirmTarget(
                                            data.find(x => x._id === t) ??
                                                null,
                                        )
                                    }
                                    onPin={handlePin}
                                    onUnpin={handleUnpin}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            <CreateDiscussionDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                courseId={courseId}
                cohortId={cohortId}
                availableCohorts={cohortsToPostTo}
                onCreated={thread => {
                    navigate({to: threadHrefBuilder(thread._id) as any});
                }}
            />

            <ConfirmationModal
                isOpen={!!confirmTarget}
                onClose={() => {
                    if (!deleting) setConfirmTarget(null);
                }}
                onConfirm={handleConfirmDelete}
                title="Delete thread"
                description={
                    confirmTarget
                        ? `Are you sure you want to delete "${confirmTarget.title}"? Replies will be removed too. This action cannot be undone.`
                        : ""
                }
                confirmText="Delete"
                isDestructive
                isLoading={deleting}
                loadingText="Deleting…"
            />
        </div>
    );
}