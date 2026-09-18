import { NextRequest, NextResponse } from "next/server";
import { sealInstagramSession } from "@/lib/instagram/session";
import { verifyAndroidOAuthState } from "@/lib/instagram/oauth-state";
import { sealAndroidHandoff } from "@/lib/instagram/android-handoff";
import {
  consumeStoredAndroidOAuthState,
  isStoredAndroidOAuthState,
} from "@/lib/instagram/android-oauth-state-store";
import { savePendingAndroidSession } from "@/lib/instagram/android-pending-session";

const OAUTH_STATE_COOKIE = "followclean_ig_oauth_state";
const SESSION_COOKIE = "followclean_ig_session";

function redirectWithStatus(request: NextRequest, status: string) {
  return NextResponse.redirect(
    new URL(`/conectar?status=${encodeURIComponent(status)}`, request.url),
  );
}

function classifyTokenExchangeError(details: string) {
  const value = details.toLowerCase();
  if (value.includes("invalid platform app")) return "invalid_platform_app";
  if (
    value.includes("client_secret") ||
    value.includes("client secret") ||
    value.includes("app secret") ||
    value.includes("invalid secret") ||
    value.includes("invalid client") ||
    value.includes("invalid_client")
  ) return "client_credentials_error";
  if (value.includes("redirect_uri") || value.includes("redirect uri")) {
    return "redirect_uri_error";
  }
  if (
    value.includes("authorization code") ||
    value.includes("invalid code") ||
    value.includes("code has been used") ||
    value.includes("code expired") ||
    value.includes("invalid_grant")
  ) return "auth_code_error";
  if (
    value.includes("permission") ||
    value.includes("not authorized") ||
    value.includes("not authorised")
  ) return "permission_error";
  return "token_exchange_error";
}

export async function GET(request: NextRequest) {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!appId || !appSecret) return redirectWithStatus(request, "setup");
  if (!code || !state) {
    return redirectWithStatus(request, "state_error");
  }

  let isAndroidFlow = verifyAndroidOAuthState(state);
  let stateValidatedServerSide = false;
  let androidStateRecord: { deviceKeyHash: string | null } | null = null;

  if (!isAndroidFlow && isStoredAndroidOAuthState(state)) {
    try {
      androidStateRecord = await consumeStoredAndroidOAuthState(state);
      stateValidatedServerSide = Boolean(androidStateRecord);
      isAndroidFlow = Boolean(androidStateRecord?.deviceKeyHash);
    } catch (error) {
      console.error("[Instagram OAuth] android_state_lookup_error", error);
      return redirectWithStatus(request, "android_state_error");
    }
  }

  if (
    !isAndroidFlow &&
    !stateValidatedServerSide &&
    (!expectedState || state !== expectedState)
  ) {
    return redirectWithStatus(request, "state_error");
  }

  const redirectUri =
    process.env.INSTAGRAM_REDIRECT_URI ??
    `${request.nextUrl.origin}/api/instagram/callback`;

  let accessToken = "";
  let expiresIn = 3600;

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

    if (!shortTokenResponse.ok) {
      const details = await shortTokenResponse.text();
      console.error("[Instagram OAuth] token_exchange_error", shortTokenResponse.status, details);
      const response = redirectWithStatus(request, classifyTokenExchangeError(details));
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    const shortToken = (await shortTokenResponse.json()) as {
      access_token?: string;
      user_id?: number | string;
    };

    if (!shortToken.access_token) {
      console.error("[Instagram OAuth] token_missing");
      const response = redirectWithStatus(request, "token_exchange_error");
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    accessToken = shortToken.access_token;

    const longTokenUrl = new URL("https://graph.instagram.com/access_token");
    longTokenUrl.searchParams.set("grant_type", "ig_exchange_token");
    longTokenUrl.searchParams.set("client_secret", appSecret);
    longTokenUrl.searchParams.set("access_token", accessToken);

    const longTokenResponse = await fetch(longTokenUrl, { cache: "no-store" });
    if (longTokenResponse.ok) {
      const longToken = (await longTokenResponse.json()) as {
        access_token?: string;
        expires_in?: number;
      };
      if (longToken.access_token) accessToken = longToken.access_token;
      if (typeof longToken.expires_in === "number") expiresIn = longToken.expires_in;
    } else {
      const details = await longTokenResponse.text();
      console.warn("[Instagram OAuth] long_token_exchange_failed; using short token", longTokenResponse.status, details);
    }

    const profileUrl = new URL("https://graph.instagram.com/v26.0/me");
    profileUrl.searchParams.set(
      "fields",
      "user_id,username,account_type,profile_picture_url,followers_count,follows_count",
    );
    profileUrl.searchParams.set("access_token", accessToken);

    const profileResponse = await fetch(profileUrl, { cache: "no-store" });

    if (!profileResponse.ok) {
      const details = await profileResponse.text();
      console.error("[Instagram OAuth] profile_error", profileResponse.status, details);
      const response = redirectWithStatus(request, "profile_error");
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    const profile = (await profileResponse.json()) as {
      id?: string;
      user_id?: string;
      username?: string;
      account_type?: string;
      profile_picture_url?: string;
      followers_count?: number;
      follows_count?: number;
    };

    if (!profile.username) {
      console.error("[Instagram OAuth] profile_missing_username", profile);
      const response = redirectWithStatus(request, "profile_error");
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const session = {
      accessToken,
      expiresAt,
      account: {
        id: String(profile.user_id ?? profile.id ?? shortToken.user_id ?? ""),
        username: profile.username,
        accountType: profile.account_type,
        profilePictureUrl: profile.profile_picture_url,
        followersCount: profile.followers_count,
        followsCount: profile.follows_count,
      },
    };

    if (isAndroidFlow) {
      try {
        const handoff = sealAndroidHandoff(session);

        if (androidStateRecord?.deviceKeyHash) {
          await savePendingAndroidSession(
            androidStateRecord.deviceKeyHash,
            handoff,
          );
          return NextResponse.redirect(
            new URL("/conectar/android-retorno?stored=1", request.url),
          );
        }

        const returnUrl = new URL("/conectar/android-retorno", request.url);
        returnUrl.searchParams.set("handoff", handoff);
        return NextResponse.redirect(returnUrl);
      } catch (error) {
        console.error("[Instagram OAuth] android_handoff_error", error);
        return redirectWithStatus(request, "session_error");
      }
    }

    let sealed: string;
    try {
      sealed = await sealInstagramSession(session);
    } catch (error) {
      console.error("[Instagram OAuth] session_error", error);
      const response = redirectWithStatus(request, "session_error");
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    const response = NextResponse.redirect(new URL("/conectar?status=connected", request.url));
    response.cookies.delete(OAUTH_STATE_COOKIE);
    response.cookies.set(SESSION_COOKIE, sealed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.min(expiresIn, 60 * 60 * 24 * 60),
    });
    return response;
  } catch (error) {
    console.error("[Instagram OAuth] internal_error", error);
    const response = redirectWithStatus(request, "internal_error");
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }
}
