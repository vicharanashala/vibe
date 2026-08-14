// @ts-ignore
import PouchDB from 'pouchdb/dist/pouchdb.js';
import { getOfflineActiveMetrics, clearOfflineMetrics } from './indexedDB';

export interface SyncedActivityDoc {
  _id: string;
  _rev?: string;
  activityId: string;
  activityName: string;
  activityType: string;
  courseId: string;
  localActiveDate: string;
  timestamp: string;
  epoch: number;
}

// Instantiate local PouchDB database
const localDB = new PouchDB<SyncedActivityDoc>('vibe_offline_pouch');

/**
 * Queue an offline activity to local PouchDB so it can be synced later.
 */
export async function queueActivityInPouch(activity: {
  activityId: string;
  activityName: string;
  activityType: string;
  courseId: string;
  systemDate: string;
}): Promise<void> {
  const docId = `offline-log-${activity.activityId}-${Date.now()}`;
  const doc: SyncedActivityDoc = {
    _id: docId,
    activityId: activity.activityId,
    activityName: activity.activityName,
    activityType: activity.activityType,
    courseId: activity.courseId,
    localActiveDate: activity.systemDate,
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    epoch: Date.now()
  };

  try {
    await localDB.put(doc);
    console.log('[PouchDB] Saved offline log document in PouchDB:', docId);
  } catch (err) {
    console.error('[PouchDB] Failed to queue activity:', err);
  }
}

/**
 * Get all pending offline activities in PouchDB.
 */
export async function getPendingPouchDocs(): Promise<SyncedActivityDoc[]> {
  try {
    const result = await localDB.allDocs({ include_docs: true });
    return result.rows
      .map(row => row.doc)
      .filter((doc): doc is any => doc !== undefined) as SyncedActivityDoc[];
  } catch (err) {
    console.error('[PouchDB] Failed to fetch docs:', err);
    return [];
  }
}

/**
 * Clean up synced docs from PouchDB.
 */
export async function removeSyncedPouchDocs(docs: SyncedActivityDoc[]): Promise<void> {
  for (const doc of docs) {
    try {
      await localDB.remove(doc._id, doc._rev || '');
    } catch (err) {
      console.warn(`[PouchDB] Failed to delete synced doc ${doc._id}:`, err);
    }
  }
}

/**
 * Coordinate full synchronization of IndexedDB and PouchDB logs to the server.
 * This pushes local queues, updates server-side states, and triggers potential milestones.
 */
export async function syncOfflineDataToServer(
  currentStreak: number,
  lastActiveDate: string | null
): Promise<{
  success: boolean;
  syncedCount: number;
  updatedStreak: number;
  updatedLastActiveDate: string;
  newBadgesUnlocked: string[];
  karmaGained: number;
} | null> {
  try {
    // 1. Retrieve logs from PouchDB
    const pouchDocs = await getPendingPouchDocs();
    const indexedMetrics = await getOfflineActiveMetrics();

    if (pouchDocs.length === 0 && indexedMetrics.length === 0) {
      console.log('[SyncEngine] No offline logs to sync.');
      return null;
    }

    console.log(`[SyncEngine] Syncing ${pouchDocs.length} PouchDB docs and ${indexedMetrics.length} IndexedDB metrics to server...`);

    // 2. Push to the backend server API for synchronization
    const token = localStorage.getItem('vibe_auth_token') || 'temp_token';
    const response = await fetch('/api/pouch-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        currentStreak,
        lastActiveDate,
        pouchDocs,
        indexedMetrics
      })
    });

    if (!response.ok) {
      throw new Error(`Sync server returned status ${response.status}`);
    }

    const data = await response.json();

    // 3. Clean up local stores upon successful server validation
    await removeSyncedPouchDocs(pouchDocs);
    await clearOfflineMetrics();

    console.log('[SyncEngine] Local IndexedDB and PouchDB databases successfully synced & pruned.');

    return {
      success: true,
      syncedCount: pouchDocs.length,
      updatedStreak: data.currentStreakCount,
      updatedLastActiveDate: data.lastActiveDate,
      newBadgesUnlocked: data.newBadgesUnlocked || [],
      karmaGained: data.karmaGained || 0
    };
  } catch (err) {
    console.error('[SyncEngine] Synchronization process failed:', err);
    return {
      success: false,
      syncedCount: 0,
      updatedStreak: currentStreak,
      updatedLastActiveDate: lastActiveDate || '',
      newBadgesUnlocked: [],
      karmaGained: 0
    };
  }
}
