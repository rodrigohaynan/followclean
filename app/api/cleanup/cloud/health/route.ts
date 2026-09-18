import { NextResponse } from "next/server";
import {
  cloudDatabaseConfigured,
  ensureCloudSchema,
  getCloudSql,
} from "@/lib/cloud/database";

export async function GET() {
  const configured = cloudDatabaseConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      database: "missing",
    });
  }

  try {
    await ensureCloudSchema();
    const sql = getCloudSql();
    const rows = await sql`SELECT 1::int AS ok`;

    return NextResponse.json({
      configured: true,
      database: rows[0]?.ok === 1 ? "ready" : "unexpected",
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        database: "error",
        error: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}
