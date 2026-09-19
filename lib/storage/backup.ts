import { strFromU8, strToU8, Unzlib, zlibSync, unzlibSync } from "fflate";

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


function normalizedBackupBytes(value: string) {
  const raw = value.trim();
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

  return base64ToBytes(encoded);
}

function extractBalancedJsonValue(
  text: string,
  key: string,
): unknown | undefined {
  const token = `"${key}"`;
  const keyIndex = text.indexOf(token);
  if (keyIndex < 0) return undefined;

  const colonIndex = text.indexOf(":", keyIndex + token.length);
  if (colonIndex < 0) return undefined;

  let start = colonIndex + 1;
  while (start < text.length && /\s/.test(text[start])) start += 1;
  if (start >= text.length) return undefined;

  const opening = text[start];
  if (opening !== "{" && opening !== "[") return undefined;

  const stack: string[] = [opening];
  let inString = false;
  let escaped = false;

  for (let i = start + 1; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const expected = char === "}" ? "{" : "[";
      if (stack[stack.length - 1] !== expected) return undefined;
      stack.pop();

      if (!stack.length) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return undefined;
        }
      }
    }
  }

  return undefined;
}

export function salvageFollowCleanBackup(value: string) {
  const bytes = normalizedBackupBytes(value);
  const chunks: Uint8Array[] = [];

  const stream = new Unzlib((chunk) => {
    if (chunk?.length) chunks.push(chunk);
  });

  // Deliberately do not finalize the stream. For a truncated zlib payload this
  // lets fflate emit every complete decompressed block it can still recover,
  // instead of failing immediately with "unexpected EOF".
  stream.push(bytes, false);

  if (!chunks.length) {
    throw new Error("O backup está truncado antes dos dados recuperáveis.");
  }

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }

  const text = strFromU8(joined);

  try {
    const envelope = JSON.parse(text) as {
      payload?: unknown;
    };
    if (envelope?.payload && typeof envelope.payload === "object") {
      return envelope.payload as Record<string, unknown>;
    }
  } catch {
    // Expected for a genuinely truncated backup; recover complete fields below.
  }

  const payload: Record<string, unknown> = {};
  for (const key of [
    "latest",
    "protectedProfiles",
    "settings",
    "profileMetadata",
    "failures",
  ] as const) {
    const recovered = extractBalancedJsonValue(text, key);
    if (recovered !== undefined) payload[key] = recovered;
  }

  if (!Object.keys(payload).length) {
    throw new Error(
      "O backup foi cortado antes de qualquer bloco completo poder ser recuperado.",
    );
  }

  return payload;
}
