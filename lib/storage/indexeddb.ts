import type { InstagramAnalysis } from "@/lib/instagram/types";
import {
  DEFAULT_CLEANUP_SETTINGS,
  type CleanupSettings,
  type ProfileMetadata,
} from "@/lib/rules/engine";

// Legacy unscoped database is left untouched as a recovery archive.
const LEGACY_DB_NAME = "followclean";
const DB_VERSION = 3;
let activeOwnerId: string | null = null;
let activeUsername: string | null = null;

export function setStorageAccount(ownerId: string, username: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(ownerId) ||
      !/^[a-zA-Z0-9._]{1,30}$/.test(username)) {
    throw new Error("Identidade do Instagram inválida; nenhuma leitura local foi permitida.");
  }
  activeOwnerId = ownerId;
  activeUsername = username.toLowerCase();
}

export function currentStorageOwner() {
  return activeOwnerId;
}

function scopedDatabaseName() {
  if (!activeOwnerId) throw new Error("Conecte uma conta do Instagram antes de acessar os dados.");
  return `followclean-account-${activeOwnerId}`;
}

export function exportBelongsToAccount(sourceFile: string, username: string) {
  const normalized = username.toLowerCase();
  // Only recognize explicit Instagram export names, never infer ownership from
  // follower overlap (people may follow the same profiles on both accounts).
  const match = /^instagram-([a-z0-9._]+)-\d{4}-\d{2}-\d{2}(?:-|\.|$)/i.exec(sourceFile);
  return Boolean(match && match[1].toLowerCase() === normalized);
}

export function exportNamesAnotherAccount(sourceFile: string, username: string) {
  const match = /^instagram-([a-z0-9._]+)-\d{4}-\d{2}-\d{2}(?:-|\.|$)/i.exec(sourceFile);
  return Boolean(match && match[1].toLowerCase() !== username.toLowerCase());
}
const ANALYSES_STORE = "analyses";
const PROTECTED_STORE = "protected_profiles";
const SETTINGS_STORE = "settings";
const PROFILE_METADATA_STORE = "profile_metadata";

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

function openDatabaseByName(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);

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

      if (!db.objectStoreNames.contains(PROFILE_METADATA_STORE)) {
        const store = db.createObjectStore(PROFILE_METADATA_STORE, {
          keyPath: "username",
        });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Falha ao abrir o armazenamento local."));
  });
}

function openDatabase() {
  return openDatabaseByName(scopedDatabaseName());
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Falha no armazenamento local."));
  });
}

