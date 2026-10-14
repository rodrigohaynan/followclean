import { NextRequest, NextResponse } from "next/server";
import { createCloudToken, getCloudIdentity } from "@/lib/cloud/auth";
import { cloudDatabaseConfigured } from "@/lib/cloud/database";
import {
  LOCAL_PROFILE_COOKIE,
  readLocalProfileToken,
} from "@/lib/instagram/local-profile";

export async function GET(request: NextRequest) {
  const identity = await getCloudIdentity(request);
  if (identity) {
    return NextResponse.json({
      configured: cloudDatabaseConfigured(),
      token: createCloudToken(identity),
      mode: "official",
      account: {
        id: identity.ownerId,
        username: identity.username,
      },
    });
  }

  const personal = readLocalProfileToken(
    request.cookies.get(LOCAL_PROFILE_COOKIE)?.value,
  );
  if (personal) {
    // Personal accounts are deliberately local-only: expose the account to the
    // existing UI/scanner, but never mint a cloud token from an unverified @.
    return NextResponse.json({
      configured: false,
      token: null,
      mode: "personal",
      account: {
        id: personal.ownerId,
        username: personal.username,
      },
    });
  }

  return NextResponse.json({ error: "not_connected" }, { status: 401 });
}
