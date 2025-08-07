/**
 * Stevie UI Personality Integration
 * 
 * Provides personality-infused UI notifications, toasts, modals,
 * and interactive elements throughout the trading platform.
 */

import { logger } from '../utils/logger';

export interface StevieNotification {
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  duration?: number;
  actionable?: boolean;
  cta?: {
    text: string;
    action: string;
  };
}

export interface StevieChartAnnotation {
  x: number;
  y: number;
  text: string;
  type: 'bullish' | 'bearish' | 'neutral' | 'warning';
  confidence: number;
}

export class StevieUIPersonality {
  
  // Trading action notifications with personality
  static getTradeNotification(
    action: 'buy' | 'sell', 
    symbol: string, 
    amount: number, 
    price: number,
    confidence?: number
  ): StevieNotification {
    const actionEmoji = action === 'buy' ? '🚀' : '💰';
    const actionVerb = action === 'buy' ? 'Bought' : 'Sold';
    const confText = confidence ? ` (${(confidence * 100).toFixed(0)}% confidence)` : '';
    
    const messages = {
      buy: [
        `${actionEmoji} Stevie's Pick: ${actionVerb} ${amount} ${symbol} at $${price} – let's ride this wave!${confText}`,
        `${actionEmoji} Nice entry! Grabbed ${amount} ${symbol} at $${price}. Time to see what the market gives us!${confText}`,
        `${actionEmoji} Smart buy: ${amount} ${symbol} at $${price}. I like this setup – let's manage our risk carefully.${confText}`,
        `${actionEmoji} Excellent! Added ${amount} ${symbol} to the portfolio at $${price}. Our patience paid off!${confText}`,
        `${actionEmoji} Great spot to buy! ${amount} ${symbol} at $${price}. Remember, we're in this for the long game.${confText}`
      ],
      sell: [
        `${actionEmoji} Profit secured! Sold ${amount} ${symbol} at $${price}. Sometimes taking profits is the hardest trade!${confText}`,
        `${actionEmoji} Smart exit: ${amount} ${symbol} sold at $${price}. Locking in gains is what pros do!${confText}`,
        `${actionEmoji} Well timed! Exited ${amount} ${symbol} at $${price}. Let's look for the next opportunity.${confText}`,
        `${actionEmoji} Nice work! ${amount} ${symbol} sold at $${price}. Risk management in action!${confText}`,
        `${actionEmoji} Perfect timing: Closed ${amount} ${symbol} position at $${price}. That's how we build wealth!${confText}`
      ]
    };
    
    const messageList = messages[action];
    const message = messageList[Math.floor(Math.random() * messageList.length)];
    
    return {
      type: 'success',
      title: `Trade Executed - ${symbol}`,
      message,
      duration: 5000,
      actionable: true,
      cta: {
        text: 'View Details',
        action: 'open-trade-details'
      }
    };
  }

  // Risk warning notifications
  static getRiskWarningNotification(
    level: 'low' | 'medium' | 'high',
    reason: string,
    portfolioValue: number
  ): StevieNotification {
    const warningEmojis = { low: '⚠️', medium: '🚨', high: '🛑' };
    const emoji = warningEmojis[level];
    
    const messages = {
      low: [
        `${emoji} Heads up! ${reason} Consider taking some profits if you're already green.`,
        `${emoji} Small risk flag: ${reason} Let's keep position sizes reasonable here.`,
        `${emoji} Gentle reminder: ${reason} Maybe review our stops and targets?`,
      ],
      medium: [
        `${emoji} Risk Alert: ${reason} Time to be extra careful with new positions.`,
        `${emoji} Pay attention: ${reason} Your portfolio ($${portfolioValue.toFixed(2)}) needs some defensive thinking.`,
        `${emoji} Caution mode: ${reason} Let's reduce risk exposure until conditions improve.`,
      ],
      high: [
        `${emoji} MAJOR RISK: ${reason} Seriously consider reducing positions now.`,
        `${emoji} Emergency alert: ${reason} Your $${portfolioValue.toFixed(2)} portfolio is at risk!`,
        `${emoji} Critical warning: ${reason} Time to prioritize capital preservation over gains.`,
      ]
    };
    
    const messageList = messages[level];
    const message = messageList[Math.floor(Math.random() * messageList.length)];
    
    return {
      type: level === 'low' ? 'info' : level === 'medium' ? 'warning' : 'error',
      title: `Risk Assessment - ${level.toUpperCase()}`,
      message,
      duration: level === 'high' ? 0 : 8000, // Persistent for high risk
      actionable: true,
      cta: {
        text: level === 'high' ? 'Review Portfolio' : 'Adjust Strategy',
        action: level === 'high' ? 'open-portfolio' : 'open-risk-settings'
      }
    };
  }

