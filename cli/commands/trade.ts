/**
 * Main Trading CLI Commands for Skippy Platform
 * 
 * Includes simulation, live trading controls, and kill switch
 */

import { Command } from 'commander';
import { simulateCommand } from './simulate';

export const tradeCommand = new Command('trade')
  .description('Trading operations and simulations')
  .addCommand(simulateCommand);

// Add kill switch command
const killSwitchCommand = new Command('kill-switch')
  .description('Emergency stop all trading operations')
  .option('-f, --force', 'Force stop without confirmation')
  .action(async (options) => {
    const { logger } = await import('../../server/utils/logger');
    
    if (!options.force) {
      const { confirm } = await import('enquirer');
      const response = await confirm({
        message: 'Are you sure you want to activate the kill switch? This will stop all trading immediately.'
      });
      
      if (!response) {
        console.log('Kill switch activation cancelled');
        return;
      }
    }

    try {
      console.log('🛑 KILL SWITCH ACTIVATED - STOPPING ALL TRADING');
      
      // Set emergency stop flag
      process.env.EMERGENCY_STOP = 'true';
      
      // If running in production, call the API
      if (process.env.NODE_ENV === 'production') {
        const response = await fetch('http://localhost:5000/api/admin/kill-switch', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.ADMIN_SECRET}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: 'CLI kill switch activated' })
        });
        
        if (response.ok) {
          console.log('✅ Kill switch activated successfully');
          const data = await response.json();
          console.log(`📊 Stopped ${data.cancelledOrders || 0} orders`);
          console.log(`💰 Protected portfolio value: $${data.portfolioValue || 0}`);
        } else {
          throw new Error(`Kill switch API call failed: ${response.status}`);
        }
      } else {
        console.log('⚠️ Development mode - kill switch simulated');
      }
      
      logger.info('Kill switch activated via CLI');
      
    } catch (error) {
      console.error('❌ Kill switch activation failed:', error);
      process.exit(1);
    }
  });

tradeCommand.addCommand(killSwitchCommand);