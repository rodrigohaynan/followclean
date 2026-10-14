import { NextRequest, NextResponse } from "next/server";
import { unsealInstagramSession } from "@/lib/instagram/session";
import {
  LOCAL_PROFILE_COOKIE,
  readLocalProfileToken,
} from "@/lib/instagram/local-profile";

export async function GET(request: NextRequest) {
  const official = await unsealInstagramSession(
    request.cookies.get("followclean_ig_session")?.value,
  );

  if (official?.account?.id && official.account.username) {
    return NextResponse.json({
      connected: true,
      mode: "official",
      cloudEnabled: true,
      account: {
        id: String(official.account.id),
        username: official.account.username.toLowerCase(),
        accountType: official.account.accountType ?? null,
      },
    });
  }

  const personal = readLocalProfileToken(
    request.cookies.get(LOCAL_PROFILE_COOKIE)?.value,
  );
  if (personal) {
    return NextResponse.json({
      connected: true,
      mode: "personal",
      cloudEnabled: false,
      account: {
        id: personal.ownerId,
        username: personal.username,
        accountType: "PERSONAL",
      },
    });
  }

  return NextResponse.json({ connected: false }, { status: 401 });
}
