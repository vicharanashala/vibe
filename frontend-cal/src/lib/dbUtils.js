const DB_NAME = "ProctoringAppDB";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";

/**
 * Opens or initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>} The database instance.
 */
export const openDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("anomalyType", "anomalyType", { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Saves a snapshot to the database.
 * @param {Object} snapshotData - The snapshot details.
 * @param {string} snapshotData.image - The Base64-encoded snapshot.
 * @param {string} snapshotData.anomalyType - The type of anomaly.
 * @param {string} snapshotData.timestamp - The timestamp of the snapshot.
 * @returns {Promise<number>} The ID of the saved snapshot.
 */
export const saveSnapshot = async ({ image, anomalyType, timestamp }) => {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.add({
      image,
      anomalyType,
      timestamp,
    });

    request.onsuccess = () => resolve(request.result); // Returns the ID of the saved snapshot
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Retrieves all snapshots from the database.
 * @returns {Promise<Array>} An array of snapshot records.
 */
export const getSnapshots = async () => {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result); // Returns all snapshot records
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Deletes a snapshot by its ID.
 * @param {number} id - The ID of the snapshot to delete.
 * @returns {Promise<void>} Resolves when the snapshot is deleted.
 */
export const deleteSnapshot = async (id) => {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
};

/**
 * Clears all snapshots from the database.
 * @returns {Promise<void>} Resolves when all snapshots are deleted.
 */
export const clearSnapshots = async () => {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
};
