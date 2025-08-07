/**
 * Stevie Scheduler - Background jobs for AI companion
 * 
 * Handles scheduled tasks for Stevie personality system:
 * - Daily tip generation
 * - Market sentiment analysis
 * - User engagement tracking
 * - Personality learning updates
 */

import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import SteviePersonality from '../services/steviePersonality';
import { storage } from '../storage';

class StevieScheduler {
  private initialized = false;

  // Start all Stevie background jobs
  start(): void {
    if (this.initialized) {
      logger.warn('Stevie scheduler already initialized');
      return;
    }

    try {
      // Daily market insights - 8:00 AM UTC
      this.scheduleDailyInsights();
      
      // Personality learning updates - every 6 hours
      this.schedulePersonalityLearning();
      
      // User engagement tracking - every hour
      this.scheduleEngagementTracking();
      
      this.initialized = true;
      logger.info('Stevie scheduler initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Stevie scheduler', { error });
    }
  }

  private scheduleDailyInsights(): void {
    // Daily market insights at 8:00 AM UTC
    cron.schedule('0 8 * * *', async () => {
      try {
        logger.info('[Stevie] Generating daily market insights');
        
        // This would integrate with market analysis services
        const dailyInsight = {
          date: new Date().toISOString().split('T')[0],
          tip: SteviePersonality.getDailyTip(),
          marketSentiment: 'neutral', // Would come from analysis
          keyLevels: [], // Would come from technical analysis
          riskLevel: 'medium'
        };
        
        logger.info('[Stevie] Daily insight generated', {
          insight: dailyInsight.tip.substring(0, 50) + '...'
        });
        
      } catch (error) {
        logger.error('[Stevie] Failed to generate daily insights', { error });
      }
    }, {
      timezone: 'UTC'
    });
  }

  private schedulePersonalityLearning(): void {
    // Personality learning updates every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      try {
        logger.info('[Stevie] Running personality learning update');
        
        // Analyze recent chat interactions for personality improvements
        // This would examine user feedback and conversation patterns
        
        // For now, log that the learning cycle ran
        logger.info('[Stevie] Personality learning cycle completed');
        
      } catch (error) {
        logger.error('[Stevie] Failed to run personality learning', { error });
      }
    });
  }

  private scheduleEngagementTracking(): void {
    // User engagement tracking every hour
    cron.schedule('0 * * * *', async () => {
      try {
        // Track user engagement metrics
        // This would analyze:
        // - Chat frequency
        // - Question types
        // - User satisfaction indicators
        // - Feature usage patterns
        
        logger.debug('[Stevie] Hourly engagement tracking completed');
        
      } catch (error) {
        logger.error('[Stevie] Failed to track engagement', { error });
      }
    });
  }

  // Generate personalized greeting based on user activity
  async generatePersonalizedGreeting(userId: string): Promise<string> {
    try {
      const user = await storage.getUser(userId);
      const positions = await storage.getUserPositions(userId);
      
      const baseGreeting = SteviePersonality.getGreetingMessage();
      let personalizedContent = baseGreeting.content;
      
      // Add personalization based on user data
      if (positions.length > 0) {
        const totalValue = positions.reduce((sum, pos) => 
          sum + (Number(pos.quantity) * Number(pos.currentPrice)), 0
        );
        
        if (totalValue > 10000) {
          personalizedContent += " Your portfolio's looking solid today - great work on building that position!";
        } else if (totalValue > 1000) {
          personalizedContent += " I see you're building a nice foundation with your trades. Keep it up!";
        }
      }
      
      // Add risk tolerance consideration
      if (user?.riskTolerance === 'high') {
        personalizedContent += " Ready to explore some opportunities today?";
      } else if (user?.riskTolerance === 'low') {
        personalizedContent += " Let's focus on steady, calculated moves today.";
      }
      
      return personalizedContent;
      
    } catch (error) {
      logger.error('[Stevie] Failed to generate personalized greeting', { error });
      return SteviePersonality.getGreetingMessage().content;
    }
  }

  // Check if scheduled jobs should run (useful for testing)
  getScheduleStatus(): Record<string, boolean> {
    return {
      dailyInsights: this.initialized,
      personalityLearning: this.initialized,
      engagementTracking: this.initialized
    };
  }

  stop(): void {
    if (!this.initialized) {
      return;
    }
    
    // Cron jobs will be stopped when the process exits
    this.initialized = false;
    logger.info('[Stevie] Scheduler stopped');
  }
}

export const stevieScheduler = new StevieScheduler();

// Auto-start if not in test environment
if (process.env.NODE_ENV !== 'test') {
  stevieScheduler.start();
}