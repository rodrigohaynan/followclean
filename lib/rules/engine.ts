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

export type CleanupSettings = {
  notFollowingBack: boolean;
  maxFollowers: number;
};

export type CleanupCandidate = {
  username: string;
  reasons: string[];
  followersCount?: number;
  accountType?: string;
  dataSource: ProfileDataSource;
  classification: "priority" | "review";
};

export const DEFAULT_CLEANUP_SETTINGS: CleanupSettings = {
  notFollowingBack: true,
  maxFollowers: 2000,
};

export function buildCleanupQueue(
  analysis: InstagramAnalysis,
  protectedUsernames: Iterable<string>,
  settings: CleanupSettings,
  metadata: Iterable<ProfileMetadata> = [],
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
      const profile = metadataMap.get(username.toLowerCase());
      const profileIsUsable =
        profile?.dataSource !== "extension" ||
        (profile.parserVersion ?? 0) >= 2;
      const followersCount = profileIsUsable ? profile?.followersCount : undefined;

      if (typeof followersCount === "number" && followersCount > settings.maxFollowers) {
        return [];
      }

      const knownCount = typeof followersCount === "number";
      return [
        {
          username,
          followersCount,
          accountType: profileIsUsable ? profile?.accountType : undefined,
          dataSource: profileIsUsable ? (profile?.dataSource ?? "unknown") : "unknown",
          classification: knownCount ? "priority" : "review",
          reasons: knownCount
            ? [
                "Não segue você de volta",
                `${followersCount.toLocaleString("pt-BR")} seguidores (até ${settings.maxFollowers.toLocaleString("pt-BR")})`,
              ]
            : ["Não segue você de volta", "Quantidade de seguidores ainda desconhecida"],
        },
      ];
    })
    .sort((a, b) => {
      if (a.classification !== b.classification) {
        return a.classification === "priority" ? -1 : 1;
      }
      if (typeof a.followersCount === "number" && typeof b.followersCount === "number") {
        return a.followersCount - b.followersCount;
      }
      return a.username.localeCompare(b.username);
    });
}
