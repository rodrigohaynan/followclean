import { createHmac, timingSafeEqual } from "node:crypto";

export const LOCAL_PROFILE_COOKIE = "followclean_local_profile";

export type LocalInstagramProfile = {
  ownerId: string;
  username: string;
  mode: "personal";
  exp: number;
};

function getSecret() {
  const dedicated = process.env.FOLLOWCLEAN_SESSION_SECRET?.trim();
  if (dedicated) return `${dedicated}:local-profile-v1`;

  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (appSecret) return `${appSecret}:followclean-local-profile-v1`;

  throw new Error("Nenhum segredo de sessão está configurado.");
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/^@/, "");
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value, "utf8").digest("base64url");
}

export function validateLocalUsername(value: string) {
  const username = normalizeUsername(value);
  return /^[a-z0-9._]{1,30}$/.test(username) ? username : null;
}

export function localOwnerId(username: string) {
  const normalized = validateLocalUsername(username);
  if (!normalized) throw new Error("Usuário do Instagram inválido.");
  const digest = createHmac("sha256", getSecret())
    .update(`instagram-personal:${normalized}`, "utf8")
    .digest("hex")
    .slice(0, 24);
  return `personal_${digest}`;
}

export function createLocalProfileToken(username: string) {
  const normalized = validateLocalUsername(username);
  if (!normalized) throw new Error("Usuário do Instagram inválido.");

  const payload: LocalInstagramProfile = {
    ownerId: localOwnerId(normalized),
    username: normalized,
    mode: "personal",
    exp: Date.now() + 365 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function readLocalProfileToken(value?: string | null): LocalInstagramProfile | null {
  if (!value) return null;
  try {
    const [encoded, signature] = value.split(".");
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
    ) as LocalInstagramProfile;
    const username = validateLocalUsername(payload.username);
    if (
      !username ||
      payload.mode !== "personal" ||
      payload.ownerId !== localOwnerId(username) ||
      typeof payload.exp !== "number" ||
      payload.exp <= Date.now()
    ) {
      return null;
    }

    return { ...payload, username };
  } catch {
    return null;
  }
}
