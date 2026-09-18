import { NextRequest, NextResponse } from "next/server";
import { createCloudToken, getCloudIdentity } from "@/lib/cloud/auth";
import { cloudDatabaseConfigured } from "@/lib/cloud/database";

export async function GET(request: NextRequest) {
  const identity = await getCloudIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  return NextResponse.json({
    configured: cloudDatabaseConfigured(),
    token: createCloudToken(identity),
    account: {
      id: identity.ownerId,
      username: identity.username,
    },
  });
}
