import { NextRequest, NextResponse } from "next/server";
import { createStoredAndroidOAuthState } from "@/lib/instagram/android-oauth-state-store";

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

  try {
    const redirectUri =
      process.env.INSTAGRAM_REDIRECT_URI ??
      `${request.nextUrl.origin}/api/instagram/callback`;
    const state = await createStoredAndroidOAuthState();

    return NextResponse.redirect(buildAuthUrl(appId, redirectUri, state));
  } catch (error) {
    console.error("[Instagram OAuth] android_state_store_error", error);
    return NextResponse.redirect(
      new URL("/conectar?status=android_state_error", request.url),
    );
  }
}
