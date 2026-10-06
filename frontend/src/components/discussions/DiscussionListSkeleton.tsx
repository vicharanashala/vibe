import { DiscussionThreadCardSkeleton } from "./DiscussionThreadCard";

interface DiscussionListSkeletonProps {
    /**
     * Number of skeleton cards to render. Defaults to 4 — roughly the size
     * of an average populated cohort on first load.
     */
    count?: number;
}

/**
 * Loading skeleton for the discussion list page.
 *
 * Built from the same `Skeleton` primitive used elsewhere in the app
 * (announcements card, course-card, etc.). Matches the visual weight of
 * `DiscussionThreadCardSkeleton` so the layout doesn't jump when data loads.
 */
export function DiscussionListSkeleton({ count = 4 }: DiscussionListSkeletonProps) {
    return (
        <div
            className="grid gap-4"
            data-testid="discussion-list-skeleton"
            aria-busy="true"
            aria-live="polite"
        >
            {Array.from({ length: count }).map((_, idx) => (
                <DiscussionThreadCardSkeleton key={idx} />
            ))}
        </div>
    );
}