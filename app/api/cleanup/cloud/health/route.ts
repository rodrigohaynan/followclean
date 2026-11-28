import { NextResponse } from "next/server";
import {
  cloudDatabaseConfigured,
  ensureCloudSchema,
  getCloudSql,
} from "@/lib/cloud/database";

// Precisa rodar a cada acesso: se for gerada no build, a resposta congela o
// estado das variáveis de ambiente daquele momento.
export const dynamic = "force-dynamic";

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
    // Detalhes do erro (host, usuário, SQL) ficam só no log do servidor.
    console.error("[Cloud] health_check_error", error);
    return NextResponse.json(
      {
        configured: true,
        database: "error",
      },
      { status: 500 },
    );
  }
}
