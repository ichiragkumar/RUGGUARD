import { UserData, AnalysisResult, TweetData } from '../types';
import { TRUSTED_ACCOUNTS } from '../config/trustedAccounts';
import { TwitterService } from './TwitterService';

export class AnalysisService {
  private twitterService: TwitterService;

  constructor(twitterService: TwitterService) {
    this.twitterService = twitterService;
  }


  async analyzeUser(userId: string): Promise<AnalysisResult | null> {
    try {
      const user = await this.twitterService.getUserById(userId);
      if (!user) {
        console.error(`User ${userId} not found`);
        return null;
      }

      console.log(`Analyzing user: @${user.username} (${user.name})`);


      const [recentTweets, followingList] = await Promise.all([
        this.twitterService.getUserTweets(userId, 20),
        this.twitterService.getUserFollowing(userId, 200)
      ]);


      const accountAge = this.calculateAccountAge(user.created_at);
      const followerRatio = this.calculateFollowerRatio(user.public_metrics);
      const engagementRate = this.calculateEngagementRate(recentTweets, user.public_metrics.followers_count);
      const trustedFollowers = this.findTrustedFollowers(followingList);
      const redFlags = this.identifyRedFlags(user, recentTweets, followerRatio, accountAge);
      

      const trustScore = this.calculateTrustScore({
        accountAge,
        followerRatio,
        engagementRate,
        trustedFollowers: trustedFollowers.length,
        redFlags: redFlags.length,
        isVerified: user.verified,
        tweetCount: user.public_metrics.tweet_count
      });

      // Determine verdict
      const verdict = this.determineVerdict(trustScore, trustedFollowers.length, redFlags.length);
      
      // Generate summary
      const summary = this.generateSummary(user, trustScore, verdict, trustedFollowers, redFlags);

      return {
        username: user.username,
        trustScore,
        accountAge,
        followerRatio,
        engagementRate,
        trustedFollowers,
        redFlags,
        verdict,
        summary
      };

    } catch (error) {
      console.error('Error in analyzeUser:', error);
      return null;
    }
  }

  private calculateAccountAge(createdAt: string): number {
    const created = new Date(createdAt);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    return diffInDays;
  }

  private calculateFollowerRatio(metrics: UserData['public_metrics']): number {
    if (metrics.following_count === 0) return metrics.followers_count;
    return metrics.followers_count / metrics.following_count;
  }

  private calculateEngagementRate(tweets: any[], followerCount: number): number {
    if (tweets.length === 0 || followerCount === 0) return 0;
    
    const totalEngagement = tweets.reduce((sum, tweet) => {
      const metrics = tweet.public_metrics;
      return sum + metrics.like_count + metrics.retweet_count + metrics.reply_count;
    }, 0);

    return (totalEngagement / tweets.length) / followerCount * 100;
  }

  private findTrustedFollowers(followingList: string[]): string[] {
    return TRUSTED_ACCOUNTS.filter(trusted => 
      followingList.some(following => 
        following.toLowerCase() === trusted.toLowerCase()
      )
    );
  }

  private identifyRedFlags(user: UserData, tweets: any[], followerRatio: number, accountAge: number): string[] {
    const flags: string[] = [];

    // Account age red flags
    if (accountAge < 30) {
      flags.push('Very new account (less than 30 days)');
    }

    // Follower ratio red flags
    if (followerRatio > 100 && user.public_metrics.followers_count > 1000) {
      flags.push('Suspicious follower/following ratio');
    }

    if (followerRatio < 0.1 && user.public_metrics.followers_count < 100) {
      flags.push('Low follower engagement');
    }

    // Bio red flags
    if (user.description) {
      const bioLower = user.description.toLowerCase();
      const suspiciousKeywords = ['guaranteed', 'profit', 'investment', 'dm me', 'telegram', 'whatsapp'];
      if (suspiciousKeywords.some(keyword => bioLower.includes(keyword))) {
        flags.push('Suspicious keywords in bio');
      }
    }

    // Tweet pattern red flags
    if (tweets.length > 0) {
      const avgTimeGap = this.calculateAverageTimeBetweenTweets(tweets);
      if (avgTimeGap < 60) { // Less than 1 minute between tweets
        flags.push('Suspicious tweet frequency (potential bot)');
      }
    }

    // Lack of profile completeness
    if (!user.description || user.description.length < 10) {
      flags.push('Incomplete profile (no/minimal bio)');
    }

    return flags;
  }

