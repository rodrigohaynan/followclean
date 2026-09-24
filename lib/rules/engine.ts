import type { InstagramAnalysis } from "@/lib/instagram/types";

export type ProfileDataSource =
  | "meta_business_discovery"
  | "extension"
  | "android"
  | "manual"
  | "unknown";

export type ProfileMetadata = {
  username: string;
  followersCount?: number;
  accountType?: string;
  dataSource: ProfileDataSource;
  updatedAt: string;
  parserVersion?: number;
};

export type ReciprocityCheck = {
  result: "follows" | "not_following";
  checkedAt: string;
  analysisCreatedAt: string;
  method: "manual";
};

export type CleanupSettings = {
  notFollowingBack: boolean;
  maxFollowers: number;
  reciprocityChecks: Record<string, ReciprocityCheck>;
};

/** A newer confirmation from either device wins during cloud/app restores. */
export function mergeReciprocityChecks(
  local: CleanupSettings["reciprocityChecks"] = {},
  remote: CleanupSettings["reciprocityChecks"] = {},
): CleanupSettings["reciprocityChecks"] {
  const result = { ...(local && typeof local === "object" ? local : {}) };
  if (!remote || typeof remote !== "object") return result;
  for (const [username, check] of Object.entries(remote)) {
    if (!check || (check.result !== "follows" && check.result !== "not_following") ||
        typeof check.checkedAt !== "string" || typeof check.analysisCreatedAt !== "string" ||
        check.method !== "manual") continue;
    const normalized = username.trim().toLowerCase().replace(/^@/, "");
    if (!normalized) continue;
    if (!result[normalized] || check.checkedAt > result[normalized].checkedAt) {
      result[normalized] = check;
    }
  }
  return result;
}

export type CleanupCandidate = {
  username: string;
  reasons: string[];
  followersCount?: number;
  accountType?: string;
  dataSource: ProfileDataSource;
  classification: "priority" | "review" | "above_limit";
};

export const DEFAULT_CLEANUP_SETTINGS: CleanupSettings = {
  notFollowingBack: true,
  maxFollowers: 2000,
  reciprocityChecks: {},
};

export function buildCleanupQueue(
  analysis: InstagramAnalysis,
  protectedUsernames: Iterable<string>,
  settings: CleanupSettings,
  metadata: Iterable<ProfileMetadata> = [],
  analysisCreatedAt = "",
): CleanupCandidate[] {
  const protectedSet = new Set(
    Array.from(protectedUsernames, (username) => username.toLowerCase()),
  );
  const metadataMap = new Map(
    Array.from(metadata, (item) => [item.username.toLowerCase(), item] as const),
  );

  if (!settings.notFollowingBack) return [];

  return analysis.notFollowingBack
    .filter((username) => !protectedSet.has(username.toLowerCase()))
    .filter((username) => !username.toLowerCase().startsWith("__deleted__"))
    .flatMap((username): CleanupCandidate[] => {
      const check = settings.reciprocityChecks?.[username.toLowerCase()];
      // Import and individual confirmation are independent methods. The
      // follower count obtained by the scanner does NOT confirm reciprocity.
      if (check?.result === "follows") return [];
      const secondCheckConfirmed =
        check?.result === "not_following" &&
        check.analysisCreatedAt === analysisCreatedAt &&
        check.method === "manual";
      const profile = metadataMap.get(username.toLowerCase());
      const profileIsUsable =
        profile?.dataSource !== "extension" ||
        (profile.parserVersion ?? 0) >= 2;
      const followersCount = profileIsUsable ? profile?.followersCount : undefined;

      const knownCount = typeof followersCount === "number";
      const aboveLimit =
        knownCount && followersCount > settings.maxFollowers;

      return [
        {
          username,
          followersCount,
          accountType: profileIsUsable ? profile?.accountType : undefined,
          dataSource: profileIsUsable ? (profile?.dataSource ?? "unknown") : "unknown",
          classification: !knownCount
            ? "review"
            : aboveLimit
              ? "above_limit"
              : secondCheckConfirmed
                ? "priority"
                : "review",
          reasons: [
            secondCheckConfirmed
              ? "Ausência de reciprocidade confirmada por importação + conferência manual"
              : "Não encontrado nos seguidores da exportação · segunda conferência pendente",
            knownCount
              ? `${followersCount.toLocaleString("pt-BR")} seguidores (${aboveLimit ? "acima" : "até"} ${settings.maxFollowers.toLocaleString("pt-BR")})`
              : "Quantidade de seguidores ainda desconhecida",
          ],
        },
      ];
    })
    .sort((a, b) => {
      if (a.classification !== b.classification) {
        const order = { priority: 0, review: 1, above_limit: 2 } as const;
        return order[a.classification] - order[b.classification];
      }
      if (typeof a.followersCount === "number" && typeof b.followersCount === "number") {
        return a.followersCount - b.followersCount;
      }
      return a.username.localeCompare(b.username);
    });
}
