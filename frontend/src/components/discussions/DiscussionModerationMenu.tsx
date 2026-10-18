import {
    MoreHorizontal,
    Pencil,
    Pin,
    PinOff,
    Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Dropdown-menu control for the thread / reply moderation actions.
 *
 * Used in two ways:
 *   - On a thread: shows Pin / Unpin + Delete (teacher-only) and Edit /
 *     Delete (own-content). Renders nothing when no actions are
 *     available.
 *   - On a reply: shows Edit (own-content) + Delete (own-content or
 *     teacher). Renders nothing for a non-own, non-authored reply
 *     viewed by a student.
 *
 * The action visibility is *entirely* derived from the booleans passed
 * in (`canPin`, `canEdit`, `canDelete`). The actual server-side
 * enforcement is in the discussionBoard controller — the UI hiding is
 * best-effort and intentionally never relies on a free-form role string
 * check; the parent component reads the same `authorFirebaseUid` /
 * `currentUserUid` pair the backend uses for permission checks.
 *
 * Click handling is forwarded from the parent so it can stop
 * propagation (the surrounding `<Link>` would otherwise navigate).
 */
interface DiscussionModerationMenuProps {
    /** Whether the caller can pin / unpin this thread. Teacher-only. */
    canPin?: boolean;
    /** Whether the caller can edit this thread / reply. Author or teacher. */
    canEdit?: boolean;
    /** Whether the caller can delete this thread / reply. */
    canDelete: boolean;
    /** Current pinned state — drives the menu label (Pin vs Unpin). */
    pinned?: boolean;
    /** Visible label for test-ids; "thread" or "reply". */
    itemKind?: "thread" | "reply";
    onEdit?: () => void;
    onDelete: () => void;
    onPin?: () => void;
    onUnpin?: () => void;
}

export function DiscussionModerationMenu({
    canPin,
    canEdit,
    canDelete,
    pinned,
    itemKind = "thread",
    onEdit,
    onDelete,
    onPin,
    onUnpin,
}: DiscussionModerationMenuProps) {
    const hasAnything = Boolean(
        canPin || canEdit || canDelete,
    );
    if (!hasAnything) return null;

    const testid = `discussion-${itemKind}-menu-trigger`;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label="Open moderation menu"
                    data-testid={testid}
                    onClick={e => {
                        // The thread card is itself a <Link>. Stop the
                        // navigation when the user opens the menu so
                        // clicking the trigger doesn't also navigate.
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                {canPin && onPin && !pinned && (
                    <DropdownMenuItem
                        data-testid={`discussion-${itemKind}-pin`}
                        onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            onPin();
                        }}
                    >
                        <Pin className="h-4 w-4" />
                        Pin thread
                    </DropdownMenuItem>
                )}
                {canPin && onUnpin && pinned && (
                    <DropdownMenuItem
                        data-testid={`discussion-${itemKind}-unpin`}
                        onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            onUnpin();
                        }}
                    >
                        <PinOff className="h-4 w-4" />
                        Unpin thread
                    </DropdownMenuItem>
                )}
                {canEdit && onEdit && (
                    <DropdownMenuItem
                        data-testid={`discussion-${itemKind}-edit`}
                        onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            onEdit();
                        }}
                    >
                        <Pencil className="h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                )}
                {(canPin || canEdit) && canDelete && (
                    <DropdownMenuSeparator />
                )}
                {canDelete && (
                    <DropdownMenuItem
                        variant="destructive"
                        data-testid={`discussion-${itemKind}-delete`}
                        onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete();
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
