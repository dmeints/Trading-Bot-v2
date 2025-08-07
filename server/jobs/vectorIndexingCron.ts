import cron from 'node-cron';
import { vectorService } from '../services/vectorService';
import { logger } from '../utils/logger';

export function startVectorIndexingCron() {
  // Run vector indexing every hour at minute 15
  cron.schedule('15 * * * *', async () => {
    try {
      logger.info('Starting scheduled vector indexing');
      
      await vectorService.initialize();
      
      const trades = await vectorService.indexTradeEvents();
      const signals = await vectorService.indexAISignals();
      const backtests = await vectorService.indexBacktestResults();
      
      logger.info('Scheduled vector indexing completed', { 
        trades, 
        signals, 
        backtests,
        total: trades + signals + backtests
      });
    } catch (error) {
      logger.error('Vector indexing cron job failed', { error });
    }
  }, {
    timezone: "UTC"
  });

  logger.info('Vector indexing cron job scheduled (every hour at :15)');
}