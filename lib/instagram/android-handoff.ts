import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { InstagramSession } from "@/lib/instagram/session";

type AndroidHandoffPayload = {
  session: InstagramSession;
  expiresAt: number;
};

function getSecret() {
  const dedicated = process.env.FOLLOWCLEAN_SESSION_SECRET?.trim();
  if (dedicated) return `${dedicated}:android-handoff-v1`;

  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (appSecret) return `${appSecret}:android-handoff-v1`;

  throw new Error("Nenhum segredo disponível para o handoff Android.");
}

function key() {
  return createHash("sha256").update(getSecret(), "utf8").digest();
}

export function sealAndroidHandoff(session: InstagramSession) {
  const payload: AndroidHandoffPayload = {
    session,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function unsealAndroidHandoff(value?: string | null): InstagramSession | null {
  if (!value) return null;

  try {
    const [ivPart, tagPart, dataPart] = value.split(".");
    if (!ivPart || !tagPart || !dataPart) return null;

    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]);

    const payload = JSON.parse(
      decrypted.toString("utf8"),
    ) as AndroidHandoffPayload;

    if (
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now() ||
      !payload.session?.accessToken ||
      !payload.session?.account?.username
    ) {
      return null;
    }

    return payload.session;
  } catch {
    return null;
  }
}
