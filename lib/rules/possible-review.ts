import type { ProfileMetadata } from "@/lib/rules/engine";

// Only accounts with a usable prior count STRICTLY above the configured limit
// are excluded. Unknown / old-extension / invalid counts remain reviewable.
export function possibleReviewCandidates(
  usernames: string[],
  metadata: ProfileMetadata[],
  maxFollowers: number,
): string[] {
  const counts = new Map(metadata.map((profile) => [
    profile.username.trim().toLowerCase(),
    profile,
  ] as const));
  return Array.from(new Set(usernames
    .map((username) => username.trim().toLowerCase().replace(/^@/, ""))
    .filter((username) => {
      if (!/^[a-z0-9._]{1,30}$/.test(username) || username.startsWith("__deleted__")) return false;
      const profile = counts.get(username);
      const count = profile?.followersCount;
      if (profile?.dataSource === "extension" && (profile.parserVersion ?? 0) < 2) return true;
      return !(typeof count === "number" && Number.isFinite(count) && count >= 0 &&
        count > maxFollowers);
    })
  )).sort((a, b) => a.localeCompare(b));
}
