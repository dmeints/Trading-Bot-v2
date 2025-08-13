
import { logger } from '../utils/logger.js';

interface EventRecord {
  id: string;
  timestamp: number;
  title: string;
  content: string;
  source: string;
  category: 'news' | 'social' | 'onchain' | 'macro';
  impact: 'low' | 'medium' | 'high';
  processed: boolean;
}

interface EventEmbedding {
  eventId: string;
  embedding: number[] | string; // Vector or hash
  summary: string;
  timestamp: number;
  relevanceScore: number;
}

interface EventSummary {
  period: string;
  totalEvents: number;
  highImpactEvents: number;
  categories: Record<string, number>;
  topEvents: { title: string; impact: string; timestamp: number }[];
}

class EventsService {
  private events: Map<string, EventRecord> = new Map();
  private embeddings: Map<string, EventEmbedding> = new Map();
  private readonly maxEvents = 1000;
  private readonly maxEmbeddings = 500;
  
  constructor() {
    this.generateSyntheticEvents();
  }
  
  private generateSyntheticEvents(): void {
    const syntheticEvents = [
      {
        title: 'Fed Announces Interest Rate Decision',
        content: 'Federal Reserve maintains current interest rates at 5.25-5.50%',
        source: 'reuters',
        category: 'macro' as const,
        impact: 'high' as const
      },
      {
        title: 'Bitcoin ETF Inflows Surge',
        content: 'Spot Bitcoin ETFs see $200M in daily inflows',
        source: 'coindesk',
        category: 'news' as const,
        impact: 'medium' as const
      },
      {
        title: 'Large Whale Movement Detected',
        content: '10,000 BTC moved from unknown wallet to Coinbase',
        source: 'whale_alert',
        category: 'onchain' as const,
        impact: 'medium' as const
      },
      {
        title: 'Crypto Twitter Sentiment Turns Bullish',
        content: 'Social sentiment indicators show increased optimism',
        source: 'twitter_api',
        category: 'social' as const,
        impact: 'low' as const
      },
      {
        title: 'Major Exchange Announces New Features',
        content: 'Binance launches new institutional trading platform',
        source: 'binance_blog',
        category: 'news' as const,
        impact: 'medium' as const
      }
    ];
    
    syntheticEvents.forEach((event, index) => {
      const eventRecord: EventRecord = {
        id: `event_${Date.now()}_${index}`,
        timestamp: Date.now() - (index * 60 * 60 * 1000), // Stagger by hours
        title: event.title,
        content: event.content,
        source: event.source,
        category: event.category,
        impact: event.impact,
        processed: false
      };
      
      this.events.set(eventRecord.id, eventRecord);
    });
    
    // Process initial events
    this.processUnprocessedEvents();
  }
  
  addEvent(event: Omit<EventRecord, 'id' | 'processed'>): string {
    const id = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const eventRecord: EventRecord = {
      id,
      processed: false,
      ...event
    };
    
    this.events.set(id, eventRecord);
    
    // Keep rolling window
    if (this.events.size > this.maxEvents) {
      const oldestId = Array.from(this.events.keys())[0];
      this.events.delete(oldestId);
      this.embeddings.delete(oldestId);
    }
    
    // Process immediately
    this.processEvent(eventRecord);
    
    return id;
  }
  
  private processUnprocessedEvents(): void {
    const unprocessed = Array.from(this.events.values()).filter(e => !e.processed);
    
    unprocessed.forEach(event => {
      this.processEvent(event);
    });
  }
  
  private processEvent(event: EventRecord): void {
    try {
      // Generate summary
      const summary = this.generateSummary(event);
      
      // Generate embedding (stub with hash for LLM safety)
      const embedding = this.generateEmbedding(event);
      
      // Calculate relevance score
      const relevanceScore = this.calculateRelevance(event);
      
      const eventEmbedding: EventEmbedding = {
        eventId: event.id,
        embedding,
        summary,
        timestamp: Date.now(),
        relevanceScore
      };
      
      this.embeddings.set(event.id, eventEmbedding);
      
      // Mark as processed
      event.processed = true;
      this.events.set(event.id, event);
      
      logger.debug(`Processed event: ${event.title}`, {
        summary: summary.slice(0, 50),
        relevanceScore
      });
      
    } catch (error) {
      logger.error(`Error processing event ${event.id}:`, error);
    }
  }
  
