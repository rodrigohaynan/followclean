import { NextRequest, NextResponse } from "next/server";
import { unsealAndroidHandoff } from "@/lib/instagram/android-handoff";
import { sealInstagramSession } from "@/lib/instagram/session";

const SESSION_COOKIE = "followclean_ig_session";

export async function GET(request: NextRequest) {
  const handoff = request.nextUrl.searchParams.get("handoff");
  const session = unsealAndroidHandoff(handoff);

  if (!session) {
    return NextResponse.redirect(
      new URL("/conectar?status=android_handoff_error", request.url),
    );
  }

  const sealed = await sealInstagramSession(session);
  const maxAge = session.expiresAt
    ? Math.max(
        60,
        Math.min(
          Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
          60 * 60 * 24 * 60,
        ),
      )
    : 60 * 60;

  const response = NextResponse.redirect(
    new URL("/conectar?status=connected", request.url),
  );
  response.cookies.set(SESSION_COOKIE, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return response;
}