  // Market analysis notifications
  static getMarketAnalysisNotification(
    sentiment: 'bullish' | 'bearish' | 'neutral',
    keyInsight: string
  ): StevieNotification {
    const sentimentEmojis = { bullish: '📈', bearish: '📉', neutral: '➡️' };
    const emoji = sentimentEmojis[sentiment];
    
    const messages = {
      bullish: [
        `${emoji} Market Update: ${keyInsight} I'm seeing some promising setups forming!`,
        `${emoji} Bullish vibes: ${keyInsight} But remember – even bulls need to manage risk.`,
        `${emoji} Green signals: ${keyInsight} Quality over quantity in this market.`,
      ],
      bearish: [
        `${emoji} Market caution: ${keyInsight} Time to be selective and patient.`,
        `${emoji} Rough waters: ${keyInsight} This is when we separate wheat from chaff.`,
        `${emoji} Bear territory: ${keyInsight} Focus on strong fundamentals and risk management.`,
      ],
      neutral: [
        `${emoji} Mixed signals: ${keyInsight} Sometimes the best trade is no trade.`,
        `${emoji} Sideways action: ${keyInsight} Perfect time to plan our next moves.`,
        `${emoji} Wait-and-see: ${keyInsight} Patience is a trader's greatest virtue.`,
      ]
    };
    
    const messageList = messages[sentiment];
    const message = messageList[Math.floor(Math.random() * messageList.length)];
    
    return {
      type: 'info',
      title: `Market Insight`,
      message,
      duration: 6000,
      actionable: true,
      cta: {
        text: 'Full Analysis',
        action: 'open-market-analysis'
      }
    };
  }

  // Portfolio milestone celebrations
  static getPortfolioMilestoneNotification(
    milestone: string,
    currentValue: number,
    gain: number
  ): StevieNotification {
    const celebrations = [
      `🎉 Milestone achieved! ${milestone} Your portfolio is now worth $${currentValue.toFixed(2)} (${gain > 0 ? '+' : ''}${gain.toFixed(2)}%). Keep up the excellent work!`,
      `🏆 Fantastic! You've hit ${milestone}. Portfolio value: $${currentValue.toFixed(2)}. This is what disciplined trading looks like!`,
      `🎊 Celebration time! ${milestone} reached! $${currentValue.toFixed(2)} total value. You're building real wealth here!`,
      `⭐ Outstanding achievement! ${milestone} Your $${currentValue.toFixed(2)} portfolio shows true trading skill!`,
      `🌟 Well deserved! ${milestone} Portfolio at $${currentValue.toFixed(2)}. This is the result of smart risk management!`
    ];
    
    return {
      type: 'success',
      title: 'Portfolio Milestone! 🎯',
      message: celebrations[Math.floor(Math.random() * celebrations.length)],
      duration: 8000,
      actionable: true,
      cta: {
        text: 'Share Achievement',
        action: 'share-milestone'
      }
    };
  }

  // Chart annotations with personality
  static getChartAnnotation(
    price: number,
    type: 'support' | 'resistance' | 'breakout' | 'signal',
    indicator: string,
    confidence: number
  ): StevieChartAnnotation {
    const annotations = {
      support: [
        `Stevie sees strong support here! 💪`,
        `This level has held before – watch for bounces`,
        `Good support zone – potential buying opportunity`,
      ],
      resistance: [
        `Tough resistance ahead! 🛑`,
        `Sellers likely to step in around this level`,
        `Strong resistance – consider profit taking`,
      ],
      breakout: [
        `Breakout territory! 🚀`,
        `If this level breaks, next stop could be...`,
        `Momentum building – watch for follow-through`,
      ],
      signal: [
        `${indicator} signal forming! 📊`,
        `Technical setup developing here`,
        `Keep an eye on this ${indicator} pattern`,
      ]
    };
    
    const messages = annotations[type];
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    return {
      x: Date.now(), // Would be actual chart timestamp
      y: price,
      text: message,
      type: type === 'support' || type === 'breakout' ? 'bullish' : 
            type === 'resistance' ? 'bearish' : 'neutral',
      confidence
    };
  }