// Migrate only when ALL legacy exports explicitly name the currently
// connected account. Never guess, delete, or mix legacy data across accounts.
export async function migrateLegacyForAccount() {
  if (!activeOwnerId || !activeUsername) throw new Error("Conta não conectada.");
  const scoped = await openDatabase();
  try {
    const destination = scoped.transaction(ANALYSES_STORE, "readonly");
    const existing = await requestToPromise(
      destination.objectStore(ANALYSES_STORE).getAll() as IDBRequest<StoredAnalysis[]>,
    );
    if (existing.length) return "existing" as const;
    const legacy = await openDatabaseByName(LEGACY_DB_NAME);
    try {
      const tx = legacy.transaction(
        [ANALYSES_STORE, PROTECTED_STORE, SETTINGS_STORE, PROFILE_METADATA_STORE],
        "readonly",
      );
      const analyses = await requestToPromise(
        tx.objectStore(ANALYSES_STORE).getAll() as IDBRequest<StoredAnalysis[]>,
      );
      if (!analyses.length) return "empty" as const;
      if (!analyses.every((record) => exportBelongsToAccount(record.sourceFile, activeUsername!))) {
        return "quarantined" as const;
      }
      const protectedRows = await requestToPromise(
        tx.objectStore(PROTECTED_STORE).getAll() as IDBRequest<ProtectedProfile[]>,
      );
      const settings = await requestToPromise(
        tx.objectStore(SETTINGS_STORE).get("cleanup") as IDBRequest<StoredCleanupSettings | undefined>,
      );
      const metadata = await requestToPromise(
        tx.objectStore(PROFILE_METADATA_STORE).getAll() as IDBRequest<ProfileMetadata[]>,
      );
      const relevant = new Set(analyses.flatMap((record) =>
        [...record.analysis.followers, ...record.analysis.following].map((value) => value.toLowerCase()),
      ));
      const write = scoped.transaction(
        [ANALYSES_STORE, PROTECTED_STORE, SETTINGS_STORE, PROFILE_METADATA_STORE],
        "readwrite",
      );
      for (const record of analyses) write.objectStore(ANALYSES_STORE).put(record);
      for (const row of protectedRows) {
        if (relevant.has(row.username.toLowerCase())) write.objectStore(PROTECTED_STORE).put(row);
      }
      if (settings) write.objectStore(SETTINGS_STORE).put(settings);
      for (const row of metadata) {
        if (relevant.has(row.username.toLowerCase())) write.objectStore(PROFILE_METADATA_STORE).put(row);
      }
      await new Promise<void>((resolve, reject) => {
        write.oncomplete = () => resolve();
        write.onerror = () => reject(write.error);
        write.onabort = () => reject(write.error);
      });
      return "migrated" as const;
    } finally {
      legacy.close();
    }
  } finally {
    scoped.close();
  }
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

export async function restoreAnalysisSnapshot(
  record: StoredAnalysis,
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(ANALYSES_STORE, "readwrite");
  await requestToPromise(tx.objectStore(ANALYSES_STORE).put(record));
  db.close();
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

export async function getProfileMetadata(): Promise<ProfileMetadata[]> {
  const db = await openDatabase();
  const tx = db.transaction(PROFILE_METADATA_STORE, "readonly");
  const records = await requestToPromise(
    tx.objectStore(PROFILE_METADATA_STORE).getAll() as IDBRequest<ProfileMetadata[]>,
  );
  db.close();
  return records;
}

export async function upsertProfileMetadata(
  input: Omit<ProfileMetadata, "username" | "updatedAt"> & {
    username: string;
    updatedAt?: string;
  },
): Promise<ProfileMetadata> {
  const username = normalizeUsername(input.username);
  if (!username) throw new Error("Informe um usuário válido.");

  const record: ProfileMetadata = {
    ...input,
    username,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };

  const db = await openDatabase();
  const tx = db.transaction(PROFILE_METADATA_STORE, "readwrite");
  await requestToPromise(tx.objectStore(PROFILE_METADATA_STORE).put(record));
  db.close();
  return record;
}

export async function upsertProfileMetadataBatch(
  records: Array<
    Omit<ProfileMetadata, "username" | "updatedAt"> & {
      username: string;
      updatedAt?: string;
    }
  >,
): Promise<void> {
  if (!records.length) return;
  const db = await openDatabase();
  const tx = db.transaction(PROFILE_METADATA_STORE, "readwrite");
  const store = tx.objectStore(PROFILE_METADATA_STORE);

  for (const item of records) {
    const username = normalizeUsername(item.username);
    if (!username) continue;
    store.put({
      ...item,
      username,
      updatedAt: item.updatedAt ?? new Date().toISOString(),
    } satisfies ProfileMetadata);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao salvar metadados."));
    tx.onabort = () => reject(tx.error ?? new Error("Operação cancelada."));
  });
  db.close();
}

export async function deleteProfileMetadata(usernameInput: string): Promise<void> {
  const username = normalizeUsername(usernameInput);
  if (!username) return;

  const db = await openDatabase();
  const tx = db.transaction(PROFILE_METADATA_STORE, "readwrite");
  await requestToPromise(tx.objectStore(PROFILE_METADATA_STORE).delete(username));
  db.close();
}

export async function getCleanupSettings(): Promise<CleanupSettings> {
  const db = await openDatabase();
  const tx = db.transaction(SETTINGS_STORE, "readonly");
  const record = await requestToPromise(
    tx.objectStore(SETTINGS_STORE).get("cleanup") as IDBRequest<
      Partial<StoredCleanupSettings> | undefined
    >,
  );
  db.close();

  return {
    notFollowingBack:
      typeof record?.notFollowingBack === "boolean"
        ? record.notFollowingBack
        : DEFAULT_CLEANUP_SETTINGS.notFollowingBack,
    maxFollowers:
      typeof record?.maxFollowers === "number"
        ? record.maxFollowers
        : DEFAULT_CLEANUP_SETTINGS.maxFollowers,
    reciprocityChecks:
      record?.reciprocityChecks && typeof record.reciprocityChecks === "object"
        ? record.reciprocityChecks
        : {},
  };
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
