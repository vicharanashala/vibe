import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ShareLinkViewingMode } from '@/types/share-link.types';

interface ShareLinkSession {
  recipientName: string;
  viewingMode: ShareLinkViewingMode;
  courseId: string;
  courseVersionId: string;
}

interface ShareLinkState {
  session: ShareLinkSession | null;
  setSession: (session: ShareLinkSession) => void;
  clearSession: () => void;
  /**
   * True when the viewer arrived through a PLAIN share link for exactly this
   * course version — the player must not start proctoring for them.
   *
   * Scoped to the course on purpose: the session is persisted, so a plain
   * check would let a stale share session follow the browser into somebody's
   * genuine enrolled course and silently switch proctoring off there.
   */
  isPlainViewerFor: (courseId: string, courseVersionId: string) => boolean;
}

/**
 * The share-link session a guest viewer is watching under.
 *
 * Persisted because the guest has no account to re-derive it from: a refresh
 * mid-video would otherwise lose the viewing mode and silently hand them the
 * full proctored experience.
 */
export const useShareLinkStore = create<ShareLinkState>()(
  persist(
    (set, get) => ({
      session: null,
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
      isPlainViewerFor: (courseId, courseVersionId) => {
        const session = get().session;
        return (
          session?.viewingMode === 'PLAIN' &&
          session.courseId === courseId &&
          session.courseVersionId === courseVersionId
        );
      },
    }),
    {
      name: 'share-link-store',
      partialize: (state) => ({ session: state.session }),
    },
  ),
);
