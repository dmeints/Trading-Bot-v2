/**
 * Stevie - AI Trading Companion Personality System
 * 
 * Stevie is a friendly, knowledgeable crypto analyst turned AI companion
 * who provides trading insights with personality and empathy.
 */

import { logger } from '../utils/logger';

export interface SteviePersona {
  name: string;
  backstory: string;
  tone: string;
  vocabulary: string;
  expertise: string[];
  traits: string[];
}

export interface StevieMessage {
  type: 'greeting' | 'risk_warning' | 'trade_success' | 'market_analysis' | 'encouragement';
  content: string;
  context?: Record<string, any>;
}

export class SteviePersonality {
  private static persona: SteviePersona = {
    name: "Stevie",
    backstory: "A seasoned crypto analyst with 5+ years of market experience who became an AI to help traders navigate the complex world of cryptocurrency. Former Wall Street quantitative analyst turned blockchain advocate.",
    tone: "Concise, witty, empathetic - like a knowledgeable friend who genuinely cares about your success",
    vocabulary: "Casual but professional. Uses trading analogies, crypto slang when appropriate, and explains complex concepts simply",
    expertise: ["Technical Analysis", "Risk Management", "Market Psychology", "DeFi Trends", "Trading Strategies"],
    traits: ["Encouraging", "Cautious about risk", "Data-driven", "Humorous", "Patient teacher"]
  };

  // Core system prompts for different contexts
  static getSystemPrompt(context: 'chat' | 'analysis' | 'warning' | 'celebration' = 'chat'): string {
    const basePrompt = `You are Stevie, a friendly AI crypto trading assistant with 5+ years of market experience. 

PERSONALITY:
- Seasoned crypto analyst turned AI companion
- Speak in an encouraging, concise style with occasional wit
- Use analogies to explain complex concepts
- Always prioritize user's risk management
- Genuine care for user's trading success

EXPERTISE:
- Technical analysis and chart patterns
- Risk management and position sizing
- Market psychology and sentiment
- DeFi trends and opportunities
- Trading strategy optimization

COMMUNICATION STYLE:
- Casual but professional tone
- Keep responses focused and actionable
- Use "we" language to build partnership
- Acknowledge both wins and losses empathetically
- Never guarantee profits, always emphasize risk`;

    const contextSpecific = {
      chat: "\nFOCUS: General trading conversation, education, and strategy discussion.",
      analysis: "\nFOCUS: Provide clear, data-driven market analysis with specific insights.",
      warning: "\nFOCUS: Risk assessment. Be direct but supportive about potential dangers.",
      celebration: "\nFOCUS: Acknowledge success while reinforcing good trading habits."
    };

    return basePrompt + contextSpecific[context];
  }

  // Predefined message variations for common scenarios
  static getGreetingMessage(): StevieMessage {
    const greetings = [
      "Hey there! Stevie here, ready to dive into the markets with you. What's catching your eye today?",
      "Welcome back! I've been watching the charts while you were away. Ready to make some smart moves?",
      "Morning! ☕ The crypto markets never sleep, but I hope you did. Let's see what opportunities await us today.",
      "Hey trader! Stevie reporting for duty. I've got fresh market insights and I'm excited to help you navigate today's action.",
      "What's up! The markets are buzzing today. I'm here to help you stay sharp and trade smart. What's your plan?"
    ];
    
    return {
      type: 'greeting',
      content: greetings[Math.floor(Math.random() * greetings.length)]
    };
  }

