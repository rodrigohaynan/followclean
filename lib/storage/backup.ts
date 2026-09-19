import { strFromU8, strToU8, zlibSync, unzlibSync } from "fflate";

export const FOLLOWCLEAN_BACKUP_PREFIX = "FCBACKUP1:";

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeFollowCleanBackup(payload: Record<string, unknown>) {
  const envelope = {
    version: 1,
    exportedAt: new Date().toISOString(),
    payload,
  };
  const compressed = zlibSync(strToU8(JSON.stringify(envelope)), { level: 9 });
  return FOLLOWCLEAN_BACKUP_PREFIX + bytesToBase64(compressed);
}

export function decodeFollowCleanBackup(value: string) {
  const raw = value.trim();

  // Aceita códigos copiados de notas/mensageiros que possam inserir
  // aspas, quebras de linha ou espaços no meio do Base64.
  const prefixIndex = raw.indexOf(FOLLOWCLEAN_BACKUP_PREFIX);
  if (prefixIndex < 0) {
    throw new Error("Backup do FollowClean inválido.");
  }

  const encoded = raw
    .slice(prefixIndex + FOLLOWCLEAN_BACKUP_PREFIX.length)
    .replace(/["'\s]/g, "");

  if (!encoded) {
    throw new Error("Backup do FollowClean vazio.");
  }
  const envelope = JSON.parse(
    strFromU8(unzlibSync(base64ToBytes(encoded))),
  ) as {
    version?: unknown;
    exportedAt?: unknown;
    payload?: unknown;
  };

  if (envelope.version !== 1 || !envelope.payload || typeof envelope.payload !== "object") {
    throw new Error("Versão de backup não suportada.");
  }

  return envelope.payload as Record<string, unknown>;
}
