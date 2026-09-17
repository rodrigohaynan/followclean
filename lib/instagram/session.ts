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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSecret() {
  const secret = process.env.FOLLOWCLEAN_SESSION_SECRET;
  if (!secret) throw new Error("FOLLOWCLEAN_SESSION_SECRET não configurado.");
  return secret;
}

async function getKey() {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(getSecret()));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

export async function sealInstagramSession(session: InstagramSession) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(session)),
  );

  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function unsealInstagramSession(value?: string | null): Promise<InstagramSession | null> {
  if (!value) return null;
  try {
    const [ivPart, dataPart] = value.split(".");
    if (!ivPart || !dataPart) return null;
    const key = await getKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(ivPart) },
      key,
      fromBase64Url(dataPart),
    );
    const session = JSON.parse(decoder.decode(decrypted)) as InstagramSession;
    if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
