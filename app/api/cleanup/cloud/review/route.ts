import { NextRequest, NextResponse } from "next/server";
import { getCloudIdentity } from "@/lib/cloud/auth";
import {
  cloudDatabaseConfigured,
  ensureCloudSchema,
  getCloudSql,
} from "@/lib/cloud/database";

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
  const username =
    typeof body?.username === "string"
      ? body.username.trim().toLowerCase().replace(/^@/, "")
      : "";

  if (!username) {
    return NextResponse.json({ error: "username_required" }, { status: 400 });
  }

  await ensureCloudSchema();
  const sql = getCloudSql();

  await sql.query(
    `
      UPDATE followclean_cleanup_queue
      SET
        status = 'pending',
        followers_count = NULL,
        parser_version = NULL,
        data_source = NULL,
        failure_reason = NULL,
        claimed_by = NULL,
        lease_until = NULL,
        updated_at = NOW()
      WHERE owner_id = $1
        AND username = $2
    `,
    [identity.ownerId, username],
  );

  return NextResponse.json({ ok: true, username });
}
