import { NextRequest, NextResponse } from "next/server";
import { getCloudIdentity } from "@/lib/cloud/auth";
import { cloudDatabaseConfigured, ensureCloudSchema, getCloudSql } from "@/lib/cloud/database";

export async function POST(request: NextRequest) {
  const identity = await getCloudIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!cloudDatabaseConfigured()) {
    return NextResponse.json({ configured: false, error: "cloud_not_configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const username = typeof body?.username === "string"
    ? body.username.trim().toLowerCase().replace(/^@/, "")
    : "";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.slice(0, 200) : "";
  const status = body?.status === "unavailable" ? "unavailable" : "verified";
  const followersCount = Number.isFinite(Number(body?.followersCount))
    ? Math.max(0, Math.round(Number(body.followersCount)))
    : null;
  const parserVersion = Number.isFinite(Number(body?.parserVersion))
    ? Math.max(0, Math.round(Number(body.parserVersion)))
    : null;
  const failureReason = typeof body?.reason === "string" ? body.reason.slice(0, 200) : null;

  if (!username || !deviceId || (status === "verified" && followersCount === null)) {
    return NextResponse.json({ error: "invalid_result" }, { status: 400 });
  }

  await ensureCloudSchema();
  const sql = getCloudSql();

  await sql.query(
    `
      INSERT INTO followclean_cleanup_queue (
        owner_id, owner_username, username, status, followers_count,
        parser_version, data_source, failure_reason, claimed_by,
        lease_until, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'extension', $7, $8, NULL, NOW())
      ON CONFLICT (owner_id, username)
      DO UPDATE SET
        owner_username = EXCLUDED.owner_username,
        status = EXCLUDED.status,
        followers_count = EXCLUDED.followers_count,
        parser_version = EXCLUDED.parser_version,
        data_source = EXCLUDED.data_source,
        failure_reason = EXCLUDED.failure_reason,
        claimed_by = EXCLUDED.claimed_by,
        lease_until = NULL,
        updated_at = NOW()
    `,
    [
      identity.ownerId,
      identity.username,
      username,
      status,
      status === "verified" ? followersCount : null,
      parserVersion,
      failureReason,
      deviceId,
    ],
  );

  await sql.query(
    `
      UPDATE followclean_devices
      SET last_username = $3, last_seen_at = NOW()
      WHERE owner_id = $1 AND device_id = $2
    `,
    [identity.ownerId, deviceId, username],
  );

  return NextResponse.json({ ok: true });
}
