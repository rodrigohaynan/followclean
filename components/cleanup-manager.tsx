"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Camera as Instagram,
  CheckCircle2,
  ExternalLink,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserMinus,
  X,
} from "lucide-react";
import {
  buildCleanupQueue,
  DEFAULT_CLEANUP_SETTINGS,
  type CleanupSettings,
  type ProfileMetadata,
} from "@/lib/rules/engine";
import {
  decodeFollowCleanBackup,
  encodeFollowCleanBackup,
} from "@/lib/storage/backup";
import {
  getAnalyses,
  getCleanupSettings,
  getProfileMetadata,
  getProtectedProfiles,
  protectProfile,
  deleteProfileMetadata,
  restoreAnalysisSnapshot,
  saveCleanupSettings,
  unprotectProfile,
  upsertProfileMetadataBatch,
  type ProtectedProfile,
  type StoredAnalysis,
} from "@/lib/storage/indexeddb";

type Tab = "priority" | "review" | "above" | "protected" | "unavailable";
type InitialFilter = "all" | "special" | "0-9" | (typeof ALPHABET)[number];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as readonly string[];

type UnavailableProfile = {
  username: string;
  reason: string;
  updatedAt: string;
  source: "extension" | "android" | "import";
};

type CloudSummary = {
  total: number;
  pending: number;
  processing: number;
  verified: number;
  unavailable: number;
};

function sourceLabel(source: ProfileMetadata["dataSource"]) {
  if (source === "meta_business_discovery") return "Meta";
  if (source === "extension") return "Extensão";
  if (source === "android") return "Android";
  if (source === "manual") return "Manual";
  return "Pendente";
}

function matchesInitial(username: string, filter: InitialFilter) {
  if (filter === "all") return true;

  const first = username.trim().charAt(0).toUpperCase();
  if (filter === "special") return first === "_" || first === ".";
  if (filter === "0-9") return /^[0-9]$/.test(first);
  return first === filter;
}

function unavailableReasonLabel(reason: string) {
  if (reason === "deleted_username") {
    return "Registro __deleted__: conta removida/desativada no arquivo do Instagram";
  }
  if (reason === "timeout") {
    return "Perfil não abriu ou não pôde ser lido";
  }
  if (reason === "no_response" || reason === "unreadable") {
    return "Sem resposta utilizável no endereço do perfil";
  }
  return "Perfil indisponível, removido ou possivelmente bloqueou você";
}