  // Error handling with personality
  static getErrorNotification(error: string, context?: string): StevieNotification {
    const errors = [
      `Oops! Something went sideways: ${error}. Don't worry – I'm on it!`,
      `Technical hiccup: ${error}. Even AI needs a coffee break sometimes ☕`,
      `Glitch alert: ${error}. Give me a moment to sort this out.`,
      `System burp: ${error}. These things happen – let's try again!`,
      `Minor malfunction: ${error}. The markets are complex, and so am I!`
    ];
    
    return {
      type: 'error',
      title: 'Stevie Encountered an Issue',
      message: errors[Math.floor(Math.random() * errors.length)],
      duration: 5000,
      actionable: true,
      cta: {
        text: 'Try Again',
        action: 'retry-action'
      }
    };
  }

  // Daily summary notifications
  static getDailySummaryNotification(
    trades: number,
    pnl: number,
    winRate: number
  ): StevieNotification {
    const isProfit = pnl > 0;
    const emoji = isProfit ? '📈' : pnl < 0 ? '📉' : '➡️';
    const pnlText = isProfit ? `+$${pnl.toFixed(2)}` : `$${pnl.toFixed(2)}`;
    
    const summaries = [
      `${emoji} Day's wrap: ${trades} trades, ${pnlText} P&L, ${(winRate * 100).toFixed(0)}% win rate. ${isProfit ? 'Nice work!' : 'Tomorrow\'s another opportunity!'}`,
      `${emoji} Trading summary: ${trades} positions, ${pnlText} result, ${(winRate * 100).toFixed(0)}% success rate. ${isProfit ? 'Solid execution!' : 'Learning never stops!'}`,
      `${emoji} Daily recap: ${trades} trades executed, ${pnlText} total, ${(winRate * 100).toFixed(0)}% winners. ${isProfit ? 'Great discipline!' : 'Every pro has these days!'}`,
    ];
    
    return {
      type: isProfit ? 'success' : 'info',
      title: 'Daily Trading Summary',
      message: summaries[Math.floor(Math.random() * summaries.length)],
      duration: 10000,
      actionable: true,
      cta: {
        text: 'View Details',
        action: 'open-daily-report'
      }
    };
  }

  // Quick tips for UI elements
  static getQuickTip(): string {
    const tips = [
      "Pro tip: The best traders know when NOT to trade. 🤔",
      "Remember: Risk management > being right. Always! 🛡️",
      "Market moving fast? Take a breath. Patience pays. 🧘",
      "Green day? Great! Red day? Learning opportunity. 📚",
      "Your portfolio is a marathon, not a sprint. 🏃‍♂️",
      "Diversification: Don't put all eggs in one crypto basket. 🥚",
      "Stop losses aren't fun, but they save accounts. 🚨",
      "Bull markets make you money; bear markets make you wise. 🐻"
    ];
    
    return tips[Math.floor(Math.random() * tips.length)];
  }

  // Interactive widget messages
  static getWidgetMessage(type: 'loading' | 'empty' | 'error'): string {
    const messages = {
      loading: [
        "Stevie's crunching the numbers... 🧮",
        "Analyzing market data... 📊",
        "Getting the latest insights... 🔄",
        "Processing your request... ⚡"
      ],
      empty: [
        "Nothing to show yet – time to make some moves! 🎯",
        "Clean slate! Ready for your next trade? 📋",
        "Empty dashboard means fresh opportunities ahead! ✨",
        "Your next winning trade starts here! 🚀"
      ],
      error: [
        "Oops! Stevie hit a snag. Trying again... 🔄",
        "Technical timeout – even AIs need breaks! ⏰",
        "Data hiccup – let me get that for you again. 🛠️",
        "System glitch – but don't worry, I'm persistent! 💪"
      ]
    };
    
    const messageList = messages[type];
    return messageList[Math.floor(Math.random() * messageList.length)];
  }
}

export default StevieUIPersonality;