import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { verifyMetaSignedRequest } from "@/lib/instagram/signed-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json(
      { error: "Instagram App Secret ainda não configurado." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const signedRequest = form.get("signed_request");

  if (typeof signedRequest !== "string" || !signedRequest) {
    return NextResponse.json(
      { error: "signed_request ausente." },
      { status: 400 },
    );
  }

  const payload = verifyMetaSignedRequest(signedRequest, appSecret);
  if (!payload?.user_id) {
    return NextResponse.json(
      { error: "Assinatura inválida." },
      { status: 400 },
    );
  }

  // Atualmente o FollowClean é local-first e não mantém dados pessoais
  // dessa conta em banco no servidor. Portanto, não há registros remotos
  // para excluir neste estágio do produto.
  const confirmationCode = createHash("sha256")
    .update(`followclean:${payload.user_id}:${appSecret}`)
    .digest("hex")
    .slice(0, 32);

  const statusUrl = new URL("/exclusao-dados", request.url);
  statusUrl.searchParams.set("confirmation_code", confirmationCode);

  return NextResponse.json({
    url: statusUrl.toString(),
    confirmation_code: confirmationCode,
  });
}
