import type { InstagramAnalysis } from "@/lib/instagram/types";

export type CleanupSettings = {
  notFollowingBack: boolean;
};

export type CleanupCandidate = {
  username: string;
  reasons: string[];
};

export const DEFAULT_CLEANUP_SETTINGS: CleanupSettings = {
  notFollowingBack: true,
};

export function buildCleanupQueue(
  analysis: InstagramAnalysis,
  protectedUsernames: Iterable<string>,
  settings: CleanupSettings,
): CleanupCandidate[] {
  const protectedSet = new Set(
    Array.from(protectedUsernames, (username) => username.toLowerCase()),
  );

  if (!settings.notFollowingBack) return [];

  return analysis.notFollowingBack
    .filter((username) => !protectedSet.has(username.toLowerCase()))
    .map((username) => ({
      username,
      reasons: ["Não segue você de volta"],
    }));
}
