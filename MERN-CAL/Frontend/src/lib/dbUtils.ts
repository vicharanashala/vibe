const DB_NAME = 'ProctoringAppDB'
const DB_VERSION = 1
const STORE_NAME = 'snapshots'

interface SnapshotData {
  id?: number // Optional because it is auto-generated
  image: string
  screenshot: string
  anomalyType: string
  timestamp: string
}

/**
 * Opens or initializes the IndexedDB database.
 * @returns A Promise resolving to the database instance.
 */
export const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('anomalyType', 'anomalyType', { unique: false })
      }
    }

    request.onsuccess = (event: Event) =>
      resolve((event.target as IDBOpenDBRequest).result)
    request.onerror = (event: Event) =>
      reject((event.target as IDBOpenDBRequest).error)
  })
}

/**
 * Saves a snapshot to the database.
 * @param snapshotData - The snapshot details.
 * @returns A Promise resolving to the ID of the saved snapshot.
 */
export const saveSnapshot = async (
  snapshotData: Omit<SnapshotData, 'id'>
): Promise<number> => {
  const db = await openDatabase()
  const transaction = db.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.add(snapshotData)

    request.onsuccess = () => resolve(request.result as number) // Returns the ID of the saved snapshot
    request.onerror = (event: Event) =>
      reject((event.target as IDBRequest).error)
  })
}

/**
 * Retrieves all snapshots from the database.
 * @returns A Promise resolving to an array of snapshot records.
 */
export const getSnapshots = async (): Promise<SnapshotData[]> => {
  const db = await openDatabase()
  const transaction = db.transaction(STORE_NAME, 'readonly')
  const store = transaction.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result as SnapshotData[]) // Returns all snapshot records
    request.onerror = (event: Event) =>
      reject((event.target as IDBRequest).error)
  })
}

/**
 * Deletes a snapshot by its ID.
 * @param id - The ID of the snapshot to delete.
 * @returns A Promise that resolves when the snapshot is deleted.
 */
export const deleteSnapshot = async (id: number): Promise<void> => {
  const db = await openDatabase()
  const transaction = db.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = (event: Event) =>
      reject((event.target as IDBRequest).error)
  })
}

/**
 * Clears all snapshots from the database.
 * @returns A Promise that resolves when all snapshots are deleted.
 */
export const clearSnapshots = async (): Promise<void> => {
  const db = await openDatabase()
  const transaction = db.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = (event: Event) =>
      reject((event.target as IDBRequest).error)
  })
}
