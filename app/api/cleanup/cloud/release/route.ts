import { NextRequest, NextResponse } from "next/server";
import { getCloudIdentity } from "@/lib/cloud/auth";
import { cloudDatabaseConfigured, ensureCloudSchema, getCloudSql } from "@/lib/cloud/database";

export async function POST(request: NextRequest) {
  const identity = await getCloudIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!cloudDatabaseConfigured()) {
    return NextResponse.json({ configured: false });
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
      DELETE FROM followclean_run_lock
      WHERE owner_id = $1 AND active_device_id = $2
    `,
    [identity.ownerId, deviceId],
  );

  await sql.query(
    `
      UPDATE followclean_cleanup_queue
      SET status = 'pending', claimed_by = NULL, lease_until = NULL, updated_at = NOW()
      WHERE owner_id = $1
        AND status = 'processing'
        AND claimed_by = $2
    `,
    [identity.ownerId, deviceId],
  );

  return NextResponse.json({ ok: true });
}
