import { NextRequest, NextResponse } from "next/server";
import { consumePendingAndroidSession } from "@/lib/instagram/android-pending-session";
import { sealInstagramSession } from "@/lib/instagram/session";

const SESSION_COOKIE = "followclean_ig_session";

export async function GET(request: NextRequest) {
  const deviceKey = request.nextUrl.searchParams.get("deviceKey")?.trim() ?? "";

  if (deviceKey.length < 16) {
    return NextResponse.redirect(
      new URL("/conectar?status=android_handoff_error", request.url),
    );
  }

  try {
    const session = await consumePendingAndroidSession(deviceKey);
    if (!session) {
      const waiting = NextResponse.redirect(
        new URL("/conectar?status=android_waiting", request.url),
      );
      waiting.headers.set("Cache-Control", "no-store");
      return waiting;
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
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(SESSION_COOKIE, sealed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    return response;
  } catch (error) {
    console.error("[Instagram OAuth] android_redeem_error", error);
    return NextResponse.redirect(
      new URL("/conectar?status=android_handoff_error", request.url),
    );
  }
}