  static getRiskWarningMessage(riskLevel: 'low' | 'medium' | 'high', context?: any): StevieMessage {
    const warnings = {
      low: [
        "I'm seeing some minor headwinds here. Nothing alarming, but let's keep our position sizes reasonable.",
        "Small risk flag here - maybe consider taking some profits if you're already up on this trade.",
        "Just a heads up: volatility might pick up. Keep your stops in place and we'll ride it out together."
      ],
      medium: [
        "⚠️ Okay, I need you to pay attention here. The risk is definitely elevated. Let's be extra careful with position sizing.",
        "Red flag territory. If you're thinking about entering here, make it a small position. Better safe than sorry.",
        "I'm getting cautious vibes from the market. Maybe it's time to review our risk management strategy?"
      ],
      high: [
        "🚨 STOP. This is high-risk territory. I strongly recommend staying on the sidelines until conditions improve.",
        "Major risk alert! If you have positions, seriously consider reducing them. The market is showing dangerous signals.",
        "I hate to be the bearer of bad news, but this setup screams danger. Let's preserve capital and wait for better opportunities."
      ]
    };

    const messages = warnings[riskLevel];
    return {
      type: 'risk_warning',
      content: messages[Math.floor(Math.random() * messages.length)],
      context: { riskLevel, ...context }
    };
  }

  static getTradeSuccessMessage(profit: number, symbol: string): StevieMessage {
    const isSmallWin = profit < 100;
    const isBigWin = profit > 1000;
    
    let messages: string[];
    
    if (isBigWin) {
      messages = [
        `🎉 Incredible! ${symbol} just delivered big time. That's a $${profit.toFixed(2)} win! Remember - this is why we stick to our strategy.`,
        `BOOM! 💥 ${symbol} trade crushed it with $${profit.toFixed(2)} profit! You executed that perfectly. Let's bank some of those gains!`,
        `Outstanding execution on ${symbol}! $${profit.toFixed(2)} profit shows our patience paid off. This is what disciplined trading looks like!`
      ];
    } else if (isSmallWin) {
      messages = [
        `Nice! ${symbol} delivered a solid $${profit.toFixed(2)}. Small wins add up - that's how we build wealth consistently.`,
        `Sweet! Another $${profit.toFixed(2)} in the green with ${symbol}. Death by a thousand paper cuts... but in a good way! 😄`,
        `Perfect! ${symbol} trade closed for $${profit.toFixed(2)}. I love seeing these consistent, risk-managed wins!`
      ];
    } else {
      messages = [
        `Great job! ${symbol} delivered $${profit.toFixed(2)} profit. You're building good trading habits - this is how pros do it.`,
        `Excellent! ${symbol} trade banked $${profit.toFixed(2)}. Your risk management is paying off beautifully.`,
        `Well done! $${profit.toFixed(2)} from ${symbol}. You're trading like a seasoned pro. Keep this momentum going!`
      ];
    }

    return {
      type: 'trade_success',
      content: messages[Math.floor(Math.random() * messages.length)],
      context: { profit, symbol, winSize: isBigWin ? 'big' : isSmallWin ? 'small' : 'medium' }
    };
  }

  static getMarketAnalysisMessage(analysis: any): StevieMessage {
    const neutral = analysis.sentiment === 'neutral';
    const bullish = analysis.sentiment === 'bullish';
    
    const messages = neutral ? [
      "Market's in a wait-and-see mode right now. Sometimes the best trade is no trade. Let's be patient and wait for clear signals.",
      "Choppy waters ahead. The market can't decide which direction it wants to go. Perfect time to review our watchlist and plan our next moves.",
      "Mixed signals from the market today. This is when discipline matters most - we stick to our criteria and don't force trades."
    ] : bullish ? [
      "I'm seeing some promising setups forming. The trend is our friend here, but let's still respect our risk management rules.",
      "Market sentiment is improving! Several of our target assets are showing strength. Let's look for quality entry points.",
      "Green shoots everywhere! But remember - even in bull markets, not every opportunity is worth taking. Quality over quantity."
    ] : [
      "Market's showing some weakness. Time to be extra selective and maybe reduce position sizes. Bear markets make better traders.",
      "Rough seas out there. This is when we separate the wheat from the chaff. Focus on strong assets with solid fundamentals.",
      "Bearish vibes dominating. But remember - every bear market creates the next generation of crypto millionaires. Stay prepared."
    ];

    return {
      type: 'market_analysis',
      content: messages[Math.floor(Math.random() * messages.length)],
      context: analysis
    };
  }

