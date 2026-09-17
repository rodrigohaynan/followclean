import { NextRequest, NextResponse } from "next/server";

const OAUTH_STATE_COOKIE = "followclean_ig_oauth_state";

export async function GET(request: NextRequest) {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.redirect(new URL("/conectar?status=setup", request.url));
  }

  const redirectUri =
    process.env.INSTAGRAM_REDIRECT_URI ??
    `${request.nextUrl.origin}/api/instagram/callback`;
  const state = crypto.randomUUID().replaceAll("-", "");

  const authUrl = new URL("https://www.instagram.com/oauth/authorize");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "instagram_business_basic");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("force_reauth", "true");
  authUrl.searchParams.set("enable_fb_login", "false");

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
