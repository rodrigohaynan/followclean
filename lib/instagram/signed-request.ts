import { createHmac, timingSafeEqual } from "node:crypto";

type MetaSignedRequestPayload = {
  user_id?: string;
  algorithm?: string;
  issued_at?: number;
  [key: string]: unknown;
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

export function verifyMetaSignedRequest(
  signedRequest: string,
  appSecret: string,
): MetaSignedRequestPayload | null {
  const [encodedSignature, encodedPayload] = signedRequest.split(".");
  if (!encodedSignature || !encodedPayload) return null;

  const signature = decodeBase64Url(encodedSignature);
  const expected = createHmac("sha256", appSecret).update(encodedPayload).digest();

  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      decodeBase64Url(encodedPayload).toString("utf8"),
    ) as MetaSignedRequestPayload;

    if (payload.algorithm && payload.algorithm.toUpperCase() !== "HMAC-SHA256") {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
