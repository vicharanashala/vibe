/**
 * Typed client for the Milestone C discussionBoard backend.
 *
 * Matches the announcement-hooks pattern: raw `fetch` against
 * `${BASE_URL}/...` with an inlined `getAuthHeaders()` helper that reads the
 * Firebase auth token from localStorage. This is the prevailing convention
 * for course-scoped features (announcements, peer reviews, HP system, …) —
 * do not substitute `lib/api-client.ts` here.
 *
 * Endpoints covered (Milestone A + B + C):
 *   GET    /course/:courseId/discussions              → DiscussionThread[]
 *   POST   /course/:courseId/discussions              → DiscussionThread
 *   GET    /discussions/:threadId                     → DiscussionThreadDetail
 *   PATCH  /discussions/:threadId                     → DiscussionThread (edit)
 *   DELETE /discussions/:threadId                     → 204 (cascades replies)
 *   PATCH  /discussions/:threadId/pin                 → DiscussionThread
 *   POST   /discussions/:threadId/replies             → DiscussionReply
 *   DELETE /replies/:replyId                          → 204
 */

import { useCallback, useEffect, useState } from "react";

import type {
    CreateDiscussionBody,
    CreateReplyBody,
    DiscussionError,
    DiscussionErrorKind,
    DiscussionReply,
    DiscussionThread,
    DiscussionThreadDetail,
    PinThreadBody,
    UpdateThreadBody,
} from "@/types/discussion.types";

const BASE_URL = (
    import.meta.env.VITE_BASE_URL ?? ""
).replace(/\/$/, "");

/** Same Firebase token contract as announcement-hooks / hooks.ts. */
function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("firebase-auth-token");
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

/**
 * Decode a routing-controllers / class-validator error payload into a
 * field-keyed map. The backend returns either
 *   { message, errors: [{ property, constraints, children }] }
 * or just `{ message }` for non-validation errors.
 */
function decodeErrorPayload(
    payload: unknown,
    status: number,
): DiscussionError {
    if (!payload || typeof payload !== "object") {
        return { kind: kindFromStatus(status), status, message: defaultMessageFor(status) };
    }

    const body = payload as {
        message?: unknown;
        errors?: unknown;
    };

    const message =
        typeof body.message === "string"
            ? body.message
            : defaultMessageFor(status);

    if (status === 400 && Array.isArray(body.errors)) {
        const fieldErrors: Record<string, string[]> = {};
        for (const entry of body.errors as ClassValidatorError[]) {
            collectFieldErrors(entry, "", fieldErrors);
        }
        return {
            kind: "validation",
            status,
            message,
            fieldErrors,
        };
    }

    return { kind: kindFromStatus(status), status, message };
}

function kindFromStatus(status: number): DiscussionErrorKind {
    if (status === 401) return "unauthenticated";
    if (status === 403) return "forbidden";
    if (status === 404) return "not_found";
    if (status >= 500) return "server";
    return "validation";
}

function defaultMessageFor(status: number): string {
    switch (status) {
        case 401:
            return "Your session has expired. Please sign in again.";
        case 403:
            return "You don't have permission to view or post in this discussion.";
        case 404:
            return "This discussion is no longer available.";
        case 0:
            return "Couldn't reach the server. Check your connection and try again.";
        default:
            return "Something went wrong while loading the discussion. Please try again.";
    }
}

/**
 * Recursively flatten nested class-validator `children` so a deeply nested
 * field ends up keyed by its full path (e.g. `body` not `children.0.body`).
 */
 interface ClassValidatorError {
    property?: string;
    constraints?: Record<string, string>;
    children?: ClassValidatorError[];
}

function collectFieldErrors(
    entry: ClassValidatorError,
    parentPath: string,
    out: Record<string, string[]>,
): void {
    const key = entry.property ?? "";
    const path = parentPath ? `${parentPath}.${key}` : key;

    if (entry.constraints) {
        out[path] = Object.values(entry.constraints);
    }

    if (Array.isArray(entry.children)) {
        for (const child of entry.children) {
            collectFieldErrors(child, path, out);
        }
    }
}

/** Common fetcher used by every hook below. */
async function request<T>(
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...init,
        credentials: "include",
        headers: {
            ...getAuthHeaders(),
            ...(init.headers ?? {}),
        },
    });

    if (res.status === 204) {
        return undefined as T;
    }

    const text = await res.text();
    const json = text ? safeJson(text) : null;

    if (!res.ok) {
        throw decodeErrorPayload(json, res.status);
    }

    return json as T;
}

function safeJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function toDiscussionError(err: unknown): DiscussionError {
    if (err && typeof err === "object" && "kind" in err) {
        return err as DiscussionError;
    }
    return {
        kind: "network",
        status: 0,
        message:
            err instanceof Error
                ? err.message
                : "Couldn't reach the server. Check your connection and try again.",
    };
}

