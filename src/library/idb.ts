/** Tiny promise wrapper around IndexedDB for the library (tracks + recordings). */

const DB_NAME = 'dj4you'
const DB_VERSION = 1
export const TRACKS = 'tracks'
export const RECORDINGS = 'recordings'
export type StoreName = typeof TRACKS | typeof RECORDINGS

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(TRACKS)) db.createObjectStore(TRACKS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(RECORDINGS)) db.createObjectStore(RECORDINGS, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  // Allow a retry after a failure (e.g. storage blocked in a private window).
  dbPromise.catch(() => (dbPromise = null))
  return dbPromise
}

function run<T>(store: StoreName, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const req = op(tx.objectStore(store))
        tx.oncomplete = () => resolve(req.result)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export const idb = {
  all: <T>(store: StoreName) => run<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
  get: <T>(store: StoreName, id: string) => run<T | undefined>(store, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>),
  put: <T>(store: StoreName, value: T) => run(store, 'readwrite', (s) => s.put(value)),
  delete: (store: StoreName, id: string) => run(store, 'readwrite', (s) => s.delete(id)),
}
