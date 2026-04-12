import { useState, useEffect, useCallback } from 'react';
import { Announcement } from '../types/announcement.types';

const BASE_URL = `${import.meta.env.VITE_BASE_URL}/announcements`;
const STORAGE_KEY = 'announcements-last-seen';

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('firebase-auth-token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

/**
 * Hook to check if there are new announcements since the user last visited.
 * Uses localStorage to persist the "last seen" timestamp.
 */
export function useNewAnnouncementIndicator() {
    const [hasNew, setHasNew] = useState(false);

    const checkForNew = useCallback(async () => {
        try {
            const res = await fetch(`${BASE_URL}/student?limit=1`, {
                method: 'GET',
                headers: getAuthHeaders(),
                credentials: 'include',
            });

            if (!res.ok) return;

            const result = await res.json();
            const announcements: Announcement[] = result.announcements || [];

            if (announcements.length === 0) {
                setHasNew(false);
                return;
            }

            const latestDate = new Date(announcements[0].createdAt).getTime();
            const lastSeen = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);

            setHasNew(latestDate > lastSeen);
        } catch {
            // Silently ignore — indicator is non-critical
        }
    }, []);

    useEffect(() => {
        checkForNew();

        // Re-check when announcements are refreshed or window regains focus
        const handler = () => checkForNew();
        window.addEventListener('refresh-announcements', handler);
        window.addEventListener('focus', handler);

        return () => {
            window.removeEventListener('refresh-announcements', handler);
            window.removeEventListener('focus', handler);
        };
    }, [checkForNew]);

    /** Call this when the user navigates to the announcements page */
    const markSeen = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
        setHasNew(false);
    }, []);

    return { hasNew, markSeen };
}
