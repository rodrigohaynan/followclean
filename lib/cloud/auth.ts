import { createHmac, timingSafeEqual } from "node:crypto";
import { unsealInstagramSession } from "@/lib/instagram/session";
import type { NextRequest } from "next/server";

export type CloudIdentity = {
  ownerId: string;
  username: string;
};

type CloudTokenPayload = CloudIdentity & {
  exp: number;
};

function getSecret() {
  const dedicated = process.env.FOLLOWCLEAN_CLOUD_SECRET?.trim();
  if (dedicated) return dedicated;

  const sessionSecret = process.env.FOLLOWCLEAN_SESSION_SECRET?.trim();
  if (sessionSecret) return `${sessionSecret}:cloud-sync-v1`;

  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (appSecret) return `${appSecret}:cloud-sync-v1`;

  throw new Error("Nenhum segredo disponível para a sincronização em nuvem.");
}

function sign(encoded: string) {
  return createHmac("sha256", getSecret())
    .update(encoded, "utf8")
    .digest("base64url");
}

export function createCloudToken(identity: CloudIdentity) {
  const payload: CloudTokenPayload = {
    ...identity,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `fccloud.${encoded}.${sign(encoded)}`;
}

export function verifyCloudToken(value?: string | null): CloudIdentity | null {
  if (!value?.startsWith("fccloud.")) return null;

  try {
    const [, encoded, signature] = value.split(".");
    if (!encoded || !signature) return null;

    const expected = sign(encoded);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as CloudTokenPayload;

    if (
      !payload.ownerId ||
      !payload.username ||
      typeof payload.exp !== "number" ||
      payload.exp <= Date.now()
    ) {
      return null;
    }

    return {
      ownerId: String(payload.ownerId),
      username: String(payload.username).toLowerCase(),
    };
  } catch {
    return null;
  }
}

export async function getCloudIdentity(
  request: NextRequest,
): Promise<CloudIdentity | null> {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const identity = verifyCloudToken(auth.slice(7).trim());
    if (identity) return identity;
  }

  const sealed = request.cookies.get("followclean_ig_session")?.value;
  const session = await unsealInstagramSession(sealed);
  if (!session?.account?.id || !session.account.username) return null;

  return {
    ownerId: String(session.account.id),
    username: session.account.username.toLowerCase(),
  };
}
