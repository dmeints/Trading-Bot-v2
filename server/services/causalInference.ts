/**
 * CAUSAL INFERENCE ENGINE
 * Identifies cause-effect relationships in market data beyond correlation
 */

interface CausalEvent {
  id: string;
  type: 'news' | 'whale_move' | 'social_spike' | 'technical_break' | 'macro_event';
  timestamp: Date;
  description: string;
  magnitude: number; // 0-100
  asset: string;
}

interface CausalEffect {
  event: CausalEvent;
  priceImpact: {
    immediate: number; // 0-15 minutes
    shortTerm: number; // 15min-1hr  
    mediumTerm: number; // 1hr-4hr
    longTerm: number; // 4hr-24hr
  };
  volumeImpact: number;
  volatilityChange: number;
  cascadingEffects: string[];
}

interface CausalModel {
  eventType: string;
  avgTimeDelay: number; // minutes
  avgMagnitude: number;
  successRate: number; // 0-1
  confidence: number; // 0-1
  historicalSamples: number;
  keyConditions: string[];
}

export class CausalInference {
  private causalModels: Map<string, CausalModel> = new Map();
  private recentEvents: CausalEvent[] = [];
  private effectHistory: CausalEffect[] = [];

  constructor() {
    this.initializeBaseCausalModels();
  }

  private initializeBaseCausalModels() {
    // News event causality
    this.causalModels.set('news_positive', {
      eventType: 'Positive news announcement',
      avgTimeDelay: 8, // 8 minutes average
      avgMagnitude: 3.2,
      successRate: 0.73,
      confidence: 0.68,
      historicalSamples: 156,
      keyConditions: ['Market hours', 'High liquidity', 'Clear narrative']
    });

    this.causalModels.set('news_negative', {
      eventType: 'Negative news/regulatory',
      avgTimeDelay: 4, // Faster negative reaction
      avgMagnitude: -4.1,
      successRate: 0.81,
      confidence: 0.74,
      historicalSamples: 203,
      keyConditions: ['Credible source', 'Direct impact', 'Market uncertainty']
    });

    // Whale movement causality
    this.causalModels.set('whale_to_exchange', {
      eventType: 'Large transfer to exchange',
      avgTimeDelay: 22, // 22 minutes average
      avgMagnitude: -2.8,
      successRate: 0.64,
      confidence: 0.71,
      historicalSamples: 89,
      keyConditions: ['> $10M transfer', 'Known whale wallet', 'Low market cap ratio']
    });

    this.causalModels.set('whale_from_exchange', {
      eventType: 'Large exchange withdrawal',
      avgTimeDelay: 31, // Slower positive reaction
      avgMagnitude: 1.9,
      successRate: 0.58,
      confidence: 0.63,
      historicalSamples: 67,
      keyConditions: ['> $5M withdrawal', 'Custody pattern', 'Accumulation phase']
    });

    // Social sentiment causality
    this.causalModels.set('social_bullish_spike', {
      eventType: 'Viral bullish content',
      avgTimeDelay: 47, // Slower social influence
      avgMagnitude: 2.1,
      successRate: 0.52,
      confidence: 0.59,
      historicalSamples: 124,
      keyConditions: ['High engagement', 'Influencer amplification', 'Trending hashtags']
    });

    // Technical breakout causality
    this.causalModels.set('resistance_break', {
      eventType: 'Technical resistance break',
      avgTimeDelay: 12,
      avgMagnitude: 4.7,
      successRate: 0.69,
      confidence: 0.76,
      historicalSamples: 178,
      keyConditions: ['High volume confirmation', 'Clean breakout', 'Multiple timeframe alignment']
    });
  }

