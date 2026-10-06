import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DiscussionError } from "@/types/discussion.types";

interface DiscussionErrorStateProps {
    error: DiscussionError;
    onRetry?: () => void;
}

/**
 * Visible, non-generic error state for the discussion list / thread view.
 *
 * Distinguishes network failure from auth (401), permission (403),
 * not-found (404), validation (400), and server (5xx) — using the
 * `DiscussionError.kind` already decoded in `discussion-hooks.ts`. Each
 * case surfaces a copy line that tells the user *what went wrong* and
 * *what to do next*, plus a retry button when the underlying call could
 * reasonably be retried.
 */
export function DiscussionErrorState({ error, onRetry }: DiscussionErrorStateProps) {
    const isRetryable =
        error.kind === "network" ||
        error.kind === "server" ||
        error.kind === "forbidden" ||
        error.kind === "not_found";
    const Icon =
        error.kind === "network" ? WifiOff : AlertCircle;
    const title =
        error.kind === "network"
            ? "We can't reach the server"
            : error.kind === "unauthenticated"
                ? "Your session has expired"
                : error.kind === "forbidden"
                    ? "You don't have access"
                    : error.kind === "not_found"
                        ? "This discussion is unavailable"
                        : error.kind === "validation"
                            ? "We couldn't send your request"
                            : "Something went wrong";

    return (
        <Card
            className="border border-destructive/20 bg-destructive/5"
            data-testid="discussion-error-state"
            data-error-kind={error.kind}
            role="alert"
        >
            <CardContent className="py-8 px-6 text-center">
                <Icon className="h-9 w-9 text-destructive mx-auto mb-3" />
                <h3 className="text-base font-semibold text-destructive mb-1">
                    {title}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {error.message}
                </p>
                {isRetryable && onRetry && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 gap-2"
                        onClick={onRetry}
                        data-testid="discussion-error-retry"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Try again
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}