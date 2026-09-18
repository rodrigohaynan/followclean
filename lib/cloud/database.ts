import { neon } from "@neondatabase/serverless";

let schemaReady: Promise<void> | null = null;

export function cloudDatabaseConfigured() {
  return Boolean(process.env.FOLLOWCLEAN_DATABASE_URL || process.env.DATABASE_URL);
}

export function getCloudSql() {
  const url =
    process.env.FOLLOWCLEAN_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error("FOLLOWCLEAN_DATABASE_URL não configurada.");
  }

  return neon(url);
}

export async function ensureCloudSchema() {
  if (schemaReady) return schemaReady;

  schemaReady = (async () => {
    const sql = getCloudSql();

    await sql`
      CREATE TABLE IF NOT EXISTS followclean_cleanup_queue (
        owner_id TEXT NOT NULL,
        owner_username TEXT,
        username TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'processing', 'verified', 'unavailable')),
        followers_count BIGINT,
        parser_version INTEGER,
        data_source TEXT,
        failure_reason TEXT,
        claimed_by TEXT,
        lease_until TIMESTAMPTZ,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (owner_id, username)
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS followclean_cleanup_queue_claim_idx
      ON followclean_cleanup_queue (owner_id, status, lease_until, updated_at)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS followclean_android_oauth_states (
        state_hash TEXT PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS followclean_android_oauth_states_expires_idx
      ON followclean_android_oauth_states (expires_at)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS followclean_devices (
        owner_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        owner_username TEXT,
        last_username TEXT,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (owner_id, device_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS followclean_run_lock (
        owner_id TEXT PRIMARY KEY,
        active_device_id TEXT NOT NULL,
        lease_until TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  })();

  return schemaReady;
}
