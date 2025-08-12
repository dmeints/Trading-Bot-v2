
import { logger } from '../utils/logger.js';

interface NewsEvent {
  id: string;
  title: string;
  content: string;
  timestamp: Date;
  source: string;
  sentiment: number;
}

interface EventEmbedding {
  id: string;
  text: string;
  embedding: number[];
  timestamp: Date;
  relevanceScore: number;
}

class EventsService {
  private embeddings: EventEmbedding[] = [];
  private events: NewsEvent[] = [];
  private maxEmbeddings = 100;

  constructor() {
    this.initializeWithMockData();
  }

  private initializeWithMockData() {
    // Mock news events for testing
    const mockEvents: NewsEvent[] = [
      {
        id: '1',
        title: 'Bitcoin ETF Approval Expected',
        content: 'Major financial institutions are pushing for Bitcoin ETF approval, which could drive significant institutional adoption.',
        timestamp: new Date(),
        source: 'crypto_news',
        sentiment: 0.7
      },
      {
        id: '2',
        title: 'Federal Reserve Rate Decision',
        content: 'The Fed is expected to maintain current interest rates, which could be positive for risk assets like cryptocurrency.',
        timestamp: new Date(Date.now() - 3600000),
        source: 'fed_news',
        sentiment: 0.3
      },
      {
        id: '3',
        title: 'Major Exchange Hack Reported',
        content: 'A smaller cryptocurrency exchange reported a security breach, raising concerns about digital asset custody.',
        timestamp: new Date(Date.now() - 7200000),
        source: 'security_alert',
        sentiment: -0.6
      }
    ];

    this.events = mockEvents;
    this.processEventsToEmbeddings();
  }

  private processEventsToEmbeddings() {
    // Convert events to embeddings (placeholder implementation)
    this.embeddings = this.events.map(event => {
      const embedding = this.createPlaceholderEmbedding(event.title + ' ' + event.content);
      return {
        id: event.id,
        text: event.title,
        embedding,
        timestamp: event.timestamp,
        relevanceScore: Math.abs(event.sentiment)
      };
    });

    // Sort by relevance and keep top N
    this.embeddings.sort((a, b) => b.relevanceScore - a.relevanceScore);
    this.embeddings = this.embeddings.slice(0, this.maxEmbeddings);
  }

  private createPlaceholderEmbedding(text: string): number[] {
    // Placeholder embedding using text characteristics
    const embedding = new Array(8).fill(0);
    
    // Simple text-based features
    embedding[0] = text.toLowerCase().includes('bitcoin') ? 0.8 : 0.1;
    embedding[1] = text.toLowerCase().includes('ethereum') ? 0.7 : 0.1;
    embedding[2] = text.toLowerCase().includes('fed') || text.toLowerCase().includes('rate') ? 0.6 : 0.1;
    embedding[3] = text.toLowerCase().includes('hack') || text.toLowerCase().includes('breach') ? -0.8 : 0.1;
    embedding[4] = text.toLowerCase().includes('etf') || text.toLowerCase().includes('institutional') ? 0.5 : 0.1;
    embedding[5] = text.length / 100; // Normalized length
    embedding[6] = (text.match(/[A-Z]/g) || []).length / text.length; // Caps ratio
    embedding[7] = Math.sin(Date.now() / 1000000) * 0.1; // Time-based noise
    
    // Normalize to unit length
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (norm || 1));
  }

  public getEmbeddings(): EventEmbedding[] {
    return this.embeddings.slice(0, 10); // Return top 10 most recent/relevant
  }

  public getContextEmbedding(): number[] {
    if (this.embeddings.length === 0) {
      return new Array(8).fill(0);
    }

    // Aggregate embeddings weighted by relevance
    const aggregated = new Array(8).fill(0);
    let totalWeight = 0;

    for (const emb of this.embeddings.slice(0, 5)) {
      const weight = emb.relevanceScore;
      for (let i = 0; i < 8; i++) {
        aggregated[i] += emb.embedding[i] * weight;
      }
      totalWeight += weight;
    }

    // Normalize
    if (totalWeight > 0) {
      for (let i = 0; i < 8; i++) {
        aggregated[i] /= totalWeight;
      }
    }

    return aggregated;
  }

  public ingestEvent(event: Omit<NewsEvent, 'id'>): void {
    const newEvent: NewsEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.events.unshift(newEvent);
    this.events = this.events.slice(0, 200); // Keep last 200 events
    
    this.processEventsToEmbeddings();
    
    logger.info('New event ingested and processed', { 
      eventId: newEvent.id, 
      title: newEvent.title 
    });
  }

  public getRecentEvents(limit = 10): NewsEvent[] {
    return this.events.slice(0, limit);
  }
}

export const eventsService = new EventsService();
