import { NextResponse } from "next/server";
import { verifyMetaSignedRequest } from "@/lib/instagram/signed-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json(
      { ok: false, error: "Instagram App Secret ainda não configurado." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const signedRequest = form.get("signed_request");

  if (typeof signedRequest !== "string" || !signedRequest) {
    return NextResponse.json(
      { ok: false, error: "signed_request ausente." },
      { status: 400 },
    );
  }

  const payload = verifyMetaSignedRequest(signedRequest, appSecret);
  if (!payload?.user_id) {
    return NextResponse.json(
      { ok: false, error: "Assinatura inválida." },
      { status: 400 },
    );
  }

  // O FollowClean ainda é local-first e não mantém dados da conta em servidor.
  // Se futuramente houver dados persistidos em nuvem, a remoção por user_id deve ocorrer aqui.
  return NextResponse.json({ ok: true });
}
