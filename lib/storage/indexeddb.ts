import type { InstagramAnalysis } from "@/lib/instagram/types";
import {
  DEFAULT_CLEANUP_SETTINGS,
  type CleanupSettings,
  type ProfileMetadata,
} from "@/lib/rules/engine";

const LEGACY_DB_NAME = "followclean";
const DB_VERSION = 3;
let activeAccountId: string | null = null;
let activeUsername: string | null = null;

export function setStorageAccount(accountId: string, username: string) {
  const normalizedUsername = username.trim().toLowerCase().replace(/^@/, "");
  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(accountId) ||
    !/^[a-z0-9._]{1,30}$/.test(normalizedUsername)
  ) {
    throw new Error("Não foi possível identificar a conta conectada.");
  }
  activeAccountId = accountId;
  activeUsername = normalizedUsername;
}

export function getStorageAccount() {
  return activeAccountId && activeUsername
    ? { id: activeAccountId, username: activeUsername }
    : null;
}

function databaseName() {
  if (!activeAccountId) {
    throw new Error("Conecte o Instagram antes de acessar os dados locais.");
  }
  return `followclean-account-${activeAccountId}`;
}

export function sourceFileAccount(sourceFile: string) {
  const match = /^instagram-([a-z0-9._]+)-\d{4}-\d{2}-\d{2}(?:-|\.|$)/i.exec(
    sourceFile.trim(),
  );
  return match?.[1]?.toLowerCase() ?? null;
}

export function sourceFileBelongsToAccount(sourceFile: string, username: string) {
  return sourceFileAccount(sourceFile) === username.trim().toLowerCase().replace(/^@/, "");
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

function openDatabaseByName(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION);

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

function openDatabase(): Promise<IDBDatabase> {
  return openDatabaseByName(databaseName());
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Falha no armazenamento local."));
  });
}

export async function migrateLegacyDataForActiveAccount(): Promise<
  "existing" | "empty" | "migrated" | "partial" | "not_owned"
> {
  const account = getStorageAccount();
  if (!account) throw new Error("Conecte o Instagram antes de migrar os dados.");

  const destination = await openDatabase();
  try {
    const existingTx = destination.transaction(ANALYSES_STORE, "readonly");
    const existing = await requestToPromise(
      existingTx.objectStore(ANALYSES_STORE).getAll() as IDBRequest<StoredAnalysis[]>,
    );
    if (existing.length) return "existing";

    const legacy = await openDatabaseByName(LEGACY_DB_NAME);
    try {
      const tx = legacy.transaction(
        [ANALYSES_STORE, PROTECTED_STORE, SETTINGS_STORE, PROFILE_METADATA_STORE],
        "readonly",
      );
      const [analyses, protectedProfiles, settings, metadata] = await Promise.all([
        requestToPromise(
          tx.objectStore(ANALYSES_STORE).getAll() as IDBRequest<StoredAnalysis[]>,
        ),
        requestToPromise(
          tx.objectStore(PROTECTED_STORE).getAll() as IDBRequest<ProtectedProfile[]>,
        ),
        requestToPromise(
          tx.objectStore(SETTINGS_STORE).get("cleanup") as IDBRequest<
            StoredCleanupSettings | undefined
          >,
        ),
        requestToPromise(
          tx.objectStore(PROFILE_METADATA_STORE).getAll() as IDBRequest<ProfileMetadata[]>,
        ),
      ]);

      if (!analyses.length) return "empty";

      const owned = analyses.filter((record) =>
        sourceFileBelongsToAccount(record.sourceFile, account.username),
      );
      if (!owned.length) return "not_owned";

      const everyAnalysisBelongsHere = owned.length === analyses.length;
      const write = destination.transaction(
        [ANALYSES_STORE, PROTECTED_STORE, SETTINGS_STORE, PROFILE_METADATA_STORE],
        "readwrite",
      );
      const analysisStore = write.objectStore(ANALYSES_STORE);
      for (const record of owned) analysisStore.put(record);

      // Settings, protections and follower counts did not carry an owner in the
      // old database. Copy them only when the complete old history is clearly
      // from this account. Otherwise keep them untouched in the legacy archive.
      if (everyAnalysisBelongsHere) {
        const protectedStore = write.objectStore(PROTECTED_STORE);
        for (const record of protectedProfiles) protectedStore.put(record);

        if (settings) write.objectStore(SETTINGS_STORE).put(settings);

        const metadataStore = write.objectStore(PROFILE_METADATA_STORE);
        for (const record of metadata) metadataStore.put(record);
      }

      await new Promise<void>((resolve, reject) => {
        write.oncomplete = () => resolve();
        write.onerror = () =>
          reject(write.error ?? new Error("Falha ao migrar dados locais."));
        write.onabort = () =>
          reject(write.error ?? new Error("Migração local cancelada."));
      });

      return everyAnalysisBelongsHere ? "migrated" : "partial";
    } finally {
      legacy.close();
    }
  } finally {
    destination.close();
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
