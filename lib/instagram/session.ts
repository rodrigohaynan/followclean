import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export type InstagramConnectedAccount = {
  id: string;
  username: string;
  accountType?: string;
  profilePictureUrl?: string;
  followersCount?: number;
  followsCount?: number;
};

export type InstagramSession = {
  accessToken: string;
  expiresAt?: string;
  account: InstagramConnectedAccount;
};

function getSecret() {
  const dedicated = process.env.FOLLOWCLEAN_SESSION_SECRET?.trim();
  if (dedicated) return dedicated;

  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (appSecret) return `${appSecret}:followclean-session-v1`;

  throw new Error("Nenhum segredo de sessão está configurado.");
}

function getKey() {
  return createHash("sha256").update(getSecret(), "utf8").digest();
}

export async function sealInstagramSession(session: InstagramSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export async function unsealInstagramSession(
  value?: string | null,
): Promise<InstagramSession | null> {
  if (!value) return null;

  try {
    const [ivPart, tagPart, dataPart] = value.split(".");
    if (!ivPart || !tagPart || !dataPart) return null;

    const decipher = createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]);

    const session = JSON.parse(decrypted.toString("utf8")) as InstagramSession;
    if (
      session.expiresAt &&
      new Date(session.expiresAt).getTime() <= Date.now()
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
