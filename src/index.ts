import dotenv from 'dotenv';
import cron from 'node-cron';
import { BotService } from './services/BotService';
import { BotConfig } from './types';
import { Logger } from './utils/logger';
dotenv.config();


const requiredEnvVars = [
  'TWITTER_API_KEY',
  'TWITTER_API_SECRET',
  'TWITTER_ACCESS_TOKEN',
  'TWITTER_ACCESS_TOKEN_SECRET',
  'TWITTER_BEARER_TOKEN'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}
const config: BotConfig = {
  triggerPhrase: process.env.TRIGGER_PHRASE || 'riddle me this',
  monitorAccount: process.env.MONITOR_ACCOUNT,
  checkInterval: parseInt(process.env.CHECK_INTERVAL_MINUTES || '2'),
  maxTweetsPerCheck: 20
};


const botService = new BotService(config);


async function main(): Promise<void> {
  Logger.info('🚀 Starting RUGGUARD X Bot');
  Logger.info(`⚙️  Configuration:`, config);


  await botService.run();

  const cronExpression = `*/${config.checkInterval} * * * *`;
  Logger.info(`⏰ Scheduling bot to run every ${config.checkInterval} minutes`);
  
  cron.schedule(cronExpression, async () => {
    Logger.info('🔄 Running scheduled bot check...');
    await botService.run();
  });

  Logger.info('✅ Bot is now running and monitoring for triggers');
}


process.on('SIGINT', () => {
  Logger.info('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  Logger.info('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});


process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  Logger.error('Uncaught Exception:', error);
  process.exit(1);
});


if (require.main === module) {
  main().catch((error) => {
    Logger.error('Fatal error starting bot:', error);
    process.exit(1);
  });
}