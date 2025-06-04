export interface TweetData {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
}

export interface UserData {
  id: string;
  username: string;
  name: string;
  description?: string;
  created_at: string;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  verified: boolean;
  verified_type?: string;
}

export interface AnalysisResult {
  username: string;
  trustScore: number;
  accountAge: number;
  followerRatio: number;
  engagementRate: number;
  trustedFollowers: string[];
  redFlags: string[];
  verdict: 'TRUSTED' | 'CAUTION' | 'SUSPICIOUS';
  summary: string;
}

export interface BotConfig {
  triggerPhrase: string;
  monitorAccount?: string;
  checkInterval: number;
  maxTweetsPerCheck: number;
}