// =============================================================================
// List threads for a course  →  GET /course/:courseId/discussions
// =============================================================================

export interface UseDiscussionThreadsResult {
    data: DiscussionThread[];
    isLoading: boolean;
    error: DiscussionError | null;
    refetch: () => Promise<void>;
}

/**
 * Fetches every thread on the course visible to the caller, in the order
 * the backend returns (pinned first, then newest first).
 */
export function useDiscussionThreads(
    courseId: string | undefined | null,
): UseDiscussionThreadsResult {
    const [data, setData] = useState<DiscussionThread[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(!!courseId);
    const [error, setError] = useState<DiscussionError | null>(null);

    const refetch = useCallback(async () => {
        if (!courseId) {
            setData([]);
            setError(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const result = await request<DiscussionThread[]>(
                `/course/${courseId}/discussions`,
                { method: "GET" },
            );
            setData(Array.isArray(result) ? result : []);
            setError(null);
        } catch (err) {
            setError(toDiscussionError(err));
            setData([]);
        } finally {
            setIsLoading(false);
        }
    }, [courseId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { data, isLoading, error, refetch };
}

// =============================================================================
// Get a single thread + replies  →  GET /discussions/:threadId
// =============================================================================

export interface UseDiscussionThreadResult {
    data: DiscussionThreadDetail | null;
    isLoading: boolean;
    error: DiscussionError | null;
    refetch: () => Promise<void>;
}

/**
 * Fetches a single thread together with its replies. The bundled shape is
 * intentional — it saves the client from a second roundtrip just to render
 * the thread page.
 */
export function useDiscussionThread(
    threadId: string | undefined | null,
): UseDiscussionThreadResult {
    const [data, setData] = useState<DiscussionThreadDetail | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(!!threadId);
    const [error, setError] = useState<DiscussionError | null>(null);

    const refetch = useCallback(async () => {
        if (!threadId) {
            setData(null);
            setError(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const result = await request<DiscussionThreadDetail>(
                `/discussions/${threadId}`,
                { method: "GET" },
            );
            setData(result);
            setError(null);
        } catch (err) {
            setError(toDiscussionError(err));
            setData(null);
        } finally {
            setIsLoading(false);
        }
    }, [threadId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { data, isLoading, error, refetch };
}

// =============================================================================
// Create a thread  →  POST /course/:courseId/discussions
// =============================================================================

export interface UseCreateDiscussionThreadResult {
    mutateAsync: (
        body: CreateDiscussionBody,
    ) => Promise<DiscussionThread>;
    isPending: boolean;
    error: DiscussionError | null;
}

/**
 * POST a new thread. On success returns the created thread (caller is
 * expected to navigate to its detail page). On 400 the returned
 * `DiscussionError` carries a `fieldErrors` map for inline display.
 */
export function useCreateDiscussionThread(
    courseId: string | undefined | null,
): UseCreateDiscussionThreadResult {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<DiscussionError | null>(null);

    const mutateAsync = useCallback(
        async (body: CreateDiscussionBody): Promise<DiscussionThread> => {
            if (!courseId) {
                const err: DiscussionError = {
                    kind: "validation",
                    message: "No course is currently selected.",
                };
                setError(err);
                throw err;
            }

            setIsPending(true);
            setError(null);
            try {
                const result = await request<DiscussionThread>(
                    `/course/${courseId}/discussions`,
                    {
                        method: "POST",
                        body: JSON.stringify(body),
                    },
                );
                return result;
            } catch (err) {
                const discussionErr = toDiscussionError(err);
                setError(discussionErr);
                throw discussionErr;
            } finally {
                setIsPending(false);
            }
        },
        [courseId],
    );

    return { mutateAsync, isPending, error };
}

// =============================================================================
// Create a reply  →  POST /discussions/:threadId/replies
// =============================================================================

export interface UseCreateDiscussionReplyResult {
    mutateAsync: (body: CreateReplyBody) => Promise<DiscussionReply>;
    isPending: boolean;
    error: DiscussionError | null;
}

/**
 * Post a reply to a thread. The hook returns the persisted reply so the
 * caller can append it to the local list (the parent page triggers a
 * refetch after success in the canonical flow, but the optimistic shape
 * is also valid).
 */
export function useCreateDiscussionReply(
    threadId: string | undefined | null,
): UseCreateDiscussionReplyResult {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<DiscussionError | null>(null);

    const mutateAsync = useCallback(
        async (body: CreateReplyBody): Promise<DiscussionReply> => {
            if (!threadId) {
                const err: DiscussionError = {
                    kind: "validation",
                    message: "No thread is currently selected.",
                };
                setError(err);
                throw err;
            }

            setIsPending(true);
            try {
                const result = await request<DiscussionReply>(
                    `/discussions/${threadId}/replies`,
                    {
                        method: "POST",
                        body: JSON.stringify(body),
                    },
                );
                setError(null);
                return result;
            } catch (err) {
                const discussionErr = toDiscussionError(err);
                setError(discussionErr);
                throw discussionErr;
            } finally {
                setIsPending(false);
            }
        },
        [threadId],
    );

    return { mutateAsync, isPending, error };
}

// =============================================================================
// Delete reply  →  DELETE /replies/:replyId
// =============================================================================

export interface UseDeleteDiscussionReplyResult {
    mutateAsync: (replyId: string) => Promise<void>;
    isPending: boolean;
    error: DiscussionError | null;
}

/**
 * Hard-delete a reply. The caller is responsible for confirming the
 * action in the UI — this hook does not show a confirmation dialog.
 */
export function useDeleteDiscussionReply(): UseDeleteDiscussionReplyResult {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<DiscussionError | null>(null);

    const mutateAsync = useCallback(async (replyId: string): Promise<void> => {
        setIsPending(true);
        try {
            await request<void>(`/replies/${replyId}`, {
                method: "DELETE",
            });
            setError(null);
        } catch (err) {
            const discussionErr = toDiscussionError(err);
            setError(discussionErr);
            throw discussionErr;
        } finally {
            setIsPending(false);
        }
    }, []);

    return { mutateAsync, isPending, error };
}

// =============================================================================
// Delete thread  →  DELETE /discussions/:threadId
// =============================================================================

export interface UseDeleteDiscussionThreadResult {
    mutateAsync: (threadId: string) => Promise<void>;
    isPending: boolean;
    error: DiscussionError | null;
}

/**
 * Hard-delete a thread (cascades to its replies). The caller is
 * responsible for confirming the action in the UI.
 */
export function useDeleteDiscussionThread(): UseDeleteDiscussionThreadResult {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<DiscussionError | null>(null);

    const mutateAsync = useCallback(async (threadId: string): Promise<void> => {
        setIsPending(true);
        try {
            await request<void>(`/discussions/${threadId}`, {
                method: "DELETE",
            });
            setError(null);
        } catch (err) {
            const discussionErr = toDiscussionError(err);
            setError(discussionErr);
            throw discussionErr;
        } finally {
            setIsPending(false);
        }
    }, []);

    return { mutateAsync, isPending, error };
}

// =============================================================================
// Edit thread  →  PATCH /discussions/:threadId
// =============================================================================

export interface UseUpdateDiscussionThreadResult {
    mutateAsync: (
        threadId: string,
        body: UpdateThreadBody,
    ) => Promise<DiscussionThread>;
    isPending: boolean;
    error: DiscussionError | null;
}

/**
 * Edit a thread's title and/or body. The backend enforces author-or-
 * teacher-track; the UI should only surface this control to the same
 * two groups.
 */
export function useUpdateDiscussionThread(): UseUpdateDiscussionThreadResult {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<DiscussionError | null>(null);

    const mutateAsync = useCallback(
        async (
            threadId: string,
            body: UpdateThreadBody,
        ): Promise<DiscussionThread> => {
            setIsPending(true);
            try {
                const result = await request<DiscussionThread>(
                    `/discussions/${threadId}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify(body),
                    },
                );
                setError(null);
                return result;
            } catch (err) {
                const discussionErr = toDiscussionError(err);
                setError(discussionErr);
                throw discussionErr;
            } finally {
                setIsPending(false);
            }
        },
        [],
    );

    return { mutateAsync, isPending, error };
}

// =============================================================================
// Pin / unpin thread  →  PATCH /discussions/:threadId/pin
// =============================================================================

export interface UsePinDiscussionThreadResult {
    pin: (threadId: string) => Promise<DiscussionThread>;
    unpin: (threadId: string) => Promise<DiscussionThread>;
    isPending: boolean;
    error: DiscussionError | null;
}

/**
 * Convenience accessors for the pin / unpin moderation action. The
 * backend exposes both via a single endpoint with `{pinned: boolean}`,
 * so the hooks bundle the two convenience methods that the UI calls.
 */
export function usePinDiscussionThread(): UsePinDiscussionThreadResult {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<DiscussionError | null>(null);

    const setPin = useCallback(
        async (
            threadId: string,
            body: PinThreadBody,
        ): Promise<DiscussionThread> => {
            setIsPending(true);
            try {
                const result = await request<DiscussionThread>(
                    `/discussions/${threadId}/pin`,
                    {
                        method: "PATCH",
                        body: JSON.stringify(body),
                    },
                );
                setError(null);
                return result;
            } catch (err) {
                const discussionErr = toDiscussionError(err);
                setError(discussionErr);
                throw discussionErr;
            } finally {
                setIsPending(false);
            }
        },
        [],
    );

    const pin = useCallback(
        (threadId: string) => setPin(threadId, {pinned: true}),
        [setPin],
    );
    const unpin = useCallback(
        (threadId: string) => setPin(threadId, {pinned: false}),
        [setPin],
    );

    return { pin, unpin, isPending, error };
}