import { NextRequest, NextResponse } from "next/server";
import { getCloudIdentity } from "@/lib/cloud/auth";
import { cloudDatabaseConfigured, ensureCloudSchema, getCloudSql } from "@/lib/cloud/database";

export async function GET(request: NextRequest) {
  const identity = await getCloudIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!cloudDatabaseConfigured()) {
    return NextResponse.json({ configured: false });
  }

  await ensureCloudSchema();
  const sql = getCloudSql();

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

  const rows = await sql.query(
    `
      SELECT
        username, status, followers_count, parser_version, data_source,
        failure_reason, claimed_by, lease_until, attempts, updated_at
      FROM followclean_cleanup_queue
      WHERE owner_id = $1
        AND status IN ('verified', 'unavailable')
      ORDER BY updated_at DESC
      LIMIT 10000
    `,
    [identity.ownerId],
  );

  const snapshotRows = await sql.query(
    `
      SELECT
        analysis,
        source_file,
        analysis_created_at,
        protected_profiles,
        settings,
        updated_at
      FROM followclean_cleanup_snapshot
      WHERE owner_id = $1
      LIMIT 1
    `,
    [identity.ownerId],
  );

  const devices = await sql.query(
    `
      SELECT device_id, last_username, last_seen_at
      FROM followclean_devices
      WHERE owner_id = $1
      ORDER BY last_seen_at DESC
      LIMIT 10
    `,
    [identity.ownerId],
  );

  return NextResponse.json({
    configured: true,
    account: identity,
    summary,
    rows,
    snapshot: snapshotRows[0] ?? null,
    devices,
  });
}
