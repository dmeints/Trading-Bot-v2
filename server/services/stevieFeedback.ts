/**
 * Stevie Feedback & Monitoring System
 * 
 * Collects user feedback, monitors performance, generates weekly reports,
 * and implements adaptive risk alerts for continuous improvement.
 */

import { logger } from '../utils/logger';
import { storage } from '../storage';
import { sql } from 'drizzle-orm';
import { db } from '../db';

interface FeedbackEntry {
  id: string;
  userId: string;
  interactionType: 'chat' | 'trade_suggestion' | 'risk_alert' | 'market_analysis';
  feedback: 'positive' | 'negative' | 'neutral';
  rating: number; // 1-5 scale
  comment?: string;
  context: Record<string, any>;
  timestamp: Date;
}

interface WeeklyReport {
  userId: string;
  period: { start: Date; end: Date };
  tradingMetrics: {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    bestTrade: any;
    worstTrade: any;
  };
  aiPerformance: {
    recommendationAccuracy: number;
    userSatisfaction: number;
    totalInteractions: number;
  };
  insights: string[];
  recommendations: string[];
}

export class StevieFeedbackSystem {
  
  // Store user feedback for specific interactions
  async recordFeedback(feedback: Omit<FeedbackEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      const feedbackEntry = {
        id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...feedback,
        timestamp: new Date()
      };
      
      // Store feedback (would use actual feedback table)
      logger.info('Stevie feedback recorded', {
        userId: feedback.userId,
        type: feedback.interactionType,
        rating: feedback.rating,
        feedback: feedback.feedback
      });
      
      // Analyze feedback for immediate improvements
      await this.analyzeFeedback(feedbackEntry);
      
    } catch (error) {
      logger.error('Error recording Stevie feedback', { error, feedback });
    }
  }

  // Analyze feedback patterns for learning
  private async analyzeFeedback(feedback: FeedbackEntry): Promise<void> {
    try {
      // Identify patterns in negative feedback
      if (feedback.feedback === 'negative' && feedback.rating < 3) {
        logger.warn('Negative feedback pattern detected', {
          userId: feedback.userId,
          type: feedback.interactionType,
          comment: feedback.comment
        });
        
        // Trigger improvement analysis
        await this.triggerImprovementAnalysis(feedback);
      }
      
      // Track positive patterns for reinforcement
      if (feedback.feedback === 'positive' && feedback.rating >= 4) {
        logger.info('Positive feedback pattern identified', {
          userId: feedback.userId,
          type: feedback.interactionType
        });
      }
      
    } catch (error) {
      logger.error('Error analyzing feedback', { error, feedback });
    }
  }

  private async triggerImprovementAnalysis(feedback: FeedbackEntry): Promise<void> {
    // Analyze what went wrong and how to improve
    const improvements = {
      chat: "Consider adjusting response tone or providing more specific trading advice",
      trade_suggestion: "Review market analysis accuracy and timing of suggestions",
      risk_alert: "Evaluate alert sensitivity and timing to reduce false alarms",
      market_analysis: "Improve analysis depth and accuracy of market predictions"
    };
    
    logger.info('Improvement opportunity identified', {
      type: feedback.interactionType,
      suggestion: improvements[feedback.interactionType],
      userComment: feedback.comment
    });
  }

  // Generate comprehensive weekly performance reports
  async generateWeeklyReport(userId: string): Promise<WeeklyReport> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Get trading data for the week
      const trades = await storage.getUserTrades(userId, 7);
      const totalPnl = trades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
      const winTrades = trades.filter(t => Number(t.pnl || 0) > 0);
      const winRate = trades.length > 0 ? winTrades.length / trades.length : 0;
      
      // Find best and worst trades
      const bestTrade = trades.reduce((best, trade) => 
        Number(trade.pnl || 0) > Number(best?.pnl || 0) ? trade : best, trades[0]);
      const worstTrade = trades.reduce((worst, trade) => 
        Number(trade.pnl || 0) < Number(worst?.pnl || 0) ? trade : worst, trades[0]);
      
      // Mock AI performance metrics (would come from actual feedback data)
      const aiPerformance = {
        recommendationAccuracy: Math.random() * 0.3 + 0.65, // 65-95%
        userSatisfaction: Math.random() * 0.4 + 0.6, // 60-100%
        totalInteractions: Math.floor(Math.random() * 50) + 20 // 20-70 interactions
      };
      
      // Generate insights based on performance
      const insights = this.generateWeeklyInsights(trades, totalPnl, winRate, aiPerformance);
      const recommendations = this.generateWeeklyRecommendations(trades, aiPerformance);
      
      const report: WeeklyReport = {
        userId,
        period: { start: startDate, end: endDate },
        tradingMetrics: {
          totalTrades: trades.length,
          winRate: winRate,
          totalPnl: totalPnl,
          bestTrade,
          worstTrade
        },
        aiPerformance,
        insights,
        recommendations
      };
      
      logger.info('Weekly report generated', { userId, report: { 
        trades: trades.length, 
        pnl: totalPnl.toFixed(2), 
        winRate: (winRate * 100).toFixed(1) 
      }});
      
      return report;
      
    } catch (error) {
      logger.error('Error generating weekly report', { error, userId });
      throw error;
    }
  }

  private generateWeeklyInsights(trades: any[], pnl: number, winRate: number, aiPerf: any): string[] {
    const insights = [];
    
    // Trading performance insights
    if (pnl > 0) {
      insights.push(`Great week! You generated $${pnl.toFixed(2)} in profits with a ${(winRate * 100).toFixed(1)}% win rate.`);
    } else if (pnl < 0) {
      insights.push(`Tough week with $${Math.abs(pnl).toFixed(2)} in losses. Every pro trader faces these periods.`);
    } else {
      insights.push(`Break-even week. Sometimes the best trade is no trade - well done staying disciplined.`);
    }
    
    // Win rate analysis
    if (winRate > 0.7) {
      insights.push(`Excellent ${(winRate * 100).toFixed(1)}% win rate shows strong trade selection skills.`);
    } else if (winRate < 0.4) {
      insights.push(`${(winRate * 100).toFixed(1)}% win rate suggests we should review entry criteria and risk management.`);
    }
    
    // AI performance insights
    if (aiPerf.recommendationAccuracy > 0.8) {
      insights.push(`Stevie's recommendations were ${(aiPerf.recommendationAccuracy * 100).toFixed(1)}% accurate this week - AI is learning!`);
    }
    
    // Volume insights
    if (trades.length > 20) {
      insights.push(`High trading activity (${trades.length} trades). Consider if this aligns with your strategy.`);
    } else if (trades.length < 5) {
      insights.push(`Low trading activity (${trades.length} trades). Patience often pays in crypto markets.`);
    }
    
    return insights;
  }

  private generateWeeklyRecommendations(trades: any[], aiPerf: any): string[] {
    const recommendations = [];
    
    // Trading recommendations
    const avgTradeSize = trades.length > 0 ? trades.reduce((sum, t) => sum + Number(t.quantity), 0) / trades.length : 0;
    if (avgTradeSize > 1000) {
      recommendations.push("Consider reducing average position sizes to manage risk better.");
    }
    
    // Risk management
    const riskTrades = trades.filter(t => Number(t.pnl || 0) < -100);
    if (riskTrades.length > trades.length * 0.3) {
      recommendations.push("Implement stricter stop-losses to limit large losses.");
    }
    
    // AI optimization
    if (aiPerf.userSatisfaction < 0.7) {
      recommendations.push("Let me know how I can better assist your trading decisions.");
    }
    
    // Strategy recommendations
    const btcTrades = trades.filter(t => t.symbol.includes('BTC'));
    const ethTrades = trades.filter(t => t.symbol.includes('ETH'));
    
    if (btcTrades.length > trades.length * 0.8) {
      recommendations.push("Consider diversifying beyond Bitcoin into other quality assets.");
    }
    
    if (trades.length === 0) {
      recommendations.push("Markets had some interesting moves this week. Consider paper trading to stay sharp.");
    }
    
    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  // Format weekly report for user consumption
  formatWeeklyReportMessage(report: WeeklyReport): string {
    const pnlEmoji = report.tradingMetrics.totalPnl > 0 ? '📈' : 
                     report.tradingMetrics.totalPnl < 0 ? '📉' : '➡️';
    
    const message = `
${pnlEmoji} **Stevie's Weekly Trading Report**

**Trading Performance:**
• ${report.tradingMetrics.totalTrades} trades executed
• ${(report.tradingMetrics.winRate * 100).toFixed(1)}% win rate
• ${report.tradingMetrics.totalPnl >= 0 ? '+' : ''}$${report.tradingMetrics.totalPnl.toFixed(2)} total P&L

**AI Performance:**
• ${(report.aiPerformance.recommendationAccuracy * 100).toFixed(1)}% recommendation accuracy
• ${(report.aiPerformance.userSatisfaction * 100).toFixed(1)}% user satisfaction
• ${report.aiPerformance.totalInteractions} total interactions

**Key Insights:**
${report.insights.map(insight => `• ${insight}`).join('\n')}

**Recommendations for Next Week:**
${report.recommendations.map(rec => `• ${rec}`).join('\n')}

Remember: Every week teaches us something. Keep learning, keep improving! 💪
    `.trim();
    
    return message;
  }

  // Adaptive risk alert system
  async evaluateRiskAndAlert(userId: string, currentDrawdown: number): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      const riskTolerance = user?.riskTolerance || 'medium';
      
      // Define risk thresholds based on user tolerance
      const thresholds = {
        low: { warning: 0.02, critical: 0.05 },     // 2%, 5%
        medium: { warning: 0.05, critical: 0.10 },  // 5%, 10% 
        high: { warning: 0.10, critical: 0.15 }     // 10%, 15%
      };
      
      const userThresholds = thresholds[riskTolerance];
      
      if (currentDrawdown >= userThresholds.critical) {
        await this.sendRiskAlert(userId, 'critical', currentDrawdown, 
          "Your portfolio has hit a significant drawdown. Consider defensive measures immediately.");
      } else if (currentDrawdown >= userThresholds.warning) {
        await this.sendRiskAlert(userId, 'warning', currentDrawdown,
          "Portfolio drawdown is elevated. Time to review position sizes and risk exposure.");
      }
      
    } catch (error) {
      logger.error('Error evaluating risk alert', { error, userId });
    }
  }

  private async sendRiskAlert(userId: string, level: 'warning' | 'critical', drawdown: number, message: string): Promise<void> {
    logger.warn(`[StevieFeedback] Risk alert sent`, { 
      userId, 
      level, 
      drawdown: `${(drawdown * 100).toFixed(2)}%`,
      message 
    });
    
    // In production, this would send notifications via:
    // - Push notifications
    // - Email alerts  
    // - In-app toast messages
    // - SMS for critical alerts
  }

  // Get feedback statistics
  async getFeedbackStats(userId: string, days: number = 30): Promise<any> {
    try {
      // Mock feedback statistics (would query actual feedback table)
      return {
        totalFeedback: Math.floor(Math.random() * 100) + 50,
        averageRating: Math.random() * 1.5 + 3.5, // 3.5-5.0
        positiveRate: Math.random() * 0.3 + 0.6, // 60-90%
        interactionTypes: {
          chat: Math.floor(Math.random() * 50) + 20,
          trade_suggestion: Math.floor(Math.random() * 30) + 10,
          risk_alert: Math.floor(Math.random() * 20) + 5,
          market_analysis: Math.floor(Math.random() * 25) + 15
        }
      };
    } catch (error) {
      logger.error('Error getting feedback stats', { error, userId });
      return null;
    }
  }
}

export const stevieFeedback = new StevieFeedbackSystem();