import { NextRequest, NextResponse } from "next/server";
import { getCloudIdentity } from "@/lib/cloud/auth";
import { cloudDatabaseConfigured, ensureCloudSchema, getCloudSql } from "@/lib/cloud/database";

function normalizeUsernames(input: unknown) {
  if (!Array.isArray(input)) return [];
  return [...new Set(
    input
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toLowerCase().replace(/^@/, ""))
      .filter((item) => item && !item.startsWith("__deleted__"))
  )].slice(0, 10000);
}

export async function POST(request: NextRequest) {
  const identity = await getCloudIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!cloudDatabaseConfigured()) {
    return NextResponse.json({ configured: false, error: "cloud_not_configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const usernames = normalizeUsernames(body?.usernames);
  if (!usernames.length) {
    return NextResponse.json({ configured: true, added: 0 });
  }

  await ensureCloudSchema();
  const sql = getCloudSql();
  const chunkSize = 400;

  for (let offset = 0; offset < usernames.length; offset += chunkSize) {
    const chunk = usernames.slice(offset, offset + chunkSize);
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
          owner_username = EXCLUDED.owner_username,
          updated_at = NOW()
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
    configured: true,
    added: usernames.length,
    summary,
  });
}
