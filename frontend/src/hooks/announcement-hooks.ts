import { useState, useEffect, useCallback } from 'react';
import { Announcement, CreateAnnouncementBody, UpdateAnnouncementBody, AnnouncementType } from '../types/announcement.types';
import { toast } from "sonner";

const BASE_URL = `${import.meta.env.VITE_BASE_URL}/announcements`;

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('firebase-auth-token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

// --- Response type from backend ---
interface AnnouncementListResponse {
    announcements: Announcement[];
    totalDocuments: number;
    totalPages: number;
    isAdmin?: boolean;
}

// --- Hooks ---

export function useAnnouncements(
    type?: AnnouncementType,
    courseId?: string,
    versionId?: string,
    studentMode: boolean = false,
    cohortId?: string,
) {
    const [data, setData] = useState<Announcement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalDocuments, setTotalDocuments] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isAdmin, setIsAdmin] = useState(false);

    const fetchAnnouncements = useCallback(async () => {
        setIsLoading(true);
        try {
            let url: string;

            if (studentMode) {
                // Student endpoint — backend filters by enrollment automatically
                url = `${BASE_URL}/student?limit=100`;
            } else {
                // Instructor endpoint — pass filters as query params
                const params = new URLSearchParams();
                params.set('limit', '100');
                if (type) params.set('type', type);
                if (courseId) params.set('courseId', courseId);
                if (versionId) params.set('courseVersionId', versionId);
                if (cohortId) params.set('cohortId', cohortId);
                url = `${BASE_URL}/instructor?${params.toString()}`;
            }

            const res = await fetch(url, {
                method: 'GET',
                headers: getAuthHeaders(),
                credentials: 'include',
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch announcements (${res.status})`);
            }

            const result: AnnouncementListResponse = await res.json();

            // Sort by date desc (backend already does this, but just in case)
            const sorted = result.announcements.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            setData(sorted);
            setTotalDocuments(result.totalDocuments);
            setTotalPages(result.totalPages);
            setIsAdmin(result.isAdmin || false);
            setError(null);
        } catch (err: any) {
            setError(err.message || "Failed to load announcements");
            console.error('useAnnouncements error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [type, courseId, versionId, studentMode, cohortId]);

    useEffect(() => {
        fetchAnnouncements();
    }, [fetchAnnouncements]);

    return { data, isLoading, error, totalDocuments, totalPages, isAdmin, refetch: fetchAnnouncements };
}

export function useCreateAnnouncement() {
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = async (body: CreateAnnouncementBody) => {
        setIsPending(true);
        try {
            const res = await fetch(`${BASE_URL}/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || `Failed to create announcement (${res.status})`);
            }

            toast.success("Announcement published successfully");
            // Dispatch event so any open AnnouncementList refetches
            window.dispatchEvent(new Event('refresh-announcements'));
        } catch (err: any) {
            toast.error(err.message || "Failed to create announcement");
            throw err;
        } finally {
            setIsPending(false);
        }
    };

    return { mutateAsync, isPending };
}

export function useUpdateAnnouncement() {
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = async (id: string, body: UpdateAnnouncementBody) => {
        setIsPending(true);
        try {
            const res = await fetch(`${BASE_URL}/${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || `Failed to update announcement (${res.status})`);
            }

            toast.success("Announcement updated successfully");
            window.dispatchEvent(new Event('refresh-announcements'));
        } catch (err: any) {
            toast.error(err.message || "Failed to update announcement");
            throw err;
        } finally {
            setIsPending(false);
        }
    };

    return { mutateAsync, isPending };
}

export function useDeleteAnnouncement() {
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = async (id: string) => {
        setIsPending(true);
        try {
            const res = await fetch(`${BASE_URL}/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                credentials: 'include',
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || `Failed to delete announcement (${res.status})`);
            }

            toast.success("Announcement deleted successfully");
            window.dispatchEvent(new Event('refresh-announcements'));
        } catch (err: any) {
            toast.error(err.message || "Failed to delete announcement");
            throw err;
        } finally {
            setIsPending(false);
        }
    };

    return { mutateAsync, isPending };
}

export function useToggleHideAnnouncement() {
    const [isPending, setIsPending] = useState(false);

    const mutateAsync = async (id: string) => {
        setIsPending(true);
        try {
            const res = await fetch(`${BASE_URL}/${id}/toggle-hide`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                credentials: 'include',
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || `Failed to toggle announcement visibility (${res.status})`);
            }

            const result = await res.json();
            toast.success(result.message || "Announcement visibility toggled");
            window.dispatchEvent(new Event('refresh-announcements'));
            return result.isHidden as boolean;
        } catch (err: any) {
            toast.error(err.message || "Failed to toggle announcement visibility");
            throw err;
        } finally {
            setIsPending(false);
        }
    };

    return { mutateAsync, isPending };
}
