import { NextRequest, NextResponse } from "next/server";
import { createAndroidOAuthState } from "@/lib/instagram/oauth-state";

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

  // O fluxo do APK usa um state assinado e autocontido.
  // Assim o início do OAuth não depende de cookie nem de banco externo.
  const state = createAndroidOAuthState();

  return NextResponse.redirect(buildAuthUrl(appId, redirectUri, state));
}
