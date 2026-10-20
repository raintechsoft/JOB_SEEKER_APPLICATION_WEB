/**
 * MOCK FILE STORAGE. Resume files are kept as Blobs in IndexedDB, exactly as the prototype does
 * (`skillora-profile-files`). A real deployment uploads to the backend's object storage instead.
 */
const DB_NAME = "skillora-profile-files";

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest) {
  const connection = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = connection.transaction("files", mode);
      const req = action(tx.objectStore("files"));
      let result: T;
      req.onsuccess = () => (result = req.result as T);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    connection.close();
  }
}

export const putProfileFile = (id: string, blob: Blob) => run<void>("readwrite", (s) => s.put(blob, id));
export const getProfileFile = (id: string) => run<Blob | undefined>("readonly", (s) => s.get(id));
export const deleteProfileFile = (id: string) => run<void>("readwrite", (s) => s.delete(id));

export function clearProfileFiles() {
  return new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase(DB_NAME);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
    r.onblocked = () => resolve();
  });
}
