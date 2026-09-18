import { createHash, randomBytes } from "node:crypto";
import { ensureCloudSchema, getCloudSql } from "@/lib/cloud/database";

const PREFIX = "fca_";

function hashValue(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashAndroidDeviceKey(value: string) {
  return hashValue(value);
}

export function isStoredAndroidOAuthState(value?: string | null) {
  return Boolean(value?.startsWith(PREFIX));
}

export async function createStoredAndroidOAuthState(deviceKey?: string | null) {
  const normalizedDeviceKey = deviceKey?.trim() ?? "";
  if (normalizedDeviceKey && (normalizedDeviceKey.length < 16 || normalizedDeviceKey.length > 200)) {
    throw new Error("device_key_invalid");
  }

  await ensureCloudSchema();
  const sql = getCloudSql();
  const state = PREFIX + randomBytes(32).toString("base64url");
  const stateHash = hashValue(state);
  const deviceKeyHash = normalizedDeviceKey
    ? hashAndroidDeviceKey(normalizedDeviceKey)
    : null;

  await sql`
    DELETE FROM followclean_android_oauth_states
    WHERE expires_at <= NOW()
  `;

  await sql`
    INSERT INTO followclean_android_oauth_states
      (state_hash, device_key_hash, expires_at)
    VALUES (${stateHash}, ${deviceKeyHash}, NOW() + INTERVAL '10 minutes')
  `;

  return state;
}

export async function consumeStoredAndroidOAuthState(value: string) {
  if (!isStoredAndroidOAuthState(value)) return null;

  await ensureCloudSchema();
  const sql = getCloudSql();
  const stateHash = hashValue(value);

  const rows = await sql`
    DELETE FROM followclean_android_oauth_states
    WHERE state_hash = ${stateHash}
      AND expires_at > NOW()
    RETURNING device_key_hash
  `;

  if (!rows.length) return null;

  const deviceKeyHash = rows[0]?.device_key_hash;
  return {
    deviceKeyHash:
      typeof deviceKeyHash === "string" && deviceKeyHash
        ? deviceKeyHash
        : null,
  };
}
