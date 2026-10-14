import { NextRequest, NextResponse } from "next/server";
import {
  createLocalProfileToken,
  LOCAL_PROFILE_COOKIE,
  validateLocalUsername,
} from "@/lib/instagram/local-profile";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const username = validateLocalUsername(String(form.get("username") ?? ""));
  if (!username) {
    return NextResponse.redirect(
      new URL("/conectar?status=personal_invalid", request.url),
      303,
    );
  }

  const response = NextResponse.redirect(
    new URL("/conectar?status=personal_connected", request.url),
    303,
  );
  response.cookies.set(LOCAL_PROFILE_COOKIE, createLocalProfileToken(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });

  // Selecting personal mode is an explicit profile switch. Clear the official
  // professional session so one browser cannot ambiguously expose two owners.
  response.cookies.delete("followclean_ig_session");
  response.cookies.delete("followclean_ig_oauth_state");
  return response;
}