  private generateSummary(event: EventRecord): string {
    // LLM-safe summarization (rule-based for now)
    const title = event.title;
    const category = event.category.toUpperCase();
    const impact = event.impact.toUpperCase();
    
    // Extract key phrases based on category
    let keyPhrases: string[] = [];
    
    switch (event.category) {
      case 'macro':
        keyPhrases = this.extractKeyPhrases(event.content, ['rate', 'fed', 'inflation', 'policy', 'economic']);
        break;
      case 'news':
        keyPhrases = this.extractKeyPhrases(event.content, ['announce', 'launch', 'partnership', 'regulation']);
        break;
      case 'onchain':
        keyPhrases = this.extractKeyPhrases(event.content, ['whale', 'transfer', 'volume', 'address']);
        break;
      case 'social':
        keyPhrases = this.extractKeyPhrases(event.content, ['sentiment', 'bullish', 'bearish', 'trend']);
        break;
    }
    
    return `[${category}/${impact}] ${title} - Key: ${keyPhrases.join(', ')}`;
  }
  
  private extractKeyPhrases(content: string, keywords: string[]): string[] {
    const words = content.toLowerCase().split(/\s+/);
    const found = keywords.filter(keyword => 
      words.some(word => word.includes(keyword))
    );
    
    return found.length > 0 ? found : ['general'];
  }
  
  private generateEmbedding(event: EventRecord): string {
    // LLM-safe stub: use content hash instead of actual embeddings
    const content = `${event.title} ${event.content} ${event.category} ${event.impact}`;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to pseudo-embedding format
    const hashStr = Math.abs(hash).toString(16).padStart(8, '0');
    return `embed_${hashStr}_${event.category}_${event.impact}`;
  }
  
  private calculateRelevance(event: EventRecord): number {
    let score = 0.5; // Base relevance
    
    // Impact weighting
    switch (event.impact) {
      case 'high': score += 0.4; break;
      case 'medium': score += 0.2; break;
      case 'low': score += 0.1; break;
    }
    
    // Category weighting (for crypto trading context)
    switch (event.category) {
      case 'macro': score += 0.3; break;
      case 'news': score += 0.2; break;
      case 'onchain': score += 0.25; break;
      case 'social': score += 0.1; break;
    }
    
    // Recency weighting
    const hoursOld = (Date.now() - event.timestamp) / (1000 * 60 * 60);
    const recencyFactor = Math.max(0, 1 - hoursOld / 24); // Decay over 24 hours
    score += recencyFactor * 0.2;
    
    return Math.min(1.0, Math.max(0.0, score));
  }
  
  getEmbeddings(limit = 50): EventEmbedding[] {
    return Array.from(this.embeddings.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }
  
  getEventSummary(hours = 24): EventSummary {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const recentEvents = Array.from(this.events.values())
      .filter(e => e.timestamp > cutoff);
    
    const categories = recentEvents.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const highImpactEvents = recentEvents.filter(e => e.impact === 'high').length;
    
    const topEvents = recentEvents
      .sort((a, b) => {
        const impactScore = { high: 3, medium: 2, low: 1 };
        return impactScore[b.impact] - impactScore[a.impact];
      })
      .slice(0, 5)
      .map(e => ({
        title: e.title,
        impact: e.impact,
        timestamp: e.timestamp
      }));
    
    return {
      period: `${hours}h`,
      totalEvents: recentEvents.length,
      highImpactEvents,
      categories,
      topEvents
    };
  }
  
  // Placebo check for event studies
  runPlaceboTest(eventId: string): { significant: boolean; pValue: number } {
    try {
      const event = this.events.get(eventId);
      if (!event) {
        return { significant: false, pValue: 1.0 };
      }
      
      // Generate random returns for placebo test
      const beforeReturns = Array.from({ length: 10 }, () => (Math.random() - 0.5) * 0.02);
      const afterReturns = Array.from({ length: 10 }, () => (Math.random() - 0.5) * 0.02);
      
      const beforeMean = beforeReturns.reduce((a, b) => a + b, 0) / beforeReturns.length;
      const afterMean = afterReturns.reduce((a, b) => a + b, 0) / afterReturns.length;
      
      const difference = Math.abs(afterMean - beforeMean);
      
      // Simulate t-test p-value
      const tStat = difference / 0.01; // Simplified
      const pValue = Math.max(0.01, Math.min(0.99, Math.exp(-tStat)));
      
      return {
        significant: pValue < 0.05,
        pValue
      };
      
    } catch (error) {
      logger.error('Error in placebo test:', error);
      return { significant: false, pValue: 1.0 };
    }
  }
}

export const eventsService = new EventsService();
export type { EventRecord, EventEmbedding, EventSummary };
