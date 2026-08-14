export interface OfflineMetric {
  id: string; // e.g., 'offline-action-timestamp' or activity UUID
  local_active_date: string; // YYYY-MM-DD
  temp_streak_count: number;
  timestamp: number; // epoch ms
  activityName: string;
  activityType: string;
  courseId: string;
}

const DB_NAME = 'ViBeOfflineDB';
const STORE_NAME = 'offline_metrics';

export function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        console.log(`[IndexedDB] Created object store: ${STORE_NAME}`);
      }
    };
  });
}

/**
 * Log an offline action completed by a student.
 * Saves the local timestamp, active date, and advances temporary streak.
 */
export async function logOfflineActiveDate(
  activityId: string,
  activityName: string,
  activityType: string,
  courseId: string,
  currentStreak: number,
  lastActiveDate: string | null,
  systemDate: string
): Promise<OfflineMetric> {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Calculate temp streak count based on offline rules
    let tempStreak = currentStreak;
    if (lastActiveDate !== systemDate) {
      // If we study offline today and haven't logged today yet:
      tempStreak = currentStreak + 1;
    }

    const metric: OfflineMetric = {
      id: `${activityId}-${Date.now()}`,
      local_active_date: systemDate,
      temp_streak_count: tempStreak,
      timestamp: Date.now(),
      activityName,
      activityType,
      courseId
    };

    const request = store.put(metric);

    request.onsuccess = () => {
      console.log('[IndexedDB] Logged offline active date object:', metric);
      resolve(metric);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Retrieve all logged offline active metrics.
 */
export async function getOfflineActiveMetrics(): Promise<OfflineMetric[]> {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Clear all logged offline active metrics (call this after successful sync).
 */
export async function clearOfflineMetrics(): Promise<void> {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      console.log('[IndexedDB] Cleared offline metrics store successfully.');
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
