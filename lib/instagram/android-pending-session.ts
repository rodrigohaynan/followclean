import { ensureCloudSchema, getCloudSql } from "@/lib/cloud/database";
import { unsealAndroidHandoff } from "@/lib/instagram/android-handoff";
import { hashAndroidDeviceKey } from "@/lib/instagram/android-oauth-state-store";
import type { InstagramSession } from "@/lib/instagram/session";

export async function savePendingAndroidSession(
  deviceKeyHash: string,
  handoff: string,
) {
  await ensureCloudSchema();
  const sql = getCloudSql();

  await sql`
    DELETE FROM followclean_android_pending_sessions
    WHERE expires_at <= NOW()
  `;

  await sql`
    INSERT INTO followclean_android_pending_sessions
      (device_key_hash, handoff, expires_at)
    VALUES (${deviceKeyHash}, ${handoff}, NOW() + INTERVAL '10 minutes')
    ON CONFLICT (device_key_hash)
    DO UPDATE SET
      handoff = EXCLUDED.handoff,
      expires_at = EXCLUDED.expires_at,
      created_at = NOW()
  `;
}

export async function consumePendingAndroidSession(
  deviceKey: string,
): Promise<InstagramSession | null> {
  const normalized = deviceKey.trim();
  if (normalized.length < 16 || normalized.length > 200) return null;

  await ensureCloudSchema();
  const sql = getCloudSql();
  const deviceKeyHash = hashAndroidDeviceKey(normalized);

  const rows = await sql`
    DELETE FROM followclean_android_pending_sessions
    WHERE device_key_hash = ${deviceKeyHash}
      AND expires_at > NOW()
    RETURNING handoff
  `;

  const handoff = rows[0]?.handoff;
  return typeof handoff === "string"
    ? unsealAndroidHandoff(handoff)
    : null;
}
