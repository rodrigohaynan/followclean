import type { InstagramAnalysis } from "@/lib/instagram/types";
import {
  DEFAULT_CLEANUP_SETTINGS,
  type CleanupSettings,
} from "@/lib/rules/engine";

const DB_NAME = "followclean";
const DB_VERSION = 2;
const ANALYSES_STORE = "analyses";
const PROTECTED_STORE = "protected_profiles";
const SETTINGS_STORE = "settings";

export type StoredAnalysis = {
  id: string;
  createdAt: string;
  sourceFile: string;
  analysis: InstagramAnalysis;
};

export type ProtectedProfile = {
  username: string;
  createdAt: string;
  reason?: string;
};

type StoredCleanupSettings = CleanupSettings & {
  id: "cleanup";
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(ANALYSES_STORE)) {
        const store = db.createObjectStore(ANALYSES_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(PROTECTED_STORE)) {
        db.createObjectStore(PROTECTED_STORE, { keyPath: "username" });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Falha ao abrir o armazenamento local."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Falha no armazenamento local."));
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

  const tx = db.transaction(ANALYSES_STORE, "readwrite");
  await requestToPromise(tx.objectStore(ANALYSES_STORE).put(record));
  db.close();
  return record;
}

export async function getAnalyses(): Promise<StoredAnalysis[]> {
  const db = await openDatabase();
  const tx = db.transaction(ANALYSES_STORE, "readonly");
  const records = await requestToPromise(
    tx.objectStore(ANALYSES_STORE).getAll() as IDBRequest<StoredAnalysis[]>,
  );
  db.close();
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteAnalysis(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(ANALYSES_STORE, "readwrite");
  await requestToPromise(tx.objectStore(ANALYSES_STORE).delete(id));
  db.close();
}

export async function clearAnalyses(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(ANALYSES_STORE, "readwrite");
  await requestToPromise(tx.objectStore(ANALYSES_STORE).clear());
  db.close();
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase().replace(/^@/, "");
}

export async function getProtectedProfiles(): Promise<ProtectedProfile[]> {
  const db = await openDatabase();
  const tx = db.transaction(PROTECTED_STORE, "readonly");
  const records = await requestToPromise(
    tx.objectStore(PROTECTED_STORE).getAll() as IDBRequest<ProtectedProfile[]>,
  );
  db.close();
  return records.sort((a, b) => a.username.localeCompare(b.username));
}

export async function protectProfile(
  username: string,
  reason?: string,
): Promise<ProtectedProfile> {
  const normalized = normalizeUsername(username);
  if (!normalized) throw new Error("Informe um usuário válido.");

  const db = await openDatabase();
  const record: ProtectedProfile = {
    username: normalized,
    createdAt: new Date().toISOString(),
    reason: reason?.trim() || undefined,
  };
  const tx = db.transaction(PROTECTED_STORE, "readwrite");
  await requestToPromise(tx.objectStore(PROTECTED_STORE).put(record));
  db.close();
  return record;
}

export async function unprotectProfile(username: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(PROTECTED_STORE, "readwrite");
  await requestToPromise(
    tx.objectStore(PROTECTED_STORE).delete(normalizeUsername(username)),
  );
  db.close();
}

export async function getCleanupSettings(): Promise<CleanupSettings> {
  const db = await openDatabase();
  const tx = db.transaction(SETTINGS_STORE, "readonly");
  const record = await requestToPromise(
    tx.objectStore(SETTINGS_STORE).get("cleanup") as IDBRequest<
      StoredCleanupSettings | undefined
    >,
  );
  db.close();

  return record
    ? { notFollowingBack: record.notFollowingBack }
    : DEFAULT_CLEANUP_SETTINGS;
}

export async function saveCleanupSettings(
  settings: CleanupSettings,
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(SETTINGS_STORE, "readwrite");
  const record: StoredCleanupSettings = { id: "cleanup", ...settings };
  await requestToPromise(tx.objectStore(SETTINGS_STORE).put(record));
  db.close();
}
