import { NextResponse } from "next/server";
import { verifyMetaSignedRequest } from "@/lib/instagram/signed-request";
import { deleteCloudDataForOwner } from "@/lib/cloud/database";

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

  // Ao remover o acesso do app, o checkpoint em nuvem da conta deixa de ter
  // utilidade e é apagado. Os dados locais continuam no dispositivo do usuário.
  try {
    await deleteCloudDataForOwner(String(payload.user_id));
  } catch (error) {
    console.error("[Meta] deauthorize_cloud_error", error);
  }
  return NextResponse.json({ ok: true });
}
