import { createHmac, timingSafeEqual } from "node:crypto";

type AndroidOAuthState = {
  kind: "android";
  nonce: string;
  exp: number;
};

function getStateSecret() {
  const dedicated = process.env.FOLLOWCLEAN_SESSION_SECRET?.trim();
  if (dedicated) return `${dedicated}:instagram-oauth-state-v1`;

  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (appSecret) return `${appSecret}:instagram-oauth-state-v1`;

  throw new Error("Nenhum segredo disponível para assinar o state do OAuth.");
}

function sign(payload: string) {
  return createHmac("sha256", getStateSecret())
    .update(payload, "utf8")
    .digest("base64url");
}

export function createAndroidOAuthState() {
  const payload: AndroidOAuthState = {
    kind: "android",
    nonce: crypto.randomUUID().replaceAll("-", ""),
    exp: Date.now() + 10 * 60 * 1000,
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `fcandroid.${encoded}.${sign(encoded)}`;
}

export function verifyAndroidOAuthState(value?: string | null) {
  if (!value?.startsWith("fcandroid.")) return false;

  try {
    const [, encoded, signature] = value.split(".");
    if (!encoded || !signature) return false;

    const expected = sign(encoded);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return false;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as AndroidOAuthState;

    return (
      payload.kind === "android" &&
      typeof payload.nonce === "string" &&
      payload.nonce.length >= 16 &&
      typeof payload.exp === "number" &&
      payload.exp > Date.now()
    );
  } catch {
    return false;
  }
}
