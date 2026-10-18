import { MessagesSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyDiscussionStateProps {
    /**
     * When provided, renders a "Start a discussion" call-to-action that
     * opens the create dialog. Omit on views where creation isn't possible
     * (e.g. the thread-detail page slot for replies).
     */
    onStartThread?: () => void;
}

/**
 * Empty state for the discussion list — shown when a cohort has zero
 * threads. Matches the dotted-card visual used by the announcement list
 * empty state, with copy tailored to the discussion semantic.
 */
export function EmptyDiscussionState({ onStartThread }: EmptyDiscussionStateProps) {
    return (
        <Card
            className="border-2 border-dashed bg-muted/20"
            data-testid="discussion-list-empty"
        >
            <CardContent className="py-12 px-6 text-center">
                <MessagesSquare className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-muted-foreground">
                    No discussions yet
                </h3>
                <p className="text-sm text-muted-foreground/80 max-w-sm mx-auto mt-1">
                    Start the first discussion in your cohort.
                </p>
                {onStartThread && (
                    <Button
                        size="sm"
                        className="mt-4"
                        onClick={onStartThread}
                        data-testid="discussion-empty-start-button"
                    >
                        Start a discussion
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}