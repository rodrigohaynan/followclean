import { NextRequest, NextResponse } from "next/server";
import { createAndroidOAuthState } from "@/lib/instagram/oauth-state";
import { createStoredAndroidOAuthState } from "@/lib/instagram/android-oauth-state-store";

const OAUTH_STATE_COOKIE = "followclean_ig_oauth_state";

function buildAuthUrl(appId: string, redirectUri: string, state: string) {
  const authUrl = new URL("https://www.instagram.com/oauth/authorize");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "instagram_business_basic");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("force_reauth", "true");
  authUrl.searchParams.set("force_authentication", "1");
  authUrl.searchParams.set("enable_fb_login", "0");
  return authUrl;
}

export async function GET(request: NextRequest) {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.redirect(new URL("/conectar?status=setup", request.url));
  }

  const redirectUri =
    process.env.INSTAGRAM_REDIRECT_URI ??
    `${request.nextUrl.origin}/api/instagram/callback`;
  const userAgent = request.headers.get("user-agent") ?? "";
  const isFollowCleanAndroid = /FollowCleanAndroid/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  let state: string;

  if (isFollowCleanAndroid) {
    state = createAndroidOAuthState();
  } else if (isAndroid) {
    // No Chrome Android, não dependemos de cookie para validar o state.
    // Alguns fluxos da Meta mudam de aba/app e podem perder o cookie.
    state = await createStoredAndroidOAuthState();
  } else {
    state = crypto.randomUUID().replaceAll("-", "");
  }

  const destination = buildAuthUrl(appId, redirectUri, state);
  const response = NextResponse.redirect(destination);

  if (!isFollowCleanAndroid && !isAndroid) {
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
  }

  return response;
}
