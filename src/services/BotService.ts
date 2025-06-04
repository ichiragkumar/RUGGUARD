import { TwitterService } from './TwitterService';
import { AnalysisService } from './AnalysisService';
import { BotConfig } from '../types';

export class BotService {
  private twitterService: TwitterService;
  private analysisService: AnalysisService;
  private config: BotConfig;
  private processedTweets: Set<string> = new Set();

  constructor(config: BotConfig) {
    this.config = config;
    this.twitterService = new TwitterService();
    this.analysisService = new AnalysisService(this.twitterService);
  }

  /**
   * Main bot execution loop
   */
  async run(): Promise<void> {
    console.log('🤖 RUGGUARD Bot starting...');
    console.log(`📡 Monitoring for phrase: "${this.config.triggerPhrase}"`);
    
    try {
      // Search for tweets containing the trigger phrase
      const query = `"${this.config.triggerPhrase}" -is:retweet`;
      const tweets = await this.twitterService.searchTriggerTweets(query, this.config.maxTweetsPerCheck);
      
      console.log(`🔍 Found ${tweets.length} potential trigger tweets`);

      for (const tweet of tweets) {
        // Skip if already processed
        if (this.processedTweets.has(tweet.id)) {
          continue;
        }

        await this.processTriggerTweet(tweet);
        this.processedTweets.add(tweet.id);
      }

    } catch (error) {
      console.error('❌ Error in bot run:', error);
    }
  }

  private async processTriggerTweet(triggerTweet: any): Promise<void> {
    try {
      console.log(`🎯 Processing trigger tweet: ${triggerTweet.id}`);

      // Check if this is a reply
      if (!triggerTweet.in_reply_to_user_id) {
        console.log('⏭️  Tweet is not a reply, skipping');
        return;
      }

      // Get the original tweet being replied to
      const replyingToTweetId = triggerTweet.referenced_tweets?.[0]?.id;
      if (!replyingToTweetId) {
        console.log('⏭️  Could not find original tweet ID, skipping');
        return;
      }

      const originalTweet = await this.twitterService.getTweetById(replyingToTweetId);
      if (!originalTweet) {
        console.log('⏭️  Could not fetch original tweet, skipping');
        return;
      }

      const targetUserId = originalTweet.author_id;
      if (!targetUserId) {
        console.log('⏭️  Could not find target user ID, skipping');
        return;
      }

      console.log(`🎯 Analyzing user ID: ${targetUserId}`);

      // Perform analysis
      const analysis = await this.analysisService.analyzeUser(targetUserId);
      if (!analysis) {
        console.log('❌ Analysis failed');
        return;
      }

      // Post reply with analysis
      const success = await this.twitterService.replyToTweet(
        triggerTweet.id,
        analysis.summary
      );

      if (success) {
        console.log(`✅ Successfully analyzed and replied for @${analysis.username}`);
      } else {
        console.log(`❌ Failed to post reply for @${analysis.username}`);
      }

    } catch (error) {
      console.error('❌ Error processing trigger tweet:', error);
    }
  }

  /**
   * Clean up old processed tweets to prevent memory issues
   */
  private cleanupProcessedTweets(): void {
    if (this.processedTweets.size > 1000) {
      const oldTweets = Array.from(this.processedTweets).slice(0, 500);
      oldTweets.forEach(tweetId => this.processedTweets.delete(tweetId));
      console.log('🧹 Cleaned up old processed tweets');
    }
  }
}