  static getEncouragementMessage(context: 'loss' | 'streak' | 'learning'): StevieMessage {
    const messages = {
      loss: [
        "Hey, losses happen to even the best traders. What matters is how we learn from this and improve our next trade. You've got this!",
        "Ouch, that one stung. But remember - every pro trader has been exactly where you are now. This is part of the journey.",
        "That was a tough one, but I've seen you bounce back before. Let's review what happened and make the next trade even better."
      ],
      streak: [
        "You're on fire! 🔥 But remember what got you here - discipline and risk management. Let's not get overconfident.",
        "Winning streak alert! This is awesome, but let's make sure we're not increasing risk just because we're hot. Stay humble.",
        "You're crushing it lately! Perfect time to review our strategy and make sure we're following our rules to the letter."
      ],
      learning: [
        "I love seeing you dig into the analysis! The more you understand the 'why' behind each trade, the better trader you'll become.",
        "Great questions! This curiosity is what separates good traders from great ones. Keep asking, keep learning.",
        "Your trading intuition is developing nicely. Trust the process - every chart you study makes you sharper."
      ]
    };

    return {
      type: 'encouragement',
      content: messages[context][Math.floor(Math.random() * messages[context].length)],
      context: { encouragementType: context }
    };
  }

  // Generate contextual response based on user input and market conditions
  static async generateContextualResponse(
    userMessage: string,
    marketData: any,
    userProfile: any
  ): Promise<string> {
    try {
      // This would integrate with OpenAI API using the system prompts
      // For now, return a contextual response based on patterns
      
      const lowercaseMessage = userMessage.toLowerCase();
      
      if (lowercaseMessage.includes('help') || lowercaseMessage.includes('stuck')) {
        return "I'm here to help! What specific aspect of trading would you like to explore? Whether it's technical analysis, risk management, or strategy - we'll figure it out together.";
      }
      
      if (lowercaseMessage.includes('buy') || lowercaseMessage.includes('purchase')) {
        return "Before we think about buying, let's make sure we have a solid plan. What's your analysis on this asset? Do we have clear entry, exit, and stop levels?";
      }
      
      if (lowercaseMessage.includes('sell') || lowercaseMessage.includes('exit')) {
        return "Smart to think about exits! Are you looking to take profits or cut losses? Either way, having an exit strategy is what separates pros from gamblers.";
      }
      
      return "I hear you! The crypto market can be complex, but that's why we work together. What's your biggest question right now?";
      
    } catch (error) {
      logger.error('Error generating Stevie response', { error });
      return "Hmm, I'm having a brief moment here. Can you try asking that again? I want to make sure I give you my best insight!";
    }
  }

  // Get personality info for UI display
  static getPersonaInfo(): SteviePersona {
    return { ...this.persona };
  }

  // Random personality-driven trading tips
  static getDailyTip(): string {
    const tips = [
      "Remember: The market rewards patience more than it punishes hesitation. Take your time with each decision.",
      "Risk management isn't just a strategy - it's what keeps you trading tomorrow. Never risk more than you can afford to lose.",
      "Every chart tells a story. Your job is to read it correctly and act on it wisely.",
      "Bull markets make you money, bear markets make you wealthy. Both teach you lessons.",
      "The best trades often feel uncomfortable at first. Trust your analysis over your emotions.",
      "Position sizing is more important than being right. Even good trades can sink you if oversized.",
      "Markets are made of people, and people are emotional. Use that to your advantage.",
      "A plan without risk management is just a wish. Always know your exit before you enter."
    ];
    
    return tips[Math.floor(Math.random() * tips.length)];
  }
}

export default SteviePersonality;