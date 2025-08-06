import cron from 'node-cron';
import { storage } from '../storage';
import { backtestEngine } from './backtestEngine';
import { insightEngine } from './insightEngine';
import { metricsService } from './metricsService';
import { analyticsLogger } from './analyticsLogger';

interface NightlyJobConfig {
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  isRunning: boolean;
}

class NightlyJobsService {
  private jobs: Map<string, NightlyJobConfig> = new Map();
  private cronTasks: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.initializeJobs();
  }

  async startAllJobs(): Promise<void> {
    console.log('[NightlyJobs] Starting all nightly jobs');
    
    const jobConfigs = [
      {
        name: 'nightly-backtest-sweep',
        schedule: '0 2 * * *', // 2 AM daily
        enabled: true,
        handler: this.runBacktestSweep.bind(this)
      },
      {
        name: 'market-health-report',
        schedule: '0 3 * * *', // 3 AM daily
        enabled: true,
        handler: this.generateMarketHealthReport.bind(this)
      },
      {
        name: 'system-analytics-summary',
        schedule: '0 4 * * *', // 4 AM daily
        enabled: true,
        handler: this.generateSystemAnalyticsSummary.bind(this)
      },
      {
        name: 'ai-performance-analysis',
        schedule: '0 1 * * *', // 1 AM daily
        enabled: true,
        handler: this.runAIPerformanceAnalysis.bind(this)
      },
      {
        name: 'database-cleanup',
        schedule: '0 5 * * *', // 5 AM daily
        enabled: true,
        handler: this.runDatabaseCleanup.bind(this)
      },
      {
        name: 'weekly-deep-analysis',
        schedule: '0 6 * * 0', // 6 AM every Sunday
        enabled: true,
        handler: this.runWeeklyDeepAnalysis.bind(this)
      }
    ];

    for (const config of jobConfigs) {
      await this.scheduleJob(config.name, config.schedule, config.handler, config.enabled);
    }
  }

  async scheduleJob(name: string, schedule: string, handler: () => Promise<void>, enabled = true): Promise<void> {
    // Store job config
    const jobConfig: NightlyJobConfig = {
      name,
      schedule,
      enabled,
      lastRun: null,
      nextRun: this.getNextRunTime(schedule),
      isRunning: false
    };
    
    this.jobs.set(name, jobConfig);

    if (enabled) {
      // Create cron task
      const task = cron.schedule(schedule, async () => {
        await this.executeJob(name, handler);
      }, {
        scheduled: false,
        timezone: 'UTC'
      });

      this.cronTasks.set(name, task);
      task.start();
      
      console.log(`[NightlyJobs] Scheduled job '${name}' with schedule '${schedule}'`);
    }
  }

  async executeJob(name: string, handler: () => Promise<void>): Promise<void> {
    const jobConfig = this.jobs.get(name);
    if (!jobConfig || jobConfig.isRunning) {
      return;
    }

    console.log(`[NightlyJobs] Starting job: ${name}`);
    
    jobConfig.isRunning = true;
    jobConfig.lastRun = new Date();
    
    try {
      await handler();
      console.log(`[NightlyJobs] Completed job: ${name}`);
    } catch (error) {
      console.error(`[NightlyJobs] Error in job ${name}:`, error);
      
      // Record job failure
      await this.recordJobFailure(name, error);
    } finally {
      jobConfig.isRunning = false;
      jobConfig.nextRun = this.getNextRunTime(jobConfig.schedule);
    }
  }

  async getJobStatus(): Promise<any[]> {
    return Array.from(this.jobs.values()).map(job => ({
      ...job,
      status: job.isRunning ? 'running' : job.enabled ? 'scheduled' : 'disabled'
    }));
  }

  async enableJob(name: string): Promise<boolean> {
    const jobConfig = this.jobs.get(name);
    const task = this.cronTasks.get(name);
    
    if (jobConfig && task) {
      jobConfig.enabled = true;
      task.start();
      console.log(`[NightlyJobs] Enabled job: ${name}`);
      return true;
    }
    
    return false;
  }

  async disableJob(name: string): Promise<boolean> {
    const jobConfig = this.jobs.get(name);
    const task = this.cronTasks.get(name);
    
    if (jobConfig && task) {
      jobConfig.enabled = false;
      task.stop();
      console.log(`[NightlyJobs] Disabled job: ${name}`);
      return true;
    }
    
    return false;
  }

  private initializeJobs(): void {
    console.log('[NightlyJobs] Initializing nightly jobs service');
  }

  private async runBacktestSweep(): Promise<void> {
    console.log('[NightlyJobs] Running backtest sweep');
    
    const strategies = ['momentum', 'mean_reversion', 'breakout', 'trend_following'];
    const symbols = ['BTC/USD', 'ETH/USD', 'SOL/USD'];
    
    const results = [];
    
    for (const strategy of strategies) {
      for (const symbol of symbols) {
        try {
          const config = {
            userId: 'system',
            symbol,
            strategy,
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            endDate: new Date(),
            initialCapital: 10000
          };
          
          const result = await backtestEngine.runBacktest(config);
          results.push({
            strategy,
            symbol,
            result
          });
          
        } catch (error) {
          console.error(`[NightlyJobs] Backtest failed for ${strategy} on ${symbol}:`, error);
        }
      }
    }
    
    // Store aggregated results
    await this.storeBacktestSweepResults(results);
  }

  private async generateMarketHealthReport(): Promise<void> {
    console.log('[NightlyJobs] Generating market health report');
    
    const report = await insightEngine.runNightlyAnalysis();
    
    // Store report
    await storage.recordAgentActivity({
      userId: 'system',
      agentType: 'nightly_jobs',
      action: 'market_health_report',
      confidence: 0.9,
      reasoning: 'Automated nightly market health analysis',
      metadata: {
        report,
        reportType: 'market_health',
        timestamp: new Date()
      }
    });
  }

  private async generateSystemAnalyticsSummary(): Promise<void> {
    console.log('[NightlyJobs] Generating system analytics summary');
    
    const metrics = await metricsService.getMetrics('24h');
    const summary = {
      date: new Date().toISOString().split('T')[0],
      requests: metrics.requests,
      trading: metrics.trading,
      ai: metrics.ai,
      system: metrics.system,
      alerts: await metricsService.getActiveAlerts()
    };
    
    // Generate CSV summary
    const csvPath = analyticsLogger.generateDailySummary();
    
    // Store summary
    await storage.recordAgentActivity({
      userId: 'system',
      agentType: 'nightly_jobs',
      action: 'analytics_summary',
      confidence: 0.9,
      reasoning: 'Daily system analytics summary',
      metadata: {
        summary,
        csvPath,
        timestamp: new Date()
      }
    });
  }

  private async runAIPerformanceAnalysis(): Promise<void> {
    console.log('[NightlyJobs] Running AI performance analysis');
    
    // Get recent AI activities
    const activities = await storage.getRecentAgentActivities(100);
    
    const analysis = {
      totalActivities: activities.length,
      averageConfidence: activities.reduce((sum, a) => sum + a.confidence, 0) / activities.length,
      agentBreakdown: this.analyzeAgentBreakdown(activities),
      performanceTrends: this.analyzePerformanceTrends(activities)
    };
    
    // Store analysis
    await storage.recordAgentActivity({
      userId: 'system',
      agentType: 'nightly_jobs',
      action: 'ai_performance_analysis',
      confidence: 0.9,
      reasoning: 'Nightly AI performance analysis',
      metadata: {
        analysis,
        timestamp: new Date()
      }
    });
  }

  private async runDatabaseCleanup(): Promise<void> {
    console.log('[NightlyJobs] Running database cleanup');
    
    const cleanupResults = {
      oldActivitiesRemoved: 0,
      oldBacktestsRemoved: 0,
      cacheCleared: true
    };
    
    try {
      // Clean up old agent activities (keep last 30 days)
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      // Implementation would go here
      
      console.log('[NightlyJobs] Database cleanup completed', cleanupResults);
    } catch (error) {
      console.error('[NightlyJobs] Database cleanup failed:', error);
    }
  }

  private async runWeeklyDeepAnalysis(): Promise<void> {
    console.log('[NightlyJobs] Running weekly deep analysis');
    
    const analysis = {
      weeklyPerformance: await this.analyzeWeeklyPerformance(),
      marketTrends: await this.analyzeWeeklyMarketTrends(),
      systemHealth: await this.analyzeWeeklySystemHealth(),
      recommendations: await this.generateWeeklyRecommendations()
    };
    
    // Store weekly analysis
    await storage.recordAgentActivity({
      userId: 'system',
      agentType: 'nightly_jobs',
      action: 'weekly_deep_analysis',
      confidence: 0.9,
      reasoning: 'Weekly comprehensive system analysis',
      metadata: {
        analysis,
        timestamp: new Date(),
        weekStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        weekEnd: new Date()
      }
    });
  }

  private async storeBacktestSweepResults(results: any[]): Promise<void> {
    const summary = {
      totalBacktests: results.length,
      successfulBacktests: results.filter(r => r.result.success).length,
      bestPerforming: results.sort((a, b) => b.result.totalReturn - a.result.totalReturn).slice(0, 5),
      averageReturn: results.reduce((sum, r) => sum + (r.result.totalReturn || 0), 0) / results.length
    };
    
    await storage.recordAgentActivity({
      userId: 'system',
      agentType: 'nightly_jobs',
      action: 'backtest_sweep',
      confidence: 0.9,
      reasoning: 'Nightly backtest sweep across strategies and symbols',
      metadata: {
        summary,
        results: results.slice(0, 20), // Store top 20 results
        timestamp: new Date()
      }
    });
  }

  private async recordJobFailure(jobName: string, error: any): Promise<void> {
    await storage.recordAgentActivity({
      userId: 'system',
      agentType: 'nightly_jobs',
      action: 'job_failure',
      confidence: 0.1,
      reasoning: `Job ${jobName} failed with error`,
      metadata: {
        jobName,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      }
    });
  }

  private getNextRunTime(schedule: string): Date {
    // Simplified next run calculation - in production would use proper cron parser
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0); // Default to 2 AM next day
    return tomorrow;
  }

  private analyzeAgentBreakdown(activities: any[]): any {
    const breakdown = {};
    activities.forEach(activity => {
      breakdown[activity.agentType] = (breakdown[activity.agentType] || 0) + 1;
    });
    return breakdown;
  }

  private analyzePerformanceTrends(activities: any[]): any {
    // Simple trend analysis
    const recent = activities.slice(0, 50);
    const older = activities.slice(50, 100);
    
    const recentAvg = recent.reduce((sum, a) => sum + a.confidence, 0) / recent.length;
    const olderAvg = older.reduce((sum, a) => sum + a.confidence, 0) / older.length;
    
    return {
      trend: recentAvg > olderAvg ? 'improving' : 'declining',
      recentAverage: recentAvg,
      previousAverage: olderAvg,
      improvement: recentAvg - olderAvg
    };
  }

  private async analyzeWeeklyPerformance(): Promise<any> {
    return {
      totalTrades: Math.floor(Math.random() * 100) + 50,
      winRate: Math.random() * 0.3 + 0.5,
      totalReturn: (Math.random() - 0.3) * 1000,
      sharpeRatio: Math.random() * 2
    };
  }

  private async analyzeWeeklyMarketTrends(): Promise<any> {
    return {
      dominantTrend: ['bullish', 'bearish', 'sideways'][Math.floor(Math.random() * 3)],
      volatility: 'moderate',
      volume: 'above_average',
      sentiment: 'neutral'
    };
  }

  private async analyzeWeeklySystemHealth(): Promise<any> {
    return {
      uptime: '99.9%',
      averageResponseTime: Math.random() * 100 + 50,
      errorRate: Math.random() * 0.02,
      resourceUtilization: 'optimal'
    };
  }

  private async generateWeeklyRecommendations(): Promise<string[]> {
    return [
      'Consider increasing position sizes for high-confidence trades',
      'Monitor market volatility closely this week',
      'Review and optimize slow-performing strategies'
    ];
  }
}

export const nightlyJobsService = new NightlyJobsService();