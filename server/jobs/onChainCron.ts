import cron from 'node-cron';
import { onChainService } from '../services/onChainService';
import { logger } from '../utils/logger';

export function startOnChainCron() {
  // Run on-chain data ingestion every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      logger.info('Starting scheduled on-chain data ingestion');
      
      await onChainService.initialize();
      const events = await onChainService.fetchWhaleTransfers();
      
      logger.info('Scheduled on-chain data ingestion completed', { 
        eventsIngested: events.length
      });
    } catch (error) {
      logger.error('On-chain data ingestion cron job failed', { error });
    }
  }, {
    timezone: "UTC"
  });

  logger.info('On-chain data ingestion cron job scheduled (every 30 minutes)');
}