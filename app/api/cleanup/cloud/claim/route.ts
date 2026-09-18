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
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.slice(0, 200) : "";
  if (!deviceId) {
    return NextResponse.json({ error: "device_id_required" }, { status: 400 });
  }

  await ensureCloudSchema();
  const sql = getCloudSql();

  await sql.query(
    `
      INSERT INTO followclean_devices
        (owner_id, device_id, owner_username, last_seen_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (owner_id, device_id)
      DO UPDATE SET
        owner_username = EXCLUDED.owner_username,
        last_seen_at = NOW()
    `,
    [identity.ownerId, deviceId, identity.username],
  );

  const rows = await sql.query(
    `
      WITH candidate AS (
        SELECT owner_id, username
        FROM followclean_cleanup_queue
        WHERE owner_id = $1
          AND (
            status = 'pending'
            OR (status = 'processing' AND lease_until < NOW())
          )
        ORDER BY updated_at ASC, username ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE followclean_cleanup_queue AS q
      SET
        status = 'processing',
        claimed_by = $2,
        lease_until = NOW() + INTERVAL '3 minutes',
        attempts = q.attempts + 1,
        updated_at = NOW()
      FROM candidate AS c
      WHERE q.owner_id = c.owner_id
        AND q.username = c.username
      RETURNING q.username, q.attempts, q.lease_until
    `,
    [identity.ownerId, deviceId],
  );

  const item = rows[0] ?? null;
  if (item) {
    await sql.query(
      `
        UPDATE followclean_devices
        SET last_username = $3, last_seen_at = NOW()
        WHERE owner_id = $1 AND device_id = $2
      `,
      [identity.ownerId, deviceId, item.username],
    );
  }

  return NextResponse.json({ configured: true, item });
}
