import { TwitterApi, TweetV2 } from 'twitter-api-v2';
import { TweetData, UserData } from '../types';

export class TwitterService {
  private client: TwitterApi;
  private readOnlyClient: TwitterApi;

  constructor() {
    this.client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
    });

    this.readOnlyClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!);
  }

  /**
   * Search for recent tweets containing the trigger phrase
   */
  async searchTriggerTweets(query: string, maxResults: number = 10): Promise<TweetV2[]> {
    try {
      const tweets = await this.readOnlyClient.v2.search(query, {
        max_results: maxResults,
        'tweet.fields': ['author_id', 'created_at', 'public_metrics', 'in_reply_to_user_id'],
        'user.fields': ['username', 'name', 'description', 'created_at', 'public_metrics', 'verified'],
        expansions: ['author_id', 'in_reply_to_user_id']
      });

      return tweets.data?.data || [];
    } catch (error) {
      console.error('Error searching tweets:', error);
      return [];
    }
  }

  /**
   * Get user data by user ID
   */
  async getUserById(userId: string): Promise<UserData | null> {
    try {
      const user = await this.readOnlyClient.v2.user(userId, {
        'user.fields': ['username', 'name', 'description', 'created_at', 'public_metrics', 'verified', 'verified_type']
      });

      return user.data as UserData;
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get user's recent tweets for analysis
   */
  async getUserTweets(userId: string, maxResults: number = 10): Promise<TweetV2[]> {
    try {
      const tweets = await this.readOnlyClient.v2.userTimeline(userId, {
        max_results: maxResults,
        'tweet.fields': ['created_at', 'public_metrics', 'lang'],
        exclude: ['retweets', 'replies']
      });

      return tweets.data?.data || [];
    } catch (error) {
      console.error(`Error fetching tweets for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get users that the target user is following
   */
  async getUserFollowing(userId: string, maxResults: number = 100): Promise<string[]> {
    try {
      const following = await this.readOnlyClient.v2.following(userId, {
        max_results: maxResults,
        'user.fields': ['username']
      });

      return following.data?.map(user => user.username) || [];
    } catch (error) {
      console.error(`Error fetching following for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Post a reply to a tweet
   */
  async replyToTweet(tweetId: string, text: string): Promise<boolean> {
    try {
      await this.client.v2.reply(text, tweetId);
      console.log(`Successfully replied to tweet ${tweetId}`);
      return true;
    } catch (error) {
      console.error(`Error replying to tweet ${tweetId}:`, error);
      return false;
    }
  }

  /**
   * Get tweet by ID
   */
  async getTweetById(tweetId: string): Promise<TweetV2 | null> {
    try {
      const tweet = await this.readOnlyClient.v2.singleTweet(tweetId, {
        'tweet.fields': ['author_id', 'created_at', 'public_metrics', 'in_reply_to_user_id'],
        expansions: ['author_id']
      });

      return tweet.data;
    } catch (error) {
      console.error(`Error fetching tweet ${tweetId}:`, error);
      return null;
    }
  }
}