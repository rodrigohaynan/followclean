import { NextRequest, NextResponse } from "next/server";
import { mergeReciprocityChecks, type CleanupSettings } from "@/lib/rules/engine";
import { getCloudIdentity } from "@/lib/cloud/auth";
import {
  cloudDatabaseConfigured,
  ensureCloudSchema,
  getCloudSql,
} from "@/lib/cloud/database";

function normalizeUsername(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/^@/, "");
}

function normalizeUsernameList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map(normalizeUsername)
      .filter(Boolean),
  )].slice(0, 20000);
}

function normalizeAnalysis(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  const followers = normalizeUsernameList(raw.followers);
  const following = normalizeUsernameList(raw.following);
  const mutual = normalizeUsernameList(raw.mutual);
  const notFollowingBack = normalizeUsernameList(raw.notFollowingBack);
  const followersOnly = normalizeUsernameList(raw.followersOnly);

  return {
    followers,
    following,
    mutual,
    notFollowingBack,
    followersOnly,
    totals: {
      followers: followers.length,
      following: following.length,
      mutual: mutual.length,
      notFollowingBack: notFollowingBack.length,
      followersOnly: followersOnly.length,
    },
  };
}

type MetadataInput = {
  username?: unknown;
  followersCount?: unknown;
  parserVersion?: unknown;
  dataSource?: unknown;
  updatedAt?: unknown;
};

type FailureInput = {
  username?: unknown;
  reason?: unknown;
  updatedAt?: unknown;
};