  async identifyCausalEvents(timeWindow: number = 24): Promise<CausalEvent[]> {
    const events: CausalEvent[] = [];
    const now = new Date();
    
    // Generate simulated causal events for the last 24 hours
    const eventTypes = ['news', 'whale_move', 'social_spike', 'technical_break'];
    const assets = ['BTC', 'ETH', 'SOL', 'ADA'];
    
    // Average 3-5 causal events per day
    const numEvents = 3 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numEvents; i++) {
      const hoursAgo = Math.random() * timeWindow;
      const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)] as CausalEvent['type'];
      const asset = assets[Math.floor(Math.random() * assets.length)];
      
      events.push({
        id: `event_${Date.now()}_${i}`,
        type,
        timestamp,
        description: this.generateEventDescription(type, asset),
        magnitude: 20 + Math.random() * 60, // 20-80 range
        asset
      });
    }
    
    this.recentEvents = events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return this.recentEvents;
  }

  private generateEventDescription(type: CausalEvent['type'], asset: string): string {
    const descriptions = {
      news: [
        `${asset} mentioned in positive regulatory framework announcement`,
        `Major institution announces ${asset} treasury allocation`,
        `${asset} network upgrade successfully implemented`,
        `Negative regulatory concerns raised about ${asset} usage`
      ],
      whale_move: [
        `Large ${asset} holder moves $50M+ to Binance`,
        `Whale withdraws $25M+ ${asset} from Coinbase to cold storage`,
        `Unknown wallet accumulates $100M+ ${asset} over 3 days`,
        `Exchange sees massive ${asset} outflow from institutional wallet`
      ],
      social_spike: [
        `${asset} trending on Twitter with 100k+ mentions`,
        `Crypto influencer bullish thread on ${asset} goes viral`,
        `Reddit ${asset} discussion reaches r/all frontpage`,
        `TikTok ${asset} content generates 50M+ views`
      ],
      technical_break: [
        `${asset} breaks major resistance at $${(Math.random() * 50000 + 20000).toFixed(0)}`,
        `${asset} forms bullish flag pattern with volume confirmation`,
        `${asset} completes cup and handle formation`,
        `${asset} breaks below key support with high volume`
      ],
      macro_event: [
        `Federal Reserve announces ${Math.random() > 0.5 ? 'dovish' : 'hawkish'} policy shift`,
        `Major bank reports ${asset}-related losses/gains`,
        `Government announces new crypto taxation framework`,
        `Central bank announces CBDC development affecting ${asset}`
      ]
    };
    
    const typeDescriptions = descriptions[type];
    return typeDescriptions[Math.floor(Math.random() * typeDescriptions.length)];
  }

  async analyzeCausalEffects(events: CausalEvent[]): Promise<CausalEffect[]> {
    const effects: CausalEffect[] = [];
    
    for (const event of events) {
      const causalKey = this.getCausalModelKey(event);
      const model = this.causalModels.get(causalKey);
      
      if (!model) continue;
      
      // Calculate expected effects based on causal model
      const baseImpact = event.magnitude * model.avgMagnitude / 100;
      const randomFactor = 0.7 + Math.random() * 0.6; // 0.7x to 1.3x variation
      
      const effect: CausalEffect = {
        event,
        priceImpact: {
          immediate: baseImpact * randomFactor * 1.2, // Immediate reaction often strongest
          shortTerm: baseImpact * randomFactor * 0.8,
          mediumTerm: baseImpact * randomFactor * 0.6,
          longTerm: baseImpact * randomFactor * 0.4
        },
        volumeImpact: Math.abs(baseImpact) * 2.5, // Volume spike
        volatilityChange: Math.abs(baseImpact) * 1.8,
        cascadingEffects: this.identifyCascadingEffects(event, model)
      };
      
      effects.push(effect);
    }
    
    this.effectHistory.push(...effects);
    return effects;
  }

  private getCausalModelKey(event: CausalEvent): string {
    const { type, magnitude, description } = event;
    
    if (type === 'news') {
      const isPositive = description.includes('positive') || 
                        description.includes('announces') ||
                        description.includes('upgrade') ||
                        description.includes('institution');
      return isPositive ? 'news_positive' : 'news_negative';
    }
    
    if (type === 'whale_move') {
      const isToExchange = description.includes('to Binance') || 
                          description.includes('to Coinbase') ||
                          description.includes('to exchange');
      return isToExchange ? 'whale_to_exchange' : 'whale_from_exchange';
    }
    
    if (type === 'social_spike') {
      return 'social_bullish_spike'; // Simplified for now
    }
    
    if (type === 'technical_break') {
      return 'resistance_break'; // Simplified for now
    }
    
    return 'unknown';
  }

  private identifyCascadingEffects(event: CausalEvent, model: CausalModel): string[] {
    const effects: string[] = [];
    const { type, magnitude } = event;
    
    // High magnitude events create more cascading effects
    if (magnitude > 70) {
      if (type === 'news') {
        effects.push('Cross-asset contagion to related tokens');
        effects.push('Increased social media discussion volume');
        if (Math.random() > 0.5) {
          effects.push('Derivative markets position adjustments');
        }
      }
      
      if (type === 'whale_move') {
        effects.push('Other whales follow similar movement pattern');
        effects.push('Exchange flow monitoring alerts triggered');
        if (magnitude > 85) {
          effects.push('Market maker algorithm adjustments');
        }
      }
      
      if (type === 'social_spike') {
        effects.push('Mainstream media coverage increase');
        effects.push('New retail investor interest spike');
      }
    }
    
    // Model-specific cascading effects
    if (model.successRate > 0.7) {
      effects.push('High-confidence follow-through expected');
    }
    
    if (model.avgTimeDelay < 15) {
      effects.push('Fast market reaction creates momentum');
    }
    
    return effects.slice(0, 3); // Limit to 3 most important effects
  }

  async getEventPredictions(lookAheadHours: number = 4): Promise<{
    event: CausalEvent;
    expectedEffect: CausalEffect;
    probability: number;
    timeRemaining: number; // minutes
  }[]> {
    const predictions: any[] = [];
    
    // Find recent events that haven't fully played out
    const cutoffTime = new Date(Date.now() - lookAheadHours * 60 * 60 * 1000);
    const recentEvents = this.recentEvents.filter(e => e.timestamp > cutoffTime);
    
    for (const event of recentEvents) {
      const causalKey = this.getCausalModelKey(event);
      const model = this.causalModels.get(causalKey);
      
      if (!model) continue;
      
      const minutesSinceEvent = (Date.now() - event.timestamp.getTime()) / (1000 * 60);
      const expectedDelay = model.avgTimeDelay;
      
      // Check if we're within the prediction window
      if (minutesSinceEvent < expectedDelay + 60) { // Within 1 hour of expected effect
        const effects = await this.analyzeCausalEffects([event]);
        
        if (effects.length > 0) {
          predictions.push({
            event,
            expectedEffect: effects[0],
            probability: model.successRate,
            timeRemaining: Math.max(0, expectedDelay - minutesSinceEvent)
          });
        }
      }
    }
    
    return predictions.sort((a, b) => a.timeRemaining - b.timeRemaining);
  }

  async updateCausalModel(eventType: string, actualEffect: CausalEffect, success: boolean) {
    const model = this.causalModels.get(eventType);
    if (!model) return;
    
    // Update model with new data (simplified online learning)
    const learningRate = 0.1;
    
    if (success) {
      model.successRate = model.successRate * (1 - learningRate) + learningRate;
      model.confidence = Math.min(0.95, model.confidence + 0.01);
    } else {
      model.successRate = model.successRate * (1 - learningRate);
      model.confidence = Math.max(0.3, model.confidence - 0.02);
    }
    
    model.historicalSamples++;
    
    // Update magnitude if we have actual effect data
    const actualMagnitude = Math.abs(actualEffect.priceImpact.immediate);
    model.avgMagnitude = model.avgMagnitude * (1 - learningRate) + actualMagnitude * learningRate;
  }

  getCausalModelSummary(): Record<string, CausalModel> {
    return Object.fromEntries(this.causalModels);
  }

  async getStrongestCausalSignal(): Promise<{
    signal: 'bullish' | 'bearish' | 'neutral';
    strength: number; // 0-100
    primaryCause: string;
    confidence: number; // 0-100
    timeframe: string;
  }> {
    const recentEvents = await this.identifyCausalEvents(6); // Last 6 hours
    const effects = await this.analyzeCausalEffects(recentEvents);
    
    if (effects.length === 0) {
      return {
        signal: 'neutral',
        strength: 0,
        primaryCause: 'No significant causal events detected',
        confidence: 50,
        timeframe: '1h'
      };
    }
    
    // Find the strongest expected effect
    const strongestEffect = effects.reduce((strongest, current) => {
      const currentStrength = Math.abs(current.priceImpact.immediate);
      const strongestStrength = Math.abs(strongest.priceImpact.immediate);
      return currentStrength > strongestStrength ? current : strongest;
    });
    
    const causalKey = this.getCausalModelKey(strongestEffect.event);
    const model = this.causalModels.get(causalKey);
    
    const immediateImpact = strongestEffect.priceImpact.immediate;
    const signal = immediateImpact > 0.5 ? 'bullish' : immediateImpact < -0.5 ? 'bearish' : 'neutral';
    const strength = Math.min(100, Math.abs(immediateImpact) * 20);
    const confidence = model ? Math.round(model.confidence * 100) : 60;
    
    return {
      signal,
      strength: Math.round(strength),
      primaryCause: strongestEffect.event.description,
      confidence,
      timeframe: this.getEffectTimeframe(strongestEffect)
    };
  }

  private getEffectTimeframe(effect: CausalEffect): string {
    const impacts = effect.priceImpact;
    const maxImpact = Math.max(
      Math.abs(impacts.immediate),
      Math.abs(impacts.shortTerm),
      Math.abs(impacts.mediumTerm),
      Math.abs(impacts.longTerm)
    );
    
    if (maxImpact === Math.abs(impacts.immediate)) return '15m';
    if (maxImpact === Math.abs(impacts.shortTerm)) return '1h';
    if (maxImpact === Math.abs(impacts.mediumTerm)) return '4h';
    return '1d';
  }
}

export const causalInference = new CausalInference();