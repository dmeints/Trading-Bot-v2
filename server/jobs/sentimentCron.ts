import cron from 'node-cron';
import { sentimentService } from '../services/sentimentService';
import { logger } from '../utils/logger';

export function startSentimentCron() {
  // Run sentiment data fetch daily at midnight UTC
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('Starting scheduled sentiment data fetch');
      
      await sentimentService.initialize();
      const sentimentData = await sentimentService.fetchDailySentiment();
      
      logger.info('Scheduled sentiment data fetch completed', { 
        recordsCreated: sentimentData.length
      });
    } catch (error) {
      logger.error('Sentiment data fetch cron job failed', { error });
    }
  }, {
    timezone: "UTC"
  });

  logger.info('Sentiment data fetch cron job scheduled (daily at midnight UTC)');
}