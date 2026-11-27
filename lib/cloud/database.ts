import { neon } from "@neondatabase/serverless";

export type QueryRow = Record<string, unknown>;
export type QueryResult = QueryRow[];

export type CloudSql = {
  (
    strings: TemplateStringsArray,
    ...params: unknown[]
  ): Promise<QueryResult>;
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

let schemaReady: Promise<void> | null = null;
let sqlClient: CloudSql | null = null;

export function cloudDatabaseConfigured() {
  return Boolean(
    process.env.FOLLOWCLEAN_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim(),
  );
}

export function getCloudSql(): CloudSql {
  if (sqlClient) return sqlClient;

  const url =
    process.env.FOLLOWCLEAN_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error("FOLLOWCLEAN_DATABASE_URL não configurada.");
  }

  const base = neon(url);

  const tagged = (async (
    strings: TemplateStringsArray,
    ...params: unknown[]
  ) => {
    const rows = await base(strings, ...params);
    return rows as QueryResult;
  }) as CloudSql;

  tagged.query = async (text: string, params: unknown[] = []) => {
    const rows = await base.query(text, params);
    return rows as QueryResult;
  };

  sqlClient = tagged;
  return tagged;
}

export async function ensureCloudSchema() {
  if (schemaReady) return schemaReady;

  schemaReady = (async () => {
    const sql = getCloudSql();

    // Trava de execução: garante que apenas um dispositivo processe a fila
    // de uma conta por vez (usada por /claim e /release).
    await sql`
      CREATE TABLE IF NOT EXISTS followclean_run_lock (
        owner_id TEXT PRIMARY KEY,
        active_device_id TEXT NOT NULL,
        lease_until TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

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
      ALTER TABLE followclean_android_oauth_states
      ADD COLUMN IF NOT EXISTS device_key_hash TEXT
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS followclean_android_oauth_states_expires_idx
      ON followclean_android_oauth_states (expires_at)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS followclean_android_pending_sessions (
        device_key_hash TEXT PRIMARY KEY,
        handoff TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS followclean_android_pending_sessions_expires_idx
      ON followclean_android_pending_sessions (expires_at)
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
      CREATE TABLE IF NOT EXISTS followclean_cleanup_snapshot (
        owner_id TEXT PRIMARY KEY,
        owner_username TEXT,
        analysis JSONB NOT NULL,
        source_file TEXT,
        analysis_created_at TIMESTAMPTZ,
        protected_profiles JSONB NOT NULL DEFAULT '[]'::jsonb,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS followclean_cleanup_snapshot_updated_idx
      ON followclean_cleanup_snapshot (updated_at DESC)
    `;
  })().catch((error) => {
    // Sem isso, uma falha temporária (rede/cold start do Neon) ficaria em
    // cache até a função reiniciar e todas as rotas de nuvem falhariam.
    schemaReady = null;
    throw error;
  });

  return schemaReady;
}

/**
 * Remove todos os dados em nuvem de uma conta (fila, checkpoint, dispositivos
 * e trava). Usado pelos callbacks de exclusão de dados e desautorização da Meta.
 */
export async function deleteCloudDataForOwner(ownerId: string) {
  if (!cloudDatabaseConfigured() || !ownerId) return false;
  await ensureCloudSchema();
  const sql = getCloudSql();
  await sql`DELETE FROM followclean_cleanup_queue WHERE owner_id = ${ownerId}`;
  await sql`DELETE FROM followclean_cleanup_snapshot WHERE owner_id = ${ownerId}`;
  await sql`DELETE FROM followclean_devices WHERE owner_id = ${ownerId}`;
  await sql`DELETE FROM followclean_run_lock WHERE owner_id = ${ownerId}`;
  return true;
}