function parseDate(value: unknown) {
  if (typeof value !== "string") return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export async function POST(request: NextRequest) {
  const identity = await getCloudIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!cloudDatabaseConfigured()) {
    return NextResponse.json(
      { configured: false, error: "cloud_not_configured" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const analysis = normalizeAnalysis(body?.analysis);
  if (!analysis) {
    return NextResponse.json({ error: "analysis_required" }, { status: 400 });
  }

  const protectedProfiles = Array.isArray(body?.protectedProfiles)
    ? body.protectedProfiles
        .flatMap((item: unknown) => {
          if (typeof item === "string") {
            const username = normalizeUsername(item);
            return username ? [{ username }] : [];
          }
          if (!item || typeof item !== "object") return [];
          const row = item as Record<string, unknown>;
          const username = normalizeUsername(row.username);
          if (!username) return [];
          return [{
            username,
            createdAt:
              typeof row.createdAt === "string"
                ? row.createdAt
                : new Date().toISOString(),
            reason:
              typeof row.reason === "string" && row.reason.trim()
                ? row.reason.trim().slice(0, 300)
                : undefined,
          }];
        })
        .slice(0, 20000)
    : [];

  const settings =
    body?.settings && typeof body.settings === "object"
      ? body.settings
      : {};

  const sourceFile =
    typeof body?.sourceFile === "string"
      ? body.sourceFile.slice(0, 500)
      : null;

  const analysisCreatedAt = parseDate(body?.analysisCreatedAt);

  await ensureCloudSchema();
  const sql = getCloudSql();

  // Older devices can upload a snapshot without the new confirmations.
  // Merge by confirmation date instead of allowing a stale upload to erase
  // a "follows" safety decision stored in the cloud.
  const previous = await sql.query(
    "SELECT settings FROM followclean_cleanup_snapshot WHERE owner_id = $1",
    [identity.ownerId],
  );
  const storedSettings = previous[0]?.settings &&
    typeof previous[0].settings === "object"
      ? previous[0].settings as Record<string, unknown>
      : {};
  const incomingSettings = settings as Record<string, unknown>;
  const mergedSettings = {
    ...incomingSettings,
    reciprocityChecks: mergeReciprocityChecks(
      storedSettings.reciprocityChecks as CleanupSettings["reciprocityChecks"],
      incomingSettings.reciprocityChecks as CleanupSettings["reciprocityChecks"],
    ),
  };

  await sql.query(
    `
      INSERT INTO followclean_cleanup_snapshot (
        owner_id,
        owner_username,
        analysis,
        source_file,
        analysis_created_at,
        protected_profiles,
        settings,
        updated_at
      )
      VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, $7::jsonb, NOW())
      ON CONFLICT (owner_id)
      DO UPDATE SET
        owner_username = EXCLUDED.owner_username,
        analysis = EXCLUDED.analysis,
        source_file = EXCLUDED.source_file,
        analysis_created_at = EXCLUDED.analysis_created_at,
        protected_profiles = EXCLUDED.protected_profiles,
        settings = EXCLUDED.settings,
        updated_at = NOW()
    `,
    [
      identity.ownerId,
      identity.username,
      JSON.stringify(analysis),
      sourceFile,
      analysisCreatedAt.toISOString(),
      JSON.stringify(protectedProfiles),
      JSON.stringify(mergedSettings),
    ],
  );

  const queueUsernames = analysis.notFollowingBack.filter(
    (username) => !username.startsWith("__deleted__"),
  );

  const chunkSize = 400;
  for (let offset = 0; offset < queueUsernames.length; offset += chunkSize) {
    const chunk = queueUsernames.slice(offset, offset + chunkSize);
    const params: unknown[] = [];
    const values = chunk.map((username, index) => {
      const base = index * 3;
      params.push(identity.ownerId, identity.username, username);
      return `($${base + 1}, $${base + 2}, $${base + 3})`;
    });

    await sql.query(
      `
        INSERT INTO followclean_cleanup_queue
          (owner_id, owner_username, username)
        VALUES ${values.join(",")}
        ON CONFLICT (owner_id, username)
        DO UPDATE SET
          owner_username = EXCLUDED.owner_username
      `,
      params,
    );
  }

  const metadata = Array.isArray(body?.metadata)
    ? (body.metadata as MetadataInput[])
    : [];

  const trustedMetadata = metadata
    .slice(0, 20000)
    .flatMap((item) => {
      const username = normalizeUsername(item.username);
      const followersCount = Number(item.followersCount);
      const dataSource =
        typeof item.dataSource === "string" ? item.dataSource : "unknown";
      const parserVersion = Number.isFinite(Number(item.parserVersion))
        ? Math.max(0, Math.round(Number(item.parserVersion)))
        : null;

      if (!username || !Number.isFinite(followersCount)) return [];

      const isTrusted =
        dataSource !== "extension" || (parserVersion ?? 0) >= 2;
      if (!isTrusted) return [];

      return [{
        username,
        followersCount: Math.max(0, Math.round(followersCount)),
        parserVersion,
        dataSource,
        updatedAt: parseDate(item.updatedAt).toISOString(),
      }];
    });

  for (let offset = 0; offset < trustedMetadata.length; offset += 250) {
    const chunk = trustedMetadata.slice(offset, offset + 250);
    const params: unknown[] = [];
    const values = chunk.map((item, index) => {
      const base = index * 7;
      params.push(
        identity.ownerId,
        identity.username,
        item.username,
        item.followersCount,
        item.parserVersion,
        item.dataSource,
        item.updatedAt,
      );
      return `(${base + 1}, ${base + 2}, ${base + 3}, 'verified', ${base + 4}, ${base + 5}, ${base + 6}, NULL, NULL, ${base + 7})`;
    });

    await sql.query(
      `
        INSERT INTO followclean_cleanup_queue (
          owner_id,
          owner_username,
          username,
          status,
          followers_count,
          parser_version,
          data_source,
          failure_reason,
          lease_until,
          updated_at
        )
        VALUES ${values.join(",")}
        ON CONFLICT (owner_id, username)
        DO UPDATE SET
          owner_username = EXCLUDED.owner_username,
          status = 'verified',
          followers_count = EXCLUDED.followers_count,
          parser_version = EXCLUDED.parser_version,
          data_source = EXCLUDED.data_source,
          failure_reason = NULL,
          lease_until = NULL,
          updated_at = EXCLUDED.updated_at
        WHERE followclean_cleanup_queue.updated_at <= EXCLUDED.updated_at
      `,
      params,
    );
  }

  const failures = Array.isArray(body?.failures)
    ? (body.failures as FailureInput[])
    : [];

  const normalizedFailures = failures
    .slice(0, 20000)
    .flatMap((item) => {
      const username = normalizeUsername(item.username);
      if (!username) return [];
      return [{
        username,
        reason:
          typeof item.reason === "string"
            ? item.reason.slice(0, 200)
            : "unavailable",
        updatedAt: parseDate(item.updatedAt).toISOString(),
      }];
    });

  for (let offset = 0; offset < normalizedFailures.length; offset += 300) {
    const chunk = normalizedFailures.slice(offset, offset + 300);
    const params: unknown[] = [];
    const values = chunk.map((item, index) => {
      const base = index * 5;
      params.push(
        identity.ownerId,
        identity.username,
        item.username,
        item.reason,
        item.updatedAt,
      );
      return `(${base + 1}, ${base + 2}, ${base + 3}, 'unavailable', ${base + 4}, NULL, ${base + 5})`;
    });

    await sql.query(
      `
        INSERT INTO followclean_cleanup_queue (
          owner_id,
          owner_username,
          username,
          status,
          failure_reason,
          lease_until,
          updated_at
        )
        VALUES ${values.join(",")}
        ON CONFLICT (owner_id, username)
        DO UPDATE SET
          owner_username = EXCLUDED.owner_username,
          status = 'unavailable',
          followers_count = NULL,
          parser_version = NULL,
          data_source = 'extension',
          failure_reason = EXCLUDED.failure_reason,
          lease_until = NULL,
          updated_at = EXCLUDED.updated_at
        WHERE followclean_cleanup_queue.updated_at <= EXCLUDED.updated_at
      `,
      params,
    );
  }

  const [summary] = await sql.query(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'processing')::int AS processing,
        COUNT(*) FILTER (WHERE status = 'verified')::int AS verified,
        COUNT(*) FILTER (WHERE status = 'unavailable')::int AS unavailable
      FROM followclean_cleanup_queue
      WHERE owner_id = $1
    `,
    [identity.ownerId],
  );

  return NextResponse.json({
    ok: true,
    configured: true,
    summary,
  });
}
