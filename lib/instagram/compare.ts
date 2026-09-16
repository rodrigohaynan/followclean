import type { InstagramAnalysis } from "./types";

export function normalizeUsername(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function uniqueUsernames(values: string[]) {
  return Array.from(
    new Set(values.map(normalizeUsername).filter((value) => value.length > 0)),
  ).sort((a, b) => a.localeCompare(b));
}

export function compareInstagramLists(
  followersInput: string[],
  followingInput: string[],
): InstagramAnalysis {
  const followers = uniqueUsernames(followersInput);
  const following = uniqueUsernames(followingInput);
  const followerSet = new Set(followers);
  const followingSet = new Set(following);

  const mutual = following.filter((username) => followerSet.has(username));
  const notFollowingBack = following.filter(
    (username) => !followerSet.has(username),
  );
  const followersOnly = followers.filter(
    (username) => !followingSet.has(username),
  );

  return {
    followers,
    following,
    mutual,
    notFollowingBack,
    followersOnly,
    totals: {
      followers: followers.length,
      following: following.length,
      mutual: mutual.length,
      notFollowingBack: notFollowingBack.length,
      followersOnly: followersOnly.length,
    },
  };
}
