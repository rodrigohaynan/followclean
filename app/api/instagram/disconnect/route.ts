import { NextRequest, NextResponse } from "next/server";
import { LOCAL_PROFILE_COOKIE } from "@/lib/instagram/local-profile";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/conectar?status=disconnected", request.url),
    303,
  );
  response.cookies.delete("followclean_ig_session");
  response.cookies.delete("followclean_ig_oauth_state");
  response.cookies.delete(LOCAL_PROFILE_COOKIE);
  return response;
}