export function CleanupManager() {
  const [latest, setLatest] = useState<StoredAnalysis | null>(null);
  const [protectedProfiles, setProtectedProfiles] = useState<ProtectedProfile[]>([]);
  const [profileMetadata, setProfileMetadata] = useState<ProfileMetadata[]>([]);
  const [settings, setSettings] = useState<CleanupSettings>(DEFAULT_CLEANUP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [newProtected, setNewProtected] = useState("");
  const [tab, setTab] = useState<Tab>("priority");
  const [initialFilter, setInitialFilter] = useState<InitialFilter>("all");
  const [extensionReady, setExtensionReady] = useState(false);
  const [androidReady, setAndroidReady] = useState(false);
  const [extensionNote, setExtensionNote] = useState("Aguardando integração...");
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchCurrent, setBatchCurrent] = useState<string | null>(null);
  const [batchProcessed, setBatchProcessed] = useState(0);
  const [extensionFailures, setExtensionFailures] = useState<UnavailableProfile[]>([]);
  const [cloudConfigured, setCloudConfigured] = useState(false);
  const [cloudToken, setCloudToken] = useState<string | null>(null);
  const [cloudNote, setCloudNote] = useState("Nuvem ainda não configurada.");
  const [cloudSummary, setCloudSummary] = useState<CloudSummary | null>(null);
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [reviewFlags, setReviewFlags] = useState<Record<string, string>>({});
  const [syncBusy, setSyncBusy] = useState(false);
  const [appSnapshotSavedAt, setAppSnapshotSavedAt] = useState<string | null>(null);
  const [appCloudPending, setAppCloudPending] = useState(false);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);
  const [restoreBackupOpen, setRestoreBackupOpen] = useState(false);
  const [restoreBackupInput, setRestoreBackupInput] = useState("");
  const [restoreBackupBusy, setRestoreBackupBusy] = useState(false);
  const [restoreBackupStatus, setRestoreBackupStatus] = useState("");

  async function applyCloudState(state: Record<string, unknown>) {
    const summary = state?.summary as Record<string, unknown> | undefined;
    if (summary) {
      setCloudSummary({
        total: Number(summary.total || 0),
        pending: Number(summary.pending || 0),
        processing: Number(summary.processing || 0),
        verified: Number(summary.verified || 0),
        unavailable: Number(summary.unavailable || 0),
      });
    }

    const snapshot = state?.snapshot as Record<string, unknown> | null | undefined;
    if (snapshot?.analysis && typeof snapshot.analysis === "object") {
      const createdAt =
        typeof snapshot.analysis_created_at === "string"
          ? snapshot.analysis_created_at
          : typeof snapshot.updated_at === "string"
            ? snapshot.updated_at
            : new Date().toISOString();

      const cloudRecord: StoredAnalysis = {
        id: "cloud-snapshot",
        createdAt,
        sourceFile:
          typeof snapshot.source_file === "string"
            ? snapshot.source_file
            : "Checkpoint em nuvem",
        analysis: snapshot.analysis as StoredAnalysis["analysis"],
      };

      setLatest((current) => {
        if (!current) return cloudRecord;
        return cloudRecord.createdAt > current.createdAt ? cloudRecord : current;
      });

      if (Array.isArray(snapshot.protected_profiles)) {
        const cloudProtected: ProtectedProfile[] =
          snapshot.protected_profiles.flatMap((item: unknown) => {
            if (!item || typeof item !== "object") return [];
            const row = item as Record<string, unknown>;
            if (typeof row.username !== "string") return [];
            return [{
              username: row.username.toLowerCase(),
              createdAt:
                typeof row.createdAt === "string"
                  ? row.createdAt
                  : new Date().toISOString(),
              reason: typeof row.reason === "string" ? row.reason : undefined,
            }];
          });

        setProtectedProfiles((current) => {
          const map = new Map(
            current.map((item) => [item.username, item] as const),
          );
          for (const item of cloudProtected) map.set(item.username, item);
          return Array.from(map.values()).sort((a, b) =>
            a.username.localeCompare(b.username),
          );
        });
      }

      if (snapshot.settings && typeof snapshot.settings === "object") {
        const rawSettings = snapshot.settings as Record<string, unknown>;
        setSettings((current) => ({
          notFollowingBack:
            typeof rawSettings.notFollowingBack === "boolean"
              ? rawSettings.notFollowingBack
              : current.notFollowingBack,
          maxFollowers:
            typeof rawSettings.maxFollowers === "number"
              ? Math.max(0, Math.round(rawSettings.maxFollowers))
              : current.maxFollowers,
        }));
      }
    }

    const rows = Array.isArray(state?.rows)
      ? (state.rows as Array<Record<string, unknown>>)
      : [];

    const verifiedRecords: ProfileMetadata[] = rows.flatMap((item) => {
      if (item.status !== "verified" || typeof item.username !== "string") {
        return [];
      }

      const followersCount = Number(item.followers_count);
      if (!Number.isFinite(followersCount)) return [];

      const rawSource =
        typeof item.data_source === "string" ? item.data_source : "extension";
      const dataSource: ProfileMetadata["dataSource"] =
        rawSource === "manual" ||
        rawSource === "android" ||
        rawSource === "meta_business_discovery"
          ? rawSource
          : "extension";

      return [{
        username: item.username.toLowerCase(),
        followersCount,
        parserVersion: Number(item.parser_version || 2),
        dataSource,
        updatedAt:
          typeof item.updated_at === "string"
            ? item.updated_at
            : new Date().toISOString(),
      }];
    });

    if (verifiedRecords.length) {
      await upsertProfileMetadataBatch(verifiedRecords);
      setProfileMetadata((current) => {
        const map = new Map(
          current.map((item) => [item.username, item] as const),
        );
        for (const item of verifiedRecords) map.set(item.username, item);
        return Array.from(map.values());
      });
    }

    const cloudFailures: UnavailableProfile[] = rows.flatMap((item) => {
      if (item.status !== "unavailable" || typeof item.username !== "string") {
        return [];
      }

      return [{
        username: item.username.toLowerCase(),
        reason:
          typeof item.failure_reason === "string"
            ? item.failure_reason
            : "unavailable",
        updatedAt:
          typeof item.updated_at === "string"
            ? item.updated_at
            : new Date().toISOString(),
        source: "extension" as const,
      }];
    });

    if (cloudFailures.length) {
      setExtensionFailures((current) => {
        const map = new Map(
          current.map((item) => [item.username, item] as const),
        );
        for (const item of cloudFailures) map.set(item.username, item);
        return Array.from(map.values());
      });
    }
  }

  useEffect(() => {
    Promise.all([getAnalyses(), getProtectedProfiles(), getCleanupSettings(), getProfileMetadata()])
      .then(([history, protectedList, storedSettings, metadata]) => {
        setLatest(history[0] ?? null);
        setProtectedProfiles(protectedList);
        setSettings(storedSettings);
        setProfileMetadata(metadata);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function mergeMetadata(records: ProfileMetadata[]) {
      setProfileMetadata((current) => {
        const map = new Map(current.map((item) => [item.username, item] as const));
        for (const item of records) map.set(item.username, item);
        return Array.from(map.values());
      });
    }

    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;

      const data = event.data as {
        source?: string;
        type?: string;
        total?: number;
        results?: Array<{
          username?: unknown;
          followersCount?: unknown;
          parserVersion?: unknown;
          updatedAt?: unknown;
        }>;
        failures?: Array<{
          username?: unknown;
          reason?: unknown;
          updatedAt?: unknown;
        }>;
        result?: {
          username?: unknown;
          followersCount?: unknown;
          parserVersion?: unknown;
          updatedAt?: unknown;
        };
        failure?: {
          username?: unknown;
          reason?: unknown;
          updatedAt?: unknown;
        };
        review?: {
          username?: unknown;
          reason?: unknown;
          updatedAt?: unknown;
        };
        batch?: {
          running?: unknown;
          currentUsername?: unknown;
          processedThisRun?: unknown;
          lastMessage?: unknown;
        } | null;
        snapshot?: unknown;
        value?: unknown;
        savedAt?: unknown;
        snapshotSavedAt?: unknown;
        cloudSyncPending?: unknown;
        lastCloudSyncAt?: unknown;
      };

      const fromExtension = data?.source === "followclean-extension";
      const fromAndroid = data?.source === "followclean-android";
      if (!fromExtension && !fromAndroid) return;

      if (data.type === "READY") {
        if (fromAndroid) {
          setAndroidReady(true);
          setExtensionNote("Aplicativo Android detectado e pronto.");
          const bridge = (window as Window & {
            FollowCleanAndroid?: { postMessage: (message: string) => void };
          }).FollowCleanAndroid;
          bridge?.postMessage(JSON.stringify({ type: "GET_RESULTS" }));
          bridge?.postMessage(JSON.stringify({ type: "GET_SNAPSHOT" }));
          if (typeof data.snapshotSavedAt === "string") {
            setAppSnapshotSavedAt(data.snapshotSavedAt);
          }
          if (typeof data.cloudSyncPending === "boolean") {
            setAppCloudPending(data.cloudSyncPending);
          }
          if (typeof data.lastCloudSyncAt === "string") {
            setLastCloudSyncAt(data.lastCloudSyncAt);
          }
        } else {
          setExtensionReady(true);
          setExtensionNote("Extensão detectada e pronta.");
          window.postMessage(
            { source: "followclean-web", type: "GET_RESULTS" },
            "*",
          );
        }
        return;
      }

      if (data.type === "SNAPSHOT_SAVED" && fromAndroid) {
        if (typeof data.savedAt === "string") {
          setAppSnapshotSavedAt(data.savedAt);
        }
        setAppCloudPending(true);
        setExtensionNote("Progresso salvo na memória do aplicativo.");
        return;
      }

      if (data.type === "CLOUD_SYNC_STATUS" && fromAndroid) {
        setAppCloudPending(Boolean(data.cloudSyncPending));
        if (typeof data.lastCloudSyncAt === "string") {
          setLastCloudSyncAt(data.lastCloudSyncAt);
        }
        return;
      }

      if (data.type === "BACKUP_CLIPBOARD" && fromAndroid) {
        if (typeof data.value !== "string" || !data.value.trim()) {
          setExtensionNote(
            "Nenhum backup encontrado na área de transferência. Você também pode colar o código manualmente no campo de restauração.",
          );
          setRestoreBackupOpen(true);
          return;
        }

        setRestoreBackupInput(data.value);
        setRestoreBackupOpen(true);
        setExtensionNote("Backup encontrado. Confira o código e toque em Restaurar agora.");
        return;
      }

      if (data.type === "APP_SNAPSHOT" && fromAndroid) {
        if (typeof data.savedAt === "string") {
          setAppSnapshotSavedAt(data.savedAt);
        }
        setAppCloudPending(Boolean(data.cloudSyncPending));
        if (typeof data.lastCloudSyncAt === "string") {
          setLastCloudSyncAt(data.lastCloudSyncAt);
        }

        if (data.snapshot && typeof data.snapshot === "object") {
          const snapshot = data.snapshot as Record<string, unknown>;

          if (snapshot.latest && typeof snapshot.latest === "object") {
            const record = snapshot.latest as StoredAnalysis;
            if (
              typeof record.id === "string" &&
              typeof record.createdAt === "string" &&
              typeof record.sourceFile === "string" &&
              record.analysis
            ) {
              setLatest((current) =>
                !current || record.createdAt > current.createdAt
                  ? record
                  : current,
              );
              void restoreAnalysisSnapshot(record);
            }
          }

          if (Array.isArray(snapshot.protectedProfiles)) {
            const items = snapshot.protectedProfiles.flatMap((item: unknown) => {
              if (!item || typeof item !== "object") return [];
              const row = item as Record<string, unknown>;
              if (typeof row.username !== "string") return [];
              return [{
                username: row.username.toLowerCase(),
                createdAt:
                  typeof row.createdAt === "string"
                    ? row.createdAt
                    : new Date().toISOString(),
                reason: typeof row.reason === "string" ? row.reason : undefined,
              } satisfies ProtectedProfile];
            });

            if (items.length) {
              setProtectedProfiles((current) => {
                const map = new Map(
                  current.map((item) => [item.username, item] as const),
                );
                for (const item of items) map.set(item.username, item);
                return Array.from(map.values()).sort((a, b) =>
                  a.username.localeCompare(b.username),
                );
              });
              void Promise.all(
                items.map((item) => protectProfile(item.username, item.reason)),
              );
            }
          }

          if (snapshot.settings && typeof snapshot.settings === "object") {
            const raw = snapshot.settings as Partial<CleanupSettings>;
            const restored: CleanupSettings = {
              notFollowingBack:
                typeof raw.notFollowingBack === "boolean"
                  ? raw.notFollowingBack
                  : DEFAULT_CLEANUP_SETTINGS.notFollowingBack,
              maxFollowers:
                typeof raw.maxFollowers === "number"
                  ? raw.maxFollowers
                  : DEFAULT_CLEANUP_SETTINGS.maxFollowers,
            };
            setSettings(restored);
            void saveCleanupSettings(restored);
          }

          const metadataRows: ProfileMetadata[] = [];

          if (Array.isArray(snapshot.profileMetadata)) {
            for (const item of snapshot.profileMetadata) {
              if (!item || typeof item !== "object") continue;
              const row = item as Record<string, unknown>;
              if (
                typeof row.username !== "string" ||
                typeof row.followersCount !== "number"
              ) {
                continue;
              }
              metadataRows.push({
                username: row.username.toLowerCase(),
                followersCount: row.followersCount,
                dataSource:
                  row.dataSource === "manual" ||
                  row.dataSource === "android" ||
                  row.dataSource === "meta_business_discovery"
                    ? row.dataSource
                    : "extension",
                parserVersion:
                  typeof row.parserVersion === "number"
                    ? row.parserVersion
                    : undefined,
                updatedAt:
                  typeof row.updatedAt === "string"
                    ? row.updatedAt
                    : new Date().toISOString(),
              });
            }
          }

          if (
            snapshot.nativeResults &&
            typeof snapshot.nativeResults === "object"
          ) {
            for (const value of Object.values(
              snapshot.nativeResults as Record<string, unknown>,
            )) {
              if (!value || typeof value !== "object") continue;
              const row = value as Record<string, unknown>;
              if (
                typeof row.username !== "string" ||
                typeof row.followersCount !== "number"
              ) {
                continue;
              }
              metadataRows.push({
                username: row.username.toLowerCase(),
                followersCount: row.followersCount,
                dataSource: "android",
                updatedAt:
                  typeof row.updatedAt === "string"
                    ? row.updatedAt
                    : new Date().toISOString(),
              });
            }
          }

          if (metadataRows.length) {
            void upsertProfileMetadataBatch(metadataRows);
            mergeMetadata(metadataRows);
          }

          const snapshotFailures: UnavailableProfile[] = [];
          const collectFailure = (value: unknown) => {
            if (!value || typeof value !== "object") return;
            const row = value as Record<string, unknown>;
            if (typeof row.username !== "string") return;
            snapshotFailures.push({
              username: row.username.toLowerCase(),
              reason:
                typeof row.reason === "string"
                  ? row.reason
                  : "unavailable",
              updatedAt:
                typeof row.updatedAt === "string"
                  ? row.updatedAt
                  : new Date().toISOString(),
              source: "android",
            });
          };

          if (Array.isArray(snapshot.failures)) {
            snapshot.failures.forEach(collectFailure);
          }
          if (
            snapshot.nativeFailures &&
            typeof snapshot.nativeFailures === "object"
          ) {
            Object.values(
              snapshot.nativeFailures as Record<string, unknown>,
            ).forEach(collectFailure);
          }

          if (snapshotFailures.length) {
            setExtensionFailures((current) => {
              const map = new Map(
                current.map((item) => [item.username, item] as const),
              );
              for (const item of snapshotFailures) {
                map.set(item.username, item);
              }
              return Array.from(map.values());
            });
          }
        }
        return;
      }

      if (data.type === "CLOUD_AUTH_SAVED") {
        setCloudNote(
          cloudConfigured
            ? "Checkpoint em nuvem vinculado à extensão."
            : "Extensão pronta para uso local."
        );
        return;
      }

      if (data.type === "PROFILE_RESULT" && fromAndroid && data.result) {
        const item = data.result;
        if (
          typeof item.username === "string" &&
          typeof item.followersCount === "number"
        ) {
          const record: ProfileMetadata = {
            username: item.username.trim().toLowerCase().replace(/^@/, ""),
            followersCount: item.followersCount,
            dataSource: "android",
            parserVersion:
              typeof item.parserVersion === "number"
                ? item.parserVersion
                : undefined,
            updatedAt:
              typeof item.updatedAt === "string"
                ? item.updatedAt
                : new Date().toISOString(),
          };

          // Atualiza a classificação imediatamente na tela.
          mergeMetadata([record]);
          setReviewFlags((current) => {
            const next = { ...current };
            delete next[record.username];
            return next;
          });
          setExtensionFailures((current) =>
            current.filter((failure) => failure.username !== record.username),
          );
          void upsertProfileMetadataBatch([record]);

          if (data.batch) {
            setBatchRunning(Boolean(data.batch.running));
            setBatchCurrent(
              typeof data.batch.currentUsername === "string"
                ? data.batch.currentUsername
                : null,
            );
            setBatchProcessed(
              typeof data.batch.processedThisRun === "number"
                ? data.batch.processedThisRun
                : 0,
            );
          }

          setExtensionNote(
            `@${record.username}: ${record.followersCount?.toLocaleString("pt-BR")} seguidores · classificação atualizada.`,
          );
        }
        return;
      }

      if (data.type === "PROFILE_UNAVAILABLE" && fromAndroid && data.failure) {
        const item = data.failure;
        if (typeof item.username === "string") {
          const failure: UnavailableProfile = {
            username: item.username.trim().toLowerCase().replace(/^@/, ""),
            reason:
              typeof item.reason === "string"
                ? item.reason
                : "unavailable",
            updatedAt:
              typeof item.updatedAt === "string"
                ? item.updatedAt
                : new Date().toISOString(),
            source: "android",
          };

          setExtensionFailures((current) => {
            const map = new Map(
              current.map((entry) => [entry.username, entry] as const),
            );
            map.set(failure.username, failure);
            return Array.from(map.values());
          });

          if (data.batch) {
            setBatchRunning(Boolean(data.batch.running));
            setBatchCurrent(
              typeof data.batch.currentUsername === "string"
                ? data.batch.currentUsername
                : null,
            );
            setBatchProcessed(
              typeof data.batch.processedThisRun === "number"
                ? data.batch.processedThisRun
                : 0,
            );
          }

          setExtensionNote(
            `@${failure.username}: não foi possível obter a contagem; movido para Indisponíveis.`,
          );
        }
        return;
      }

      if (data.type === "PROFILE_REVIEW" && fromAndroid && data.review) {
        const item = data.review;
        if (typeof item.username === "string") {
          const username = item.username.trim().toLowerCase().replace(/^@/, "");
          const reason =
            typeof item.reason === "string" ? item.reason : "unreadable";

          setExtensionFailures((current) =>
            current.filter((failure) => failure.username !== username),
          );
          setReviewFlags((current) => ({ ...current, [username]: reason }));
          setExtensionNote(
            `@${username}: leitura inconclusiva; mantido em Revisar.`,
          );
        }
        return;
      }

      if (data.type === "BATCH_STATUS" && data.batch) {
        setBatchRunning(Boolean(data.batch.running));
        setBatchCurrent(
          typeof data.batch.currentUsername === "string"
            ? data.batch.currentUsername
            : null,
        );
        setBatchProcessed(
          typeof data.batch.processedThisRun === "number"
            ? data.batch.processedThisRun
            : 0,
        );
        if (typeof data.batch.lastMessage === "string") {
          setExtensionNote(data.batch.lastMessage);
        }
        return;
      }

      if (data.type === "QUEUE_SAVED") {
        setExtensionNote(
          `Fila enviada para a extensão: ${Number(data.total ?? 0).toLocaleString("pt-BR")} perfis.`,
        );
        return;
      }

      if (data.type === "RESULTS") {
        if (Array.isArray(data.failures)) {
          const failures: UnavailableProfile[] = data.failures.flatMap((item) => {
            if (typeof item?.username !== "string") return [];
            return [{
              username: item.username.trim().toLowerCase().replace(/^@/, ""),
              reason: typeof item.reason === "string" ? item.reason : "unavailable",
              updatedAt:
                typeof item.updatedAt === "string"
                  ? item.updatedAt
                  : new Date().toISOString(),
              source: fromAndroid ? ("android" as const) : ("extension" as const),
            }];
          });
          setExtensionFailures((current) => {
            const map = new Map(current.map((item) => [item.username, item] as const));
            for (const item of failures) map.set(item.username, item);
            return Array.from(map.values());
          });
        }

        if (data.batch) {
          setBatchRunning(Boolean(data.batch.running));
          setBatchCurrent(
            typeof data.batch.currentUsername === "string"
              ? data.batch.currentUsername
              : null,
          );
          setBatchProcessed(
            typeof data.batch.processedThisRun === "number"
              ? data.batch.processedThisRun
              : 0,
          );
          if (typeof data.batch.lastMessage === "string") {
            setExtensionNote(data.batch.lastMessage);
          }
        }

        if (!Array.isArray(data.results)) return;

        const records: ProfileMetadata[] = data.results.flatMap((item) => {
          if (
            typeof item?.username !== "string" ||
            typeof item?.followersCount !== "number"
          ) {
            return [];
          }

          return [{
            username: item.username.trim().toLowerCase().replace(/^@/, ""),
            followersCount: item.followersCount,
            dataSource: fromAndroid ? ("android" as const) : ("extension" as const),
            parserVersion:
              typeof item.parserVersion === "number"
                ? item.parserVersion
                : fromAndroid
                  ? undefined
                  : 0,
            updatedAt:
              typeof item.updatedAt === "string"
                ? item.updatedAt
                : new Date().toISOString(),
          }];
        });

        if (!records.length) return;

        void upsertProfileMetadataBatch(records).then(() => {
          mergeMetadata(records);
          setExtensionNote(
            `${records.length.toLocaleString("pt-BR")} contagens sincronizadas ${fromAndroid ? "do Android" : "da extensão"}.`,
          );
        });
      }
    }

    window.addEventListener("message", handleMessage);
    window.postMessage({ source: "followclean-web", type: "PING" }, "*");

    const bridge = (window as Window & {
      FollowCleanAndroid?: { postMessage: (message: string) => void };
    }).FollowCleanAndroid;
    if (bridge?.postMessage) {
      setAndroidReady(true);
      setExtensionNote("Aplicativo Android detectado e pronto.");
      bridge.postMessage(JSON.stringify({ type: "PING" }));
      bridge.postMessage(JSON.stringify({ type: "GET_RESULTS" }));
      bridge.postMessage(JSON.stringify({ type: "GET_SNAPSHOT" }));
    }

    return () => window.removeEventListener("message", handleMessage);
  }, [cloudConfigured]);

  useEffect(() => {
    let cancelled = false;

    async function setupCloudSync() {
      try {
        const tokenResponse = await fetch("/api/cleanup/cloud/token", {
          cache: "no-store",
        });

        if (!tokenResponse.ok) {
          if (!cancelled) {
            setCloudConfigured(false);
            setCloudNote("Conecte o Instagram para ativar a continuidade entre dispositivos.");
          }
          return;
        }

        const tokenData = await tokenResponse.json();
        const configured = Boolean(tokenData?.configured);
        const token = typeof tokenData?.token === "string" ? tokenData.token : null;
        const accountUsername =
          typeof tokenData?.account?.username === "string"
            ? tokenData.account.username
            : null;

        if (cancelled) return;

        setCloudConfigured(configured);
        setCloudToken(token);
        setCloudNote(
          configured
            ? "Checkpoint em nuvem ativo. O progresso pode continuar em outro computador."
            : "Código de nuvem pronto; falta conectar o banco Neon.",
        );

        window.postMessage(
          {
            source: "followclean-web",
            type: "SET_CLOUD_AUTH",
            configured,
            token,
            accountUsername,
          },
          "*",
        );

        if (!configured) {
          setCloudHydrated(true);
          return;
        }

        const stateResponse = await fetch("/api/cleanup/cloud/state", {
          cache: "no-store",
        });
        if (!stateResponse.ok) {
          setCloudHydrated(true);
          return;
        }

        const state = await stateResponse.json();
        if (cancelled) return;

        await applyCloudState(state);
        setCloudHydrated(true);
      } catch {
        if (!cancelled) {
          setCloudHydrated(true);
          setCloudNote("Não foi possível sincronizar a nuvem agora. O modo local continua disponível.");
        }
      }
    }

    void setupCloudSync();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cloudConfigured || !cloudHydrated || loading || !latest) return;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await uploadLocalProgressToCloud();
        } catch {
          setCloudNote("O progresso local continua salvo, mas a sincronização em nuvem falhou temporariamente.");
        }
      })();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    cloudConfigured,
    cloudHydrated,
    loading,
    latest,
    profileMetadata,
    protectedProfiles,
    settings,
    extensionFailures,
  ]);

  useEffect(() => {
    if (!androidReady || !latest) return;

    const timer = window.setTimeout(() => {
      saveProgressToAppMemory();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    androidReady,
    latest,
    protectedProfiles,
    settings,
    profileMetadata,
    extensionFailures,
  ]);

  const protectedSet = useMemo(() => new Set(protectedProfiles.map((item) => item.username)), [protectedProfiles]);
  const queue = useMemo(() => latest ? buildCleanupQueue(latest.analysis, protectedSet, settings, profileMetadata) : [], [latest, protectedSet, settings, profileMetadata]);
  const deletedProfiles = useMemo<UnavailableProfile[]>(
    () =>
      latest
        ? latest.analysis.notFollowingBack
            .filter((username) => username.toLowerCase().startsWith("__deleted__"))
            .map((username) => ({
              username: username.toLowerCase(),
              reason: "deleted_username",
              updatedAt: latest.createdAt,
              source: "import" as const,
            }))
        : [],
    [latest],
  );
  const unavailable = useMemo(() => {
    const map = new Map<string, UnavailableProfile>();
    for (const item of deletedProfiles) map.set(item.username, item);
    for (const item of extensionFailures) map.set(item.username, item);
    return Array.from(map.values()).sort((a, b) => a.username.localeCompare(b.username));
  }, [deletedProfiles, extensionFailures]);
  const unavailableSet = useMemo(
    () => new Set(unavailable.map((item) => item.username)),
    [unavailable],
  );
  const priority = useMemo(
    () => queue.filter((item) => item.classification === "priority" && !unavailableSet.has(item.username.toLowerCase())),
    [queue, unavailableSet],
  );
  const review = useMemo(
    () => queue.filter((item) => item.classification === "review" && !unavailableSet.has(item.username.toLowerCase())),
    [queue, unavailableSet],
  );
  const aboveLimit = useMemo(
    () => queue.filter((item) => item.classification === "above_limit" && !unavailableSet.has(item.username.toLowerCase())),
    [queue, unavailableSet],
  );
  const normalizedQuery = query.trim().toLowerCase().replace(/^@/, "");
  const filteredPriority = useMemo(
    () => priority.filter((item) =>
      matchesInitial(item.username, initialFilter) &&
      (!normalizedQuery || item.username.includes(normalizedQuery))
    ),
    [priority, normalizedQuery, initialFilter],
  );
  const filteredReview = useMemo(
    () => review.filter((item) =>
      matchesInitial(item.username, initialFilter) &&
      (!normalizedQuery || item.username.includes(normalizedQuery))
    ),
    [review, normalizedQuery, initialFilter],
  );
  const filteredAboveLimit = useMemo(
    () => aboveLimit.filter((item) =>
      matchesInitial(item.username, initialFilter) &&
      (!normalizedQuery || item.username.includes(normalizedQuery))
    ),
    [aboveLimit, normalizedQuery, initialFilter],
  );
  const filteredProtected = useMemo(
    () => protectedProfiles.filter((item) =>
      matchesInitial(item.username, initialFilter) &&
      (!normalizedQuery || item.username.includes(normalizedQuery))
    ),
    [protectedProfiles, normalizedQuery, initialFilter],
  );
  const filteredUnavailable = useMemo(
    () => unavailable.filter((item) =>
      matchesInitial(item.username, initialFilter) &&
      (!normalizedQuery || item.username.includes(normalizedQuery))
    ),
    [unavailable, normalizedQuery, initialFilter],
  );

  const initialSource = useMemo(() => {
    if (tab === "priority") return priority.map((item) => item.username);
    if (tab === "review") return review.map((item) => item.username);
    if (tab === "above") return aboveLimit.map((item) => item.username);
    if (tab === "protected") return protectedProfiles.map((item) => item.username);
    return unavailable.map((item) => item.username);
  }, [tab, priority, review, aboveLimit, protectedProfiles, unavailable]);

  const availableInitials = useMemo(() => {
    const values = new Set<string>();
    for (const username of initialSource) {
      const first = username.trim().charAt(0).toUpperCase();
      if (first === "_" || first === ".") values.add("special");
      else if (/^[0-9]$/.test(first)) values.add("0-9");
      else if (/^[A-Z]$/.test(first)) values.add(first);
    }
    return values;
  }, [initialSource]);

  async function addProtected(username: string) {
    const record = await protectProfile(username);
    setProtectedProfiles((current) => [...current.filter((item) => item.username !== record.username), record].sort((a, b) => a.username.localeCompare(b.username)));
    setNewProtected("");
  }
  async function removeProtected(username: string) { await unprotectProfile(username); setProtectedProfiles((current) => current.filter((item) => item.username !== username)); }
  async function toggleRule() { const next = { ...settings, notFollowingBack: !settings.notFollowingBack }; setSettings(next); await saveCleanupSettings(next); }
  async function updateMaxFollowers(value: number) { const safeValue = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 2000; const next = { ...settings, maxFollowers: safeValue }; setSettings(next); await saveCleanupSettings(next); }

  function androidBridge() {
    return (window as Window & {
      FollowCleanAndroid?: { postMessage: (message: string) => void };
    }).FollowCleanAndroid;
  }

  function saveProgressToAppMemory() {
    if (!androidReady || !latest || !androidBridge()?.postMessage) {
      return false;
    }

    androidBridge()?.postMessage(
      JSON.stringify({
        type: "SAVE_SNAPSHOT",
        snapshot: {
          latest,
          protectedProfiles,
          settings,
          profileMetadata,
          failures: extensionFailures,
        },
      }),
    );
    return true;
  }

  async function copyPortableBackup() {
    if (!latest) {
      setExtensionNote("Não há progresso para copiar.");
      return;
    }

    const backup = encodeFollowCleanBackup({
      latest,
      protectedProfiles,
      settings,
      profileMetadata,
      failures: extensionFailures,
    });

    try {
      await navigator.clipboard.writeText(backup);
      setExtensionNote(
        "Backup de migração copiado. Guarde esse código antes de reinstalar o APK.",
      );
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = backup;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();

      setExtensionNote(
        copied
          ? "Backup de migração copiado. Guarde esse código antes de reinstalar o APK."
          : "Não foi possível copiar automaticamente o backup.",
      );
    }
  }

  async function restoreBackupValue(raw: string) {
    const value = raw.trim();
    if (!value) {
      const message = "Cole o código de backup antes de restaurar.";
      setExtensionNote(message);
      setRestoreBackupStatus(message);
      return;
    }

    setRestoreBackupBusy(true);
    setRestoreBackupStatus("Lendo e restaurando o backup...");
    try {
      const backup = decodeFollowCleanBackup(value);

      let restoredLatest: StoredAnalysis | null = null;
      let restoredProtected: ProtectedProfile[] = [];
      let restoredSettings = settings;
      let restoredMetadata: ProfileMetadata[] = [];
      let restoredFailures: UnavailableProfile[] = [];

      if (backup.latest && typeof backup.latest === "object") {
        const record = backup.latest as StoredAnalysis;
        if (
          typeof record.id === "string" &&
          typeof record.createdAt === "string" &&
          typeof record.sourceFile === "string" &&
          record.analysis
        ) {
          await restoreAnalysisSnapshot(record);
          restoredLatest = record;
          setLatest(record);
        }
      }

      if (Array.isArray(backup.protectedProfiles)) {
        for (const item of backup.protectedProfiles) {
          if (!item || typeof item !== "object") continue;
          const row = item as Record<string, unknown>;
          if (typeof row.username !== "string") continue;
          const restored = await protectProfile(
            row.username,
            typeof row.reason === "string" ? row.reason : undefined,
          );
          restoredProtected.push(restored);
        }
        restoredProtected = restoredProtected.sort((a, b) =>
          a.username.localeCompare(b.username),
        );
        setProtectedProfiles(restoredProtected);
      }

      if (backup.settings && typeof backup.settings === "object") {
        const rawSettings = backup.settings as Record<string, unknown>;
        restoredSettings = {
          notFollowingBack:
            typeof rawSettings.notFollowingBack === "boolean"
              ? rawSettings.notFollowingBack
              : DEFAULT_CLEANUP_SETTINGS.notFollowingBack,
          maxFollowers:
            typeof rawSettings.maxFollowers === "number"
              ? Math.max(0, Math.round(rawSettings.maxFollowers))
              : DEFAULT_CLEANUP_SETTINGS.maxFollowers,
        };
        await saveCleanupSettings(restoredSettings);
        setSettings(restoredSettings);
      }

      if (Array.isArray(backup.profileMetadata)) {
        restoredMetadata =
          backup.profileMetadata.flatMap((item: unknown) => {
            if (!item || typeof item !== "object") return [];
            const row = item as Record<string, unknown>;
            if (
              typeof row.username !== "string" ||
              typeof row.followersCount !== "number"
            ) {
              return [];
            }
            return [{
              username: row.username.toLowerCase(),
              followersCount: row.followersCount,
              accountType:
                typeof row.accountType === "string" ? row.accountType : undefined,
              dataSource:
                row.dataSource === "android" ||
                row.dataSource === "manual" ||
                row.dataSource === "meta_business_discovery"
                  ? row.dataSource
                  : "extension",
              updatedAt:
                typeof row.updatedAt === "string"
                  ? row.updatedAt
                  : new Date().toISOString(),
              parserVersion:
                typeof row.parserVersion === "number"
                  ? row.parserVersion
                  : undefined,
            } satisfies ProfileMetadata];
          });

        await upsertProfileMetadataBatch(restoredMetadata);
        setProfileMetadata(restoredMetadata);
      }

      if (Array.isArray(backup.failures)) {
        restoredFailures =
          backup.failures.flatMap((item: unknown) => {
            if (!item || typeof item !== "object") return [];
            const row = item as Record<string, unknown>;
            if (typeof row.username !== "string") return [];
            return [{
              username: row.username.toLowerCase(),
              reason:
                typeof row.reason === "string" ? row.reason : "unavailable",
              updatedAt:
                typeof row.updatedAt === "string"
                  ? row.updatedAt
                  : new Date().toISOString(),
              source:
                row.source === "import" || row.source === "extension"
                  ? row.source
                  : "android",
            } satisfies UnavailableProfile];
          });
        setExtensionFailures(restoredFailures);
      }

      // Salva imediatamente a cópia restaurada na memória nativa usando os
      // valores já restaurados, sem depender do próximo render do React.
      if (androidReady && restoredLatest && androidBridge()?.postMessage) {
        androidBridge()?.postMessage(
          JSON.stringify({
            type: "SAVE_SNAPSHOT",
            snapshot: {
              latest: restoredLatest,
              protectedProfiles: restoredProtected,
              settings: restoredSettings,
              profileMetadata: restoredMetadata,
              failures: restoredFailures,
            },
          }),
        );
      }

      const restoredMessage = restoredLatest
        ? `Backup restaurado com sucesso: ${restoredMetadata.length.toLocaleString("pt-BR")} perfis verificados, ${restoredFailures.length.toLocaleString("pt-BR")} indisponíveis e ${restoredProtected.length.toLocaleString("pt-BR")} protegidos recuperados.`
        : "O backup foi lido, mas não contém uma análise principal para restaurar.";

      setExtensionNote(restoredMessage);
      setRestoreBackupStatus(restoredMessage);

      if (restoredLatest) {
        window.setTimeout(() => {
          setRestoreBackupOpen(false);
          setRestoreBackupInput("");
          setRestoreBackupStatus("");
        }, 1400);
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? `Não foi possível restaurar: ${error.message}`
          : "Não foi possível restaurar: o código está incompleto ou não é um backup válido do FollowClean.";
      setExtensionNote(message);
      setRestoreBackupStatus(message);
    } finally {
      setRestoreBackupBusy(false);
    }
  }

  async function restorePortableBackup() {
    setRestoreBackupStatus("");
    setRestoreBackupOpen(true);
    setExtensionNote(
      "Cole o código FCBACKUP1: no campo de restauração. Você também pode tentar preencher pela área de transferência.",
    );
  }

  async function fillBackupFromClipboard() {
    if (androidReady && androidBridge()?.postMessage) {
      androidBridge()?.postMessage(
        JSON.stringify({ type: "READ_BACKUP_CLIPBOARD" }),
      );
      return;
    }

    try {
      const value = await navigator.clipboard.readText();
      if (!value.trim()) {
        setExtensionNote("A área de transferência está vazia.");
        return;
      }
      setRestoreBackupInput(value);
      setExtensionNote("Backup preenchido pela área de transferência.");
    } catch {
      setExtensionNote(
        "Não foi possível ler a área de transferência automaticamente. Cole o código manualmente.",
      );
    }
  }

  async function uploadLocalProgressToCloud() {
    if (!cloudConfigured) {
      setCloudNote("A nuvem ainda não está disponível nesta sessão.");
      return false;
    }
    if (!latest) {
      setCloudNote("Não há análise local neste dispositivo para enviar.");
      return false;
    }

    try {
      setCloudNote("Enviando o progresso deste dispositivo para a nuvem...");
      const response = await fetch("/api/cleanup/cloud/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis: latest.analysis,
          sourceFile: latest.sourceFile,
          analysisCreatedAt: latest.createdAt,
          protectedProfiles,
          settings,
          metadata: profileMetadata,
          failures: extensionFailures,
        }),
      });

      if (!response.ok) {
        setCloudNote("Não foi possível enviar o progresso local para a nuvem.");
        return false;
      }

      const payload = await response.json();
      if (payload?.summary) {
        setCloudSummary({
          total: Number(payload.summary.total || 0),
          pending: Number(payload.summary.pending || 0),
          processing: Number(payload.summary.processing || 0),
          verified: Number(payload.summary.verified || 0),
          unavailable: Number(payload.summary.unavailable || 0),
        });
      }

      setCloudNote(
        "Progresso deste dispositivo enviado para a nuvem com sucesso.",
      );
      if (androidReady && androidBridge()?.postMessage) {
        androidBridge()?.postMessage(JSON.stringify({ type: "CLOUD_SYNCED" }));
      }
      return true;
    } catch {
      setCloudNote("Falha temporária ao enviar o progresso para a nuvem.");
      return false;
    }
  }

  async function syncCloudState() {
    if (!cloudConfigured) return;

    try {
      const response = await fetch("/api/cleanup/cloud/state", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const state = await response.json();
      await applyCloudState(state);
      setCloudHydrated(true);
      setCloudNote("Checkpoint em nuvem atualizado neste dispositivo.");
    } catch {
      setCloudNote("Falha temporária ao buscar o checkpoint em nuvem.");
    }
  }

  function openProfile(username: string) {
    const normalized = username.trim().toLowerCase().replace(/^@/, "");
    if (!normalized) return;

    if (androidReady && androidBridge()?.postMessage) {
      androidBridge()?.postMessage(
        JSON.stringify({ type: "OPEN_PROFILE", username: normalized }),
      );
      return;
    }

    window.open(
      `https://www.instagram.com/${encodeURIComponent(normalized)}/`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function reviewProfile(username: string) {
    const normalized = username.trim().toLowerCase().replace(/^@/, "");
    if (!normalized) return;

    setExtensionFailures((current) =>
      current.filter((failure) => failure.username !== normalized),
    );
    setProfileMetadata((current) =>
      current.filter((item) => item.username !== normalized),
    );
    setReviewFlags((current) => ({
      ...current,
      [normalized]: "manual_review",
    }));

    await deleteProfileMetadata(normalized);

    if (cloudConfigured) {
      void fetch("/api/cleanup/cloud/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalized }),
      });
    }

    if (androidReady && androidBridge()?.postMessage) {
      androidBridge()?.postMessage(
        JSON.stringify({ type: "REVIEW_PROFILE", username: normalized }),
      );
      setExtensionNote(`@${normalized} enviado para nova verificação no APK.`);
    } else if (extensionReady) {
      window.postMessage(
        {
          source: "followclean-web",
          type: "SET_QUEUE_AND_START",
          usernames: [normalized],
        },
        "*",
      );
      setExtensionNote(`@${normalized} enviado para nova verificação na extensão.`);
    } else {
      setExtensionNote(
        `@${normalized} voltou para Revisar. Inicie a verificação quando houver integração disponível.`,
      );
    }

    setTab("review");
  }

  function sendQueueToExtension() {
    window.postMessage(
      {
        source: "followclean-web",
        type: "SET_QUEUE",
        usernames: review.map((item) => item.username),
      },
      "*",
    );
  }

  async function startAutomaticVerification() {
    const usernames = review.map((item) => item.username);

    if (!androidReady && cloudConfigured) {
      try {
        const response = await fetch("/api/cleanup/cloud/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usernames }),
        });

        if (!response.ok) {
          setExtensionNote("Não foi possível preparar a fila em nuvem. Tente sincronizar novamente.");
          return;
        }

        const payload = await response.json();
        if (payload?.summary) {
          setCloudSummary({
            total: Number(payload.summary.total || 0),
            pending: Number(payload.summary.pending || 0),
            processing: Number(payload.summary.processing || 0),
            verified: Number(payload.summary.verified || 0),
            unavailable: Number(payload.summary.unavailable || 0),
          });
        }

        window.postMessage(
          {
            source: "followclean-web",
            type: "SET_CLOUD_AUTH",
            configured: true,
            token: cloudToken,
          },
          "*",
        );
      } catch {
        setExtensionNote("Falha ao preparar o checkpoint em nuvem.");
        return;
      }
    }

    if (androidReady && androidBridge()?.postMessage) {
      androidBridge()?.postMessage(
        JSON.stringify({ type: "START_BATCH", usernames }),
      );
    } else {
      window.postMessage(
        {
          source: "followclean-web",
          type: "SET_QUEUE_AND_START",
          usernames,
        },
        "*",
      );
    }
    setExtensionNote(
      cloudConfigured
        ? "Iniciando verificação contínua com checkpoint em nuvem..."
        : "Iniciando verificação contínua neste navegador...",
    );
  }

  function pauseAutomaticVerification() {
    if (androidReady && androidBridge()?.postMessage) {
      androidBridge()?.postMessage(JSON.stringify({ type: "PAUSE_BATCH" }));
    } else {
      window.postMessage(
        { source: "followclean-web", type: "PAUSE_BATCH" },
        "*",
      );
    }
  }

  async function syncExtensionResults() {
    if (syncBusy) return;
    setSyncBusy(true);
    setExtensionNote("Sincronizando progresso...");

    try {
      if (androidReady && androidBridge()?.postMessage) {
        saveProgressToAppMemory();
        androidBridge()?.postMessage(JSON.stringify({ type: "GET_RESULTS" }));
        setExtensionNote("Progresso salvo no aplicativo. Sincronizando com a nuvem...");
      } else {
        window.postMessage(
          { source: "followclean-web", type: "GET_RESULTS" },
          "*",
        );
      }

      if (cloudConfigured) {
        const uploaded = await uploadLocalProgressToCloud();
        if (uploaded) {
          await syncCloudState();
          setExtensionNote(
            androidReady
              ? "Sincronização concluída: aplicativo e nuvem atualizados."
              : "Sincronização concluída com a nuvem.",
          );
        } else if (androidReady) {
          setExtensionNote(
            "Progresso salvo no aplicativo. A sincronização com a nuvem ficou pendente.",
          );
        }
      } else if (androidReady) {
        setExtensionNote(
          "Progresso salvo no aplicativo. A nuvem não está disponível nesta sessão.",
        );
      } else {
        setExtensionNote("Resultados locais atualizados.");
      }
    } finally {
      setSyncBusy(false);
    }
  }

  async function saveManualFollowers(username: string) {
    const current = profileMetadata.find((item) => item.username === username);
    const raw = window.prompt(
      `Quantos seguidores @${username} possui?`,
      typeof current?.followersCount === "number"
        ? String(current.followersCount)
        : "",
    );
    if (raw === null) return;

    const digits = raw.replace(/\D/g, "");
    const followersCount = Number(digits);
    if (!digits || !Number.isFinite(followersCount)) return;

    const record: ProfileMetadata = {
      username,
      followersCount,
      dataSource: "manual",
      updatedAt: new Date().toISOString(),
    };

    await upsertProfileMetadataBatch([record]);
    setProfileMetadata((items) => [
      ...items.filter((item) => item.username !== username),
      record,
    ]);
  }

  const restoreBackupDialog = restoreBackupOpen ? (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-3 sm:items-center sm:p-6">
      <div className="w-full max-w-2xl rounded-[1.75rem] bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-950">Restaurar backup</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Cole abaixo o código completo que começa com FCBACKUP1:. O campo aceita backups grandes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRestoreBackupOpen(false)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <textarea
          value={restoreBackupInput}
          onChange={(event) => setRestoreBackupInput(event.target.value)}
          placeholder="FCBACKUP1:..."
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="mt-4 h-48 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
        />

        {restoreBackupStatus ? (
          <div className={`mt-3 rounded-xl border px-3 py-2 text-sm font-bold leading-5 ${
            restoreBackupStatus.startsWith("Backup restaurado")
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : restoreBackupStatus.startsWith("Lendo")
                ? "border-blue-200 bg-blue-50 text-blue-800"
                : "border-red-200 bg-red-50 text-red-800"
          }`}>
            {restoreBackupStatus}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void fillBackupFromClipboard()}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700"
          >
            Preencher da área de transferência
          </button>
          <button
            type="button"
            disabled={restoreBackupBusy || !restoreBackupInput.trim()}
            onClick={() => {
              setRestoreBackupStatus("Lendo e restaurando o backup...");
              void restoreBackupValue(restoreBackupInput);
            }}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {restoreBackupBusy ? "Restaurando..." : "Restaurar agora"}
          </button>
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-400">
          Não desinstale o aplicativo nem apague dados enquanto a restauração estiver em andamento.
        </p>
      </div>
    </div>
  ) : null;

  if (loading) return <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">Carregando regras locais...</div>;
  if (!latest) return <><div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm"><UserMinus className="mx-auto text-slate-300" size={42} /><h2 className="mt-4 text-xl font-black text-slate-950">Restaurar progresso ou importar dados</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{extensionNote}</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => void restorePortableBackup()} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Restaurar backup</button><Link href="/importar" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">Importar dados do Instagram</Link></div><p className="mx-auto mt-4 max-w-xl text-xs leading-5 text-slate-400">O botão Restaurar backup abre um campo grande para você colar manualmente o código completo.</p></div>{restoreBackupDialog}</>;

  const activeList =
    tab === "priority"
      ? filteredPriority
      : tab === "review"
        ? filteredReview
        : tab === "above"
          ? filteredAboveLimit
          : [];

  return (
    <>
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 shadow-sm"><p className="text-sm font-semibold text-red-700">Prioridade</p><p className="mt-2 text-3xl font-black text-red-950">{priority.length.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-red-600/70">Não segue + até {settings.maxFollowers.toLocaleString("pt-BR")} seguidores</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm"><p className="text-sm font-semibold text-amber-700">Revisar</p><p className="mt-2 text-3xl font-black text-amber-950">{review.length.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-amber-700/70">Contagem ainda desconhecida</p></div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm"><p className="text-sm font-semibold text-blue-700">Acima do limite</p><p className="mt-2 text-3xl font-black text-blue-950">{aboveLimit.length.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-blue-700/70">Não segue + mais de {settings.maxFollowers.toLocaleString("pt-BR")}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Protegidos</p><p className="mt-2 text-3xl font-black text-slate-950">{protectedProfiles.length.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-slate-400">Nunca entram na fila</p></div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5 shadow-sm"><p className="text-sm font-semibold text-violet-700">Indisponíveis</p><p className="mt-2 text-3xl font-black text-violet-950">{unavailable.length.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-violet-700/70">Removidos da fila principal</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Não seguem você</p><p className="mt-2 text-3xl font-black text-slate-950">{latest.analysis.totals.notFollowingBack.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-slate-400">No snapshot mais recente</p></div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl"><div className="flex items-center gap-2 text-sm font-black text-slate-950"><SlidersHorizontal size={18} className="text-blue-600" /> Regra principal</div><h2 className="mt-2 text-xl font-black text-slate-950">Não segue de volta + poucos seguidores → prioridade</h2><p className="mt-2 text-sm leading-6 text-slate-500">Perfis protegidos são excluídos. Perfis acima do limite também ficam fora da fila prioritária.</p></div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-500">Máximo de seguidores</span><input type="number" min={0} step={100} value={settings.maxFollowers} onChange={(event) => setSettings((current) => ({ ...current, maxFollowers: Number(event.target.value) }))} onBlur={(event) => updateMaxFollowers(Number(event.target.value))} className="w-40 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:border-blue-400 focus:bg-white" /></label>
            <button type="button" onClick={toggleRule} className={`inline-flex min-w-36 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${settings.notFollowingBack ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}><CheckCircle2 size={17} /> {settings.notFollowingBack ? "Ativada" : "Desativada"}</button>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 sm:flex-row sm:items-center sm:justify-between"><span>A regra já entende a contagem de seguidores. A conexão oficial da Meta valida sua conta; a extensão assistida enriquece os perfis da fila.</span><Link href="/conectar" className="inline-flex shrink-0 items-center gap-2 font-black text-blue-700"><Instagram size={16} /> Instagram conectado</Link></div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className={`rounded-2xl border p-4 text-sm ${extensionReady || androidReady ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
            <div className="font-black">{androidReady ? "FollowClean Android · scanner nativo" : "FollowClean Assist · navegador"}</div>
            <p className="mt-1 leading-6">{extensionNote}</p>
            {batchRunning ? <p className="mt-1 text-xs font-black text-emerald-800">Execução contínua · {batchProcessed.toLocaleString("pt-BR")} perfis nesta sessão {batchCurrent ? `· @${batchCurrent}` : ""}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={(!extensionReady && !androidReady) || review.length === 0 || batchRunning} onClick={startAutomaticVerification} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Iniciar verificação contínua</button>
              <button type="button" disabled={(!extensionReady && !androidReady) || !batchRunning} onClick={pauseAutomaticVerification} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 disabled:cursor-not-allowed disabled:opacity-40">Pausar</button>
              {!androidReady ? <button type="button" disabled={!extensionReady || review.length === 0} onClick={sendQueueToExtension} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Só enviar fila</button> : null}
              <button type="button" disabled={syncBusy || (!extensionReady && !androidReady)} onClick={() => void syncExtensionResults()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">{syncBusy ? "Sincronizando..." : "Sincronizar"}</button>
              {!androidReady ? <Link href="/extensao" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700">Instalar extensão</Link> : null}
            </div>
          </div>
          <div className={`rounded-2xl border p-4 text-sm ${androidReady ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
            <div className="font-black">{androidReady ? "APK ativo" : "Modo celular no navegador"}</div>
            <p className="mt-1 leading-6">{androidReady ? "O APK pode visitar os perfis da fila em uma WebView isolada, ler a contagem pública e devolver os resultados automaticamente ao FollowClean." : "No Chrome Android comum, a automação não pode ler outras páginas. Use o APK do FollowClean ou informe a contagem manualmente."}</p>
            {androidReady && appSnapshotSavedAt ? (
              <p className="mt-2 text-xs font-black text-emerald-800">
                Salvo no app: {new Date(appSnapshotSavedAt).toLocaleString("pt-BR")}
                {appCloudPending ? " · nuvem pendente" : ""}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyPortableBackup()}
                disabled={!latest}
                className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Copiar backup
              </button>
              <button
                type="button"
                onClick={() => void restorePortableBackup()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700"
              >
                Restaurar backup
              </button>
            </div>
          </div>
          <div className={`rounded-2xl border p-4 text-sm ${cloudConfigured ? "border-blue-200 bg-blue-50 text-blue-950" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
            <div className="font-black">{cloudConfigured ? "Checkpoint em nuvem ativo" : "Checkpoint em nuvem"}</div>
            <p className="mt-1 leading-6">{cloudNote}</p>
            {cloudSummary ? <p className="mt-2 text-xs font-black">Pendentes: {cloudSummary.pending.toLocaleString("pt-BR")} · Verificados: {cloudSummary.verified.toLocaleString("pt-BR")} · Indisponíveis: {cloudSummary.unavailable.toLocaleString("pt-BR")}</p> : null}
            {lastCloudSyncAt ? <p className="mt-1 text-xs font-bold text-blue-700">Última sincronização: {new Date(lastCloudSyncAt).toLocaleString("pt-BR")}</p> : null}
            {cloudConfigured ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void uploadLocalProgressToCloud()}
                  disabled={!latest}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Enviar progresso deste dispositivo
                </button>
                <button
                  type="button"
                  onClick={() => void syncCloudState()}
                  className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-800"
                >
                  Buscar progresso da nuvem
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2 font-black text-slate-950"><ShieldCheck size={19} className="text-emerald-600" /> Lista protegida</div><p className="mt-1 text-sm text-slate-500">Adicione família, amigos, clientes, parceiros ou qualquer conta estratégica.</p></div><form className="flex w-full gap-2 lg:max-w-md" onSubmit={(event) => { event.preventDefault(); if (newProtected.trim()) addProtected(newProtected); }}><input value={newProtected} onChange={(event) => setNewProtected(event.target.value)} placeholder="@usuario" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white" /><button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} /> Proteger</button></form></div></section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setTab("priority")} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "priority" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"}`}>Prioridade ({priority.length.toLocaleString("pt-BR")})</button>
              <button type="button" onClick={() => setTab("review")} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "review" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"}`}>Revisar ({review.length.toLocaleString("pt-BR")})</button>
              <button type="button" onClick={() => setTab("above")} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "above" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>Acima do limite ({aboveLimit.length.toLocaleString("pt-BR")})</button>
              <button type="button" onClick={() => setTab("protected")} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "protected" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>Protegidos ({protectedProfiles.length.toLocaleString("pt-BR")})</button>
              <button type="button" onClick={() => setTab("unavailable")} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "unavailable" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"}`}>Indisponíveis ({unavailable.length.toLocaleString("pt-BR")})</button>
            </div>
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar @usuario" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white" />
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Ir para inicial</p>
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-1.5">
                <button
                  type="button"
                  onClick={() => setInitialFilter("all")}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition ${initialFilter === "all" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setInitialFilter("special")}
                  disabled={!availableInitials.has("special")}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-30 ${initialFilter === "special" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  title="Usuários iniciados por _ ou ."
                >
                  _.
                </button>
                <button
                  type="button"
                  onClick={() => setInitialFilter("0-9")}
                  disabled={!availableInitials.has("0-9")}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-30 ${initialFilter === "0-9" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  0–9
                </button>
                {ALPHABET.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setInitialFilter(letter as InitialFilter)}
                    disabled={!availableInitials.has(letter)}
                    className={`min-w-9 rounded-lg px-2.5 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-30 ${initialFilter === letter ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {tab === "protected" ? <div className="max-h-[38rem] divide-y divide-slate-100 overflow-auto">{filteredProtected.map((item) => <div key={item.username} className="flex items-center justify-between gap-4 px-6 py-4"><div className="min-w-0"><p className="truncate font-black text-slate-900">@{item.username}</p><p className="mt-1 text-xs text-slate-500">Protegido neste dispositivo</p></div><button type="button" onClick={() => removeProtected(item.username)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><X size={14} /> Remover proteção</button></div>)}{!filteredProtected.length ? <div className="p-8 text-center text-sm text-slate-500">Nenhum perfil protegido.</div> : null}</div> : tab === "unavailable" ? <div className="max-h-[38rem] divide-y divide-slate-100 overflow-auto">{filteredUnavailable.slice(0, 1000).map((item) => <div key={item.username} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-black text-slate-900">@{item.username}</p><p className="mt-1 text-xs text-slate-500">{unavailableReasonLabel(item.reason)} · Fonte: {item.source === "import" ? "arquivo do Instagram" : item.source === "android" ? "APK Android" : "verificação automática"}</p></div>{!item.username.startsWith("__deleted__") ? <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => openProfile(item.username)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><ExternalLink size={14} /> Testar perfil</button><button type="button" onClick={() => void reviewProfile(item.username)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Revisar novamente</button></div> : null}</div>)}{!filteredUnavailable.length ? <div className="p-8 text-center text-sm text-slate-500">Nenhum perfil indisponível identificado.</div> : null}</div> : <div className="max-h-[38rem] divide-y divide-slate-100 overflow-auto">{activeList.slice(0, 1000).map((item) => <div key={item.username} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-black text-slate-900">@{item.username}</p>{typeof item.followersCount === "number" ? <span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.classification === "above_limit" ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>{item.followersCount.toLocaleString("pt-BR")} seguidores</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">contagem pendente</span>}</div><p className="mt-1 text-xs text-slate-500">{reviewFlags[item.username] ? "Leitura automática inconclusiva · " : ""}{item.reasons.join(" · ")} · Fonte: {sourceLabel(item.dataSource)}</p></div><div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => openProfile(item.username)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><ExternalLink size={14} /> Abrir perfil</button><button type="button" onClick={() => void reviewProfile(item.username)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{reviewFlags[item.username] ? "Revisar novamente" : "Revisar"}</button>{typeof item.followersCount !== "number" ? <button type="button" onClick={() => saveManualFollowers(item.username)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Informar seguidores</button> : null}<button type="button" onClick={() => addProtected(item.username)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><ShieldCheck size={14} /> Proteger</button></div></div>)}{!activeList.length ? <div className="p-8 text-center text-sm text-slate-500">{tab === "priority" ? "Nenhum perfil com contagem conhecida está dentro do limite atual." : tab === "above" ? "Nenhum perfil conhecido está acima do limite atual." : "Nenhum perfil aguardando enriquecimento."}</div> : null}</div>}
      </section>
    </div>
    {restoreBackupDialog}
    </>
  );
}
