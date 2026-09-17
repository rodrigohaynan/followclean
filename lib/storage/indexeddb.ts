import type { InstagramAnalysis } from "@/lib/instagram/types";

const DB_NAME = "followclean";
const DB_VERSION = 1;
const STORE = "analyses";

export type StoredAnalysis = {
  id: string;
  createdAt: string;
  sourceFile: string;
  analysis: InstagramAnalysis;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir o armazenamento local."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha no armazenamento local."));
  });
}

export async function saveAnalysis(
  analysis: InstagramAnalysis,
  sourceFile: string,
): Promise<StoredAnalysis> {
  const db = await openDatabase();
  const record: StoredAnalysis = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    sourceFile,
    analysis,
  };

  const tx = db.transaction(STORE, "readwrite");
  await requestToPromise(tx.objectStore(STORE).put(record));
  db.close();
  return record;
}

export async function getAnalyses(): Promise<StoredAnalysis[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE, "readonly");
  const records = await requestToPromise(
    tx.objectStore(STORE).getAll() as IDBRequest<StoredAnalysis[]>,
  );
  db.close();
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteAnalysis(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE, "readwrite");
  await requestToPromise(tx.objectStore(STORE).delete(id));
  db.close();
}

export async function clearAnalyses(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE, "readwrite");
  await requestToPromise(tx.objectStore(STORE).clear());
  db.close();
}
