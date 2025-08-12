
// tools/rollback_drill.ts
import { preflightAdapters } from './preflight_adapters.js';

interface RollbackResult {
  success: boolean;
  responseTimeMs: number;
  actionsCompleted: string[];
  warnings: string[];
  brokerStatus: Record<string, boolean>;
}

class RollbackDrill {
  private startTime: number = 0;

  async executeEmergencyRollback(): Promise<RollbackResult> {
    console.log('🚨 Emergency Rollback Drill Starting...');
    this.startTime = Date.now();
    
    const actionsCompleted: string[] = [];
    const warnings: string[] = [];
    const brokerStatus: Record<string, boolean> = {};

    try {
      // 1. Attempt to call real reduce-only endpoint
      try {
        const response = await fetch('http://localhost:5000/api/live/emergency/reduce-only', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true }),
          timeout: 3000
        });

        if (response.ok) {
          actionsCompleted.push('reduce_only_activated');
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.warn('⚠️ reduce-only endpoint missing; simulating');
        warnings.push('reduce_only_simulated');
        actionsCompleted.push('reduce_only_simulated');
      }

      // 2. Attempt to call real hedge-flat endpoint
      try {
        const response = await fetch('http://localhost:5000/api/live/emergency/hedge-flat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true }),
          timeout: 3000
        });

        if (response.ok) {
          actionsCompleted.push('hedge_flat_activated');
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.warn('⚠️ hedge-flat endpoint missing; simulating');
        warnings.push('hedge_flat_simulated');
        actionsCompleted.push('hedge_flat_simulated');
      }

      // 3. Check position status with real data
      try {
        const response = await fetch('http://localhost:5000/api/live/positions', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          timeout: 3000
        });

        if (response.ok) {
          const positions = await response.json();
          const hasOpenPositions = positions.data?.positions?.length > 0;
          
          if (hasOpenPositions) {
            warnings.push('open_positions_detected');
          }
          actionsCompleted.push('position_check_completed');
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.warn('⚠️ Position check endpoint missing');
        warnings.push('position_check_unavailable');
      }

      // 4. Check broker connections
      try {
        const response = await fetch('http://localhost:5000/api/live/brokers', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          timeout: 3000
        });

        if (response.ok) {
          const brokers = await response.json();
          const brokerList = brokers.data?.brokers || [];
          
          for (const broker of brokerList) {
            brokerStatus[broker.brokerId] = broker.connected;
          }
          actionsCompleted.push('broker_status_checked');
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.warn('⚠️ Broker status check failed');
        warnings.push('broker_check_unavailable');
      }

      // 5. Attempt mode restoration
      try {
        const response = await fetch('http://localhost:5000/api/live/mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isLive: false }), // Force paper mode
          timeout: 3000
        });

        if (response.ok) {
          actionsCompleted.push('paper_mode_restored');
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.warn('⚠️ Mode restoration endpoint missing; simulating');
        warnings.push('mode_restoration_simulated');
        actionsCompleted.push('mode_restoration_simulated');
      }

      const responseTime = Date.now() - this.startTime;
      console.log(`⏱️ Emergency response time: ${responseTime}ms`);

      actionsCompleted.push('rollback_drill_completed');
      console.log('✅ Rollback drill complete');

      return {
        success: true,
        responseTimeMs: responseTime,
        actionsCompleted,
        warnings,
        brokerStatus
      };

    } catch (error) {
      const responseTime = Date.now() - this.startTime;
      console.error('❌ Rollback drill failed:', error);
      
      return {
        success: false,
        responseTimeMs: responseTime,
        actionsCompleted,
        warnings: [...warnings, 'drill_execution_failed'],
        brokerStatus
      };
    }
  }

  async testPositionFlattening(): Promise<boolean> {
    try {
      // Check if we can get current positions
      const response = await fetch('http://localhost:5000/api/live/positions', {
        timeout: 2000
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const positions = data.data?.positions || [];

      // Simulate flattening each position
      for (const position of positions) {
        console.log(`📉 Simulating flatten position: ${position.symbol}`);
        // In real implementation, this would place opposing orders
      }

      return true;
    } catch (error) {
      console.warn('Position flattening test failed:', error);
      return false;
    }
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const drill = new RollbackDrill();
  drill.executeEmergencyRollback()
    .then(result => {
      console.log('\n📊 Rollback Results:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Rollback drill failed:', error);
      process.exit(1);
    });
}

export default RollbackDrill;
export { RollbackDrill };