  private calculateAverageTimeBetweenTweets(tweets: any[]): number {
    if (tweets.length < 2) return 0;

    let totalGap = 0;
    for (let i = 1; i < tweets.length; i++) {
      const prev = new Date(tweets[i-1].created_at);
      const curr = new Date(tweets[i].created_at);
      totalGap += Math.abs(prev.getTime() - curr.getTime()) / (1000 * 60); // in minutes
    }

    return totalGap / (tweets.length - 1);
  }

  private calculateTrustScore(factors: {
    accountAge: number;
    followerRatio: number;
    engagementRate: number;
    trustedFollowers: number;
    redFlags: number;
    isVerified: boolean;
    tweetCount: number;
  }): number {
    let score = 50; // Base score

    // Account age scoring
    if (factors.accountAge > 365) score += 15;
    else if (factors.accountAge > 180) score += 10;
    else if (factors.accountAge > 90) score += 5;
    else if (factors.accountAge < 30) score -= 15;

    // Trusted followers scoring (most important factor)
    score += Math.min(factors.trustedFollowers * 10, 30);

    // Verification bonus
    if (factors.isVerified) score += 10;

    // Red flags penalty
    score -= factors.redFlags * 8;

    // Follower ratio scoring
    if (factors.followerRatio > 0.5 && factors.followerRatio < 10) score += 5;
    else if (factors.followerRatio > 50) score -= 10;

    // Tweet activity scoring
    if (factors.tweetCount > 100) score += 5;
    else if (factors.tweetCount < 10) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private determineVerdict(trustScore: number, trustedFollowers: number, redFlags: number): 'TRUSTED' | 'CAUTION' | 'SUSPICIOUS' {
    // Auto-trust if followed by 3+ trusted accounts
    if (trustedFollowers >= 3) return 'TRUSTED';
    
    // Auto-suspicious if many red flags
    if (redFlags >= 3) return 'SUSPICIOUS';

    // Score-based determination
    if (trustScore >= 70) return 'TRUSTED';
    if (trustScore >= 40) return 'CAUTION';
    return 'SUSPICIOUS';
  }

  private generateSummary(user: UserData, trustScore: number, verdict: string, trustedFollowers: string[], redFlags: string[]): string {
    const accountAgeText = this.calculateAccountAge(user.created_at) > 365 ? 'established' : 'relatively new';
    const followerCount = user.public_metrics.followers_count;
    
    let summary = `🔍 Analysis for @${user.username}\n\n`;
    summary += `📊 Trust Score: ${trustScore}/100\n`;
    summary += `🎯 Verdict: ${this.getVerdictEmoji(verdict)} ${verdict}\n\n`;
    
    if (trustedFollowers.length > 0) {
      summary += `✅ Backed by ${trustedFollowers.length} trusted Solana accounts\n`;
      if (trustedFollowers.length <= 3) {
        summary += `   • ${trustedFollowers.join(', ')}\n`;
      }
    }
    
    summary += `📅 ${accountAgeText} account (${Math.floor(this.calculateAccountAge(user.created_at) / 30)} months)\n`;
    summary += `👥 ${followerCount.toLocaleString()} followers\n\n`;
    
    if (redFlags.length > 0) {
      summary += `⚠️ Red flags:\n`;
      redFlags.forEach(flag => {
        summary += `   • ${flag}\n`;
      });
    }

    summary += `\n🤖 Automated analysis by @projectrugguard`;
    
    return summary;
  }

  private getVerdictEmoji(verdict: string): string {
    switch (verdict) {
      case 'TRUSTED': return '✅';
      case 'CAUTION': return '⚠️';
      case 'SUSPICIOUS': return '🚨';
      default: return '❓';
    }
  }
}