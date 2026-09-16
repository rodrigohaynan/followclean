export type InstagramAnalysis = {
  followers: string[];
  following: string[];
  mutual: string[];
  notFollowingBack: string[];
  followersOnly: string[];
  totals: {
    followers: number;
    following: number;
    mutual: number;
    notFollowingBack: number;
    followersOnly: number;
  };
};

export type ImportedTextFile = {
  name: string;
  text: string;
};
