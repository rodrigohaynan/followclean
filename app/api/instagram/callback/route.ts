import { NextRequest, NextResponse } from "next/server";
import { sealInstagramSession } from "@/lib/instagram/session";

const OAUTH_STATE_COOKIE = "followclean_ig_oauth_state";
const SESSION_COOKIE = "followclean_ig_session";

function redirectWithStatus(request: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/conectar?status=${encodeURIComponent(status)}`, request.url));
}

export async function GET(request: NextRequest) {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!appId || !appSecret) return redirectWithStatus(request, "setup");
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithStatus(request, "state_error");
  }

  const redirectUri =
    process.env.INSTAGRAM_REDIRECT_URI ??
    `${request.nextUrl.origin}/api/instagram/callback`;

  try {
    const tokenBody = new FormData();
    tokenBody.set("client_id", appId);
    tokenBody.set("client_secret", appSecret);
    tokenBody.set("grant_type", "authorization_code");
    tokenBody.set("redirect_uri", redirectUri);
    tokenBody.set("code", code);

    const shortTokenResponse = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: tokenBody,
      cache: "no-store",
    });

    if (!shortTokenResponse.ok) throw new Error("Falha ao trocar o código por token.");

    const shortToken = (await shortTokenResponse.json()) as {
      access_token: string;
      user_id?: number | string;
    };

    const longTokenUrl = new URL("https://graph.instagram.com/access_token");
    longTokenUrl.searchParams.set("grant_type", "ig_exchange_token");
    longTokenUrl.searchParams.set("client_secret", appSecret);
    longTokenUrl.searchParams.set("access_token", shortToken.access_token);

    const longTokenResponse = await fetch(longTokenUrl, { cache: "no-store" });
    const longToken = longTokenResponse.ok
      ? ((await longTokenResponse.json()) as { access_token: string; expires_in?: number })
      : { access_token: shortToken.access_token, expires_in: 3600 };

    const profileUrl = new URL("https://graph.instagram.com/v26.0/me");
    profileUrl.searchParams.set(
      "fields",
      "user_id,username,account_type,profile_picture_url,followers_count,follows_count",
    );

    const profileResponse = await fetch(profileUrl, {
      headers: { Authorization: `Bearer ${longToken.access_token}` },
      cache: "no-store",
    });

    if (!profileResponse.ok) throw new Error("Falha ao carregar o perfil conectado.");

    const profile = (await profileResponse.json()) as {
      id?: string;
      user_id?: string;
      username?: string;
      account_type?: string;
      profile_picture_url?: string;
      followers_count?: number;
      follows_count?: number;
    };

    if (!profile.username) throw new Error("A Meta não retornou o nome de usuário.");

    const expiresAt = longToken.expires_in
      ? new Date(Date.now() + longToken.expires_in * 1000).toISOString()
      : undefined;

    const sealed = await sealInstagramSession({
      accessToken: longToken.access_token,
      expiresAt,
      account: {
        id: String(profile.user_id ?? profile.id ?? shortToken.user_id ?? ""),
        username: profile.username,
        accountType: profile.account_type,
        profilePictureUrl: profile.profile_picture_url,
        followersCount: profile.followers_count,
        followsCount: profile.follows_count,
      },
    });

    const response = NextResponse.redirect(new URL("/conectar?status=connected", request.url));
    response.cookies.delete(OAUTH_STATE_COOKIE);
    response.cookies.set(SESSION_COOKIE, sealed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.min(longToken.expires_in ?? 3600, 60 * 60 * 24 * 60),
    });
    return response;
  } catch {
    const response = redirectWithStatus(request, "error");
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }
}
