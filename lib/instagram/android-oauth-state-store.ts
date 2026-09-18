import { createHash, randomBytes } from "node:crypto";
import { ensureCloudSchema, getCloudSql } from "@/lib/cloud/database";

const PREFIX = "fca_";

function hashState(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function isStoredAndroidOAuthState(value?: string | null) {
  return Boolean(value?.startsWith(PREFIX));
}

export async function createStoredAndroidOAuthState() {
  await ensureCloudSchema();
  const sql = getCloudSql();
  const state = PREFIX + randomBytes(32).toString("base64url");
  const stateHash = hashState(state);

  await sql`
    DELETE FROM followclean_android_oauth_states
    WHERE expires_at <= NOW()
  `;

  await sql`
    INSERT INTO followclean_android_oauth_states (state_hash, expires_at)
    VALUES (${stateHash}, NOW() + INTERVAL '10 minutes')
  `;

  return state;
}

export async function consumeStoredAndroidOAuthState(value: string) {
  if (!isStoredAndroidOAuthState(value)) return false;

  await ensureCloudSchema();
  const sql = getCloudSql();
  const stateHash = hashState(value);

  const rows = await sql`
    DELETE FROM followclean_android_oauth_states
    WHERE state_hash = ${stateHash}
      AND expires_at > NOW()
    RETURNING state_hash
  `;

  return rows.length > 0;
}
