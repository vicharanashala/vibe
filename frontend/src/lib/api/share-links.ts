import type {
  CreateShareLinksInput,
  QuickShareInput,
  QuickShareResult,
  OpenedShareLink,
  ShareLink,
  ShareLinkAnalytics,
  YouTubeValidation,
} from '@/types/share-link.types';

/**
 * Share-link endpoints.
 *
 * Hand-rolled rather than going through the typed `api` client, for the same
 * reason as lib/api/media.ts and lib/api/hp-system.ts: the OpenAPI generator is
 * a placeholder, so regenerating schema.ts would delete existing types.
 */
const BASE_URL = `${import.meta.env.VITE_BASE_URL}/share-links`;

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('firebase-auth-token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    let res: Response;
    try {
        res = await fetch(url, {
            ...options,
            headers: { ...getAuthHeaders(), ...(options?.headers || {}) },
            credentials: 'include',
        });
    } catch {
        // A failed fetch is the backend being unreachable, not a bad video —
        // saying so beats a generic "try again" that sends people hunting
        // through their YouTube link.
        throw new Error(
            `Could not reach the ViBe server at ${import.meta.env.VITE_BASE_URL}. Check that it is running.`,
        );
    }

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        // 404 here means the server is up but has no share-links endpoints —
        // it is running a build without the feature.
        const fallback =
            res.status === 404
                ? 'This ViBe server does not have the share-link feature yet.'
                : `Request failed (${res.status})`;
        const err: any = new Error(errData.message || fallback);
        err.status = res.status;
        err.data = errData;
        throw err;
    }
    return res.json();
}

/**
 * Checks a pasted YouTube URL before any link is generated.
 *
 * Never throws for an unplayable video — "cannot be embedded" is a normal
 * answer the instructor needs to see, not a request failure.
 */
export async function validateYouTubeUrl(url: string): Promise<YouTubeValidation> {
    return apiFetch<YouTubeValidation>(`${BASE_URL}/youtube/validate`, {
        method: 'POST',
        body: JSON.stringify({ url }),
    });
}

/** Mints one identity-bearing link per recipient. */
export async function createShareLinks(
    courseId: string,
    versionId: string,
    input: CreateShareLinksInput,
): Promise<ShareLink[]> {
    const res = await apiFetch<{ links: ShareLink[] }>(
        `${BASE_URL}/courses/${courseId}/versions/${versionId}`,
        { method: 'POST', body: JSON.stringify(input) },
    );
    return res.links;
}

/** Who the course was shared with, and what each of them watched. */
export async function getShareLinkAnalytics(
    courseId: string,
    versionId: string,
    cohortId?: string,
): Promise<ShareLinkAnalytics[]> {
    const query = cohortId ? `?cohortId=${encodeURIComponent(cohortId)}` : '';
    const res = await apiFetch<{ recipients: ShareLinkAnalytics[] }>(
        `${BASE_URL}/courses/${courseId}/versions/${versionId}${query}`,
    );
    return res.recipients;
}

/**
 * Shares a pasted video with no course involved. The backend rejects a video
 * it cannot embed, so an unplayable link never becomes share links.
 */
export async function quickShare(input: QuickShareInput): Promise<QuickShareResult> {
    return apiFetch<QuickShareResult>(`${BASE_URL}/quick`, {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

/** Every video this instructor has shared outside a course, and who watched. */
export async function getQuickShares(): Promise<ShareLinkAnalytics[]> {
    const res = await apiFetch<{ recipients: ShareLinkAnalytics[] }>(`${BASE_URL}/quick`);
    return res.recipients;
}

/** Closes a link. Watching already recorded against it is kept. */
export async function revokeShareLink(shareLinkId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`${BASE_URL}/${shareLinkId}/revoke`, {
        method: 'POST',
    });
}

/**
 * Opens a share link. Deliberately sends no auth header — the token in the URL
 * is the credential, and the recipient has no account to authenticate with.
 */
export async function openShareLink(token: string): Promise<OpenedShareLink> {
    const res = await fetch(`${BASE_URL}/open/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
            errData.message || 'This link is not valid, or it has expired.',
        );
    }
    return res.json();
}
