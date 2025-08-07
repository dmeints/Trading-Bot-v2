/**
 * Stevie v1.3 - Vector Database Service
 * Enables similarity search for trading scenarios and pattern recognition
 */

import axios from 'axios';
import OpenAI from 'openai';
import { FeatureVector } from './featureService';

export interface VectorRecord {
  id: string;
  vector: number[];
  metadata: {
    symbol: string;
    timestamp: number;
    scenario: string;
    outcome: 'profit' | 'loss' | 'neutral';
    confidence: number;
    features: Partial<FeatureVector>;
  };
}

export interface SimilarRecord {
  id: string;
  score: number;
  metadata: VectorRecord['metadata'];
}

export interface VectorSearchQuery {
  vector: number[];
  topK: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
}

// Vector database interface for different providers
interface VectorDB {
  upsert(records: VectorRecord[]): Promise<void>;
  query(params: VectorSearchQuery): Promise<SimilarRecord[]>;
  delete(ids: string[]): Promise<void>;
  describe(): Promise<any>;
}

// Pinecone implementation
class PineconeDB implements VectorDB {
  private apiKey: string;
  private environment: string;
  private indexName: string;
  private baseUrl: string;

  constructor(apiKey: string, environment: string, indexName = 'stevie-trading') {
    this.apiKey = apiKey;
    this.environment = environment;
    this.indexName = indexName;
    this.baseUrl = `https://${indexName}-${environment}.svc.${environment}.pinecone.io`;
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    const url = `${this.baseUrl}/vectors/upsert`;
    
    const vectors = records.map(record => ({
      id: record.id,
      values: record.vector,
      metadata: record.metadata
    }));

    await axios.post(url, { vectors }, {
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  async query(params: VectorSearchQuery): Promise<SimilarRecord[]> {
    const url = `${this.baseUrl}/query`;
    
    const response = await axios.post(url, {
      vector: params.vector,
      topK: params.topK,
      filter: params.filter,
      includeMetadata: params.includeMetadata ?? true
    }, {
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    return response.data.matches.map((match: any) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata
    }));
  }

  async delete(ids: string[]): Promise<void> {
    const url = `${this.baseUrl}/vectors/delete`;
    
    await axios.post(url, { ids }, {
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  async describe(): Promise<any> {
    const url = `${this.baseUrl}/describe_index_stats`;
    
    const response = await axios.post(url, {}, {
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }
}

// Weaviate implementation (alternative free option)
class WeaviateDB implements VectorDB {
  private baseUrl: string;
  private className: string;
  private apiKey?: string;

  constructor(baseUrl: string, className = 'TradingScenario', apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.className = className;
    this.apiKey = apiKey;
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    const url = `${this.baseUrl}/v1/objects`;
    
    for (const record of records) {
      const object = {
        class: this.className,
        id: record.id,
        vector: record.vector,
        properties: {
          ...record.metadata,
          vectorData: JSON.stringify(record.vector)
        }
      };

      await axios.post(url, object, {
        headers: this.getHeaders()
      });
    }
  }

  async query(params: VectorSearchQuery): Promise<SimilarRecord[]> {
    const url = `${this.baseUrl}/v1/graphql`;
    
    const query = `
      {
        Get {
          ${this.className}(
            nearVector: {
              vector: [${params.vector.join(', ')}]
            }
            limit: ${params.topK}
          ) {
            _additional {
              id
              certainty
            }
            symbol
            timestamp
            scenario
            outcome
            confidence
          }
        }
      }
    `;

    const response = await axios.post(url, { query }, {
      headers: this.getHeaders()
    });

    const results = response.data.data.Get[this.className] || [];
    
    return results.map((result: any) => ({
      id: result._additional.id,
      score: result._additional.certainty,
      metadata: {
        symbol: result.symbol,
        timestamp: result.timestamp,
        scenario: result.scenario,
        outcome: result.outcome,
        confidence: result.confidence,
        features: {}
      }
    }));
  }

  async delete(ids: string[]): Promise<void> {
    const url = `${this.baseUrl}/v1/objects`;
    
    for (const id of ids) {
      await axios.delete(`${url}/${id}`, {
        headers: this.getHeaders()
      });
    }
  }

  async describe(): Promise<any> {
    const url = `${this.baseUrl}/v1/meta`;
    
    const response = await axios.get(url, {
      headers: this.getHeaders()
    });

    return response.data;
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    return headers;
  }
}

// In-memory implementation for development
class InMemoryVectorDB implements VectorDB {
  private vectors: Map<string, VectorRecord> = new Map();

  async upsert(records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      this.vectors.set(record.id, record);
    }
  }

  async query(params: VectorSearchQuery): Promise<SimilarRecord[]> {
    const results: SimilarRecord[] = [];
    
    for (const [id, record] of Array.from(this.vectors.entries())) {
      const similarity = this.cosineSimilarity(params.vector, record.vector);
      
      // Apply filters if specified
      if (params.filter) {
        const passesFilter = Object.entries(params.filter).every(([key, value]) => 
          record.metadata[key as keyof typeof record.metadata] === value
        );
        
        if (!passesFilter) continue;
      }
      
      results.push({
        id,
        score: similarity,
        metadata: record.metadata
      });
    }
    
    // Sort by similarity and take top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, params.topK);
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.vectors.delete(id);
    }
  }

  async describe(): Promise<any> {
    return {
      vectorCount: this.vectors.size,
      dimension: this.vectors.size > 0 ? 
        Array.from(this.vectors.values())[0].vector.length : 0
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export class VectorService {
  private db: VectorDB;
  private openai?: OpenAI;
  private embeddingModel = 'text-embedding-3-small';

  constructor(config: {
    provider: 'pinecone' | 'weaviate' | 'memory';
    pineconeApiKey?: string;
    pineconeEnvironment?: string;
    pineconeIndex?: string;
    weaviateUrl?: string;
    weaviateApiKey?: string;
    openaiApiKey?: string;
  }) {
    // Initialize vector database
    switch (config.provider) {
      case 'pinecone':
        if (!config.pineconeApiKey || !config.pineconeEnvironment) {
          throw new Error('Pinecone API key and environment required');
        }
        this.db = new PineconeDB(
          config.pineconeApiKey,
          config.pineconeEnvironment,
          config.pineconeIndex
        );
        break;
      
      case 'weaviate':
        if (!config.weaviateUrl) {
          throw new Error('Weaviate URL required');
        }
        this.db = new WeaviateDB(
          config.weaviateUrl,
          'TradingScenario',
          config.weaviateApiKey
        );
        break;
      
      default:
        this.db = new InMemoryVectorDB();
        break;
    }

    // Initialize OpenAI for embeddings
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }

    console.log(`[VectorService] Initialized with ${config.provider} provider`);
  }

  async upsertVector(id: string, vector: number[], metadata: VectorRecord['metadata']): Promise<void> {
    const record: VectorRecord = {
      id,
      vector,
      metadata
    };

    await this.db.upsert([record]);
  }

  async upsertTradingScenario(
    id: string,
    features: FeatureVector,
    outcome: 'profit' | 'loss' | 'neutral',
    confidence: number,
    scenario?: string
  ): Promise<void> {
    const vector = this.featuresToVector(features);
    
    const metadata: VectorRecord['metadata'] = {
      symbol: features.meta.symbol,
      timestamp: features.meta.timestamp,
      scenario: scenario || this.generateScenarioDescription(features),
      outcome,
      confidence,
      features: {
        sentiment: features.sentiment,
        derivatives: features.derivatives,
        technical: features.technical
      }
    };

    await this.upsertVector(id, vector, metadata);
  }

  async querySimilar(vector: number[], topK = 5, filter?: Record<string, any>): Promise<SimilarRecord[]> {
    return await this.db.query({
      vector,
      topK,
      filter,
      includeMetadata: true
    });
  }

  async findSimilarScenarios(features: FeatureVector, topK = 5): Promise<SimilarRecord[]> {
    const vector = this.featuresToVector(features);
    
    const filter = {
      symbol: features.meta.symbol
    };

    return await this.querySimilar(vector, topK, filter);
  }

  async getScenarioInsights(features: FeatureVector): Promise<{
    similarScenarios: SimilarRecord[];
    outcomesPrediction: Record<string, number>;
    confidenceScore: number;
    recommendations: string[];
  }> {
    const similar = await this.findSimilarScenarios(features, 10);
    
    if (similar.length === 0) {
      return {
        similarScenarios: [],
        outcomesPrediction: { profit: 0.33, loss: 0.33, neutral: 0.34 },
        confidenceScore: 0.1,
        recommendations: ['No historical data available for similar scenarios']
      };
    }

    // Analyze outcomes
    const outcomeCount = { profit: 0, loss: 0, neutral: 0 };
    let totalConfidence = 0;

    for (const scenario of similar) {
      outcomeCount[scenario.metadata.outcome]++;
      totalConfidence += scenario.metadata.confidence * scenario.score;
    }

    const total = similar.length;
    const outcomesPrediction = {
      profit: outcomeCount.profit / total,
      loss: outcomeCount.loss / total,
      neutral: outcomeCount.neutral / total
    };

    const confidenceScore = totalConfidence / total;

    // Generate recommendations
    const recommendations = this.generateRecommendations(similar, outcomesPrediction);

    return {
      similarScenarios: similar.slice(0, 5), // Return top 5
      outcomesPrediction,
      confidenceScore,
      recommendations
    };
  }

  async createEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      // Fallback to simple text-to-vector conversion
      return this.textToSimpleVector(text);
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('[VectorService] Error creating embedding:', error);
      return this.textToSimpleVector(text);
    }
  }

  async deleteVectors(ids: string[]): Promise<void> {
    await this.db.delete(ids);
  }

  async getStats(): Promise<any> {
    return await this.db.describe();
  }

  // Private helper methods
  private featuresToVector(features: FeatureVector): number[] {
    const vector: number[] = [];
    
    // Price features (last 10 closes normalized)
    const closes = features.ohlcv.close.slice(-10);
    if (closes.length > 0) {
      const lastClose = closes[closes.length - 1];
      vector.push(...closes.map(c => (c - lastClose) / lastClose));
    } else {
      vector.push(...new Array(10).fill(0));
    }
    
    // Technical indicators
    vector.push(
      (features.technical.rsi - 50) / 50, // Normalized RSI
      Math.tanh(features.technical.macd / 100), // Normalized MACD
      features.technical.bollingerBands.position, // BB position
      Math.tanh(features.technical.volatility), // Normalized volatility
      ...features.technical.momentum.map(m => Math.tanh(m * 10)) // Normalized momentum
    );
    
    // Sentiment features
    vector.push(
      (features.sentiment.fearGreedIndex - 50) / 50, // Normalized fear/greed
      features.sentiment.sentimentScore,
      Math.tanh(features.sentiment.socialMentions / 100), // Normalized mentions
      features.sentiment.trendingRank
    );
    
    // Derivatives features
    vector.push(
      Math.tanh(features.derivatives.fundingRate * 1000), // Normalized funding rate
      Math.tanh(features.derivatives.openInterest / 1e9), // Normalized OI
      Math.tanh(features.derivatives.fundingTrend * 1000), // Normalized trend
      Math.tanh((features.derivatives.leverageRatio - 1) / 10) // Normalized leverage
    );
    
    // Order book features
    const bidDepthSum = features.orderBook.bidDepth.reduce((sum, depth) => sum + depth, 0);
    const askDepthSum = features.orderBook.askDepth.reduce((sum, depth) => sum + depth, 0);
    
    vector.push(
      features.orderBook.imbalance, // Already normalized -0.5 to 0.5
      Math.tanh(features.orderBook.spread / 100), // Normalized spread
      Math.tanh(bidDepthSum / 1000), // Normalized bid depth
      Math.tanh(askDepthSum / 1000) // Normalized ask depth
    );
    
    // Macro features
    vector.push(
      features.macroEvents.eventProximity, // Already 0-1
      Math.tanh(features.macroEvents.impactScore), // Normalized impact
      features.macroEvents.marketRegime === 'high-impact-event' ? 1 : 
      features.macroEvents.marketRegime === 'event-driven' ? 0.5 : 0
    );
    
    // On-chain features
    vector.push(
      features.onChain.networkActivity || 0, // Already normalized
      Math.tanh((features.onChain.gasPrice || 0) / 100), // Normalized gas price
      Math.tanh((features.onChain.hashrate || 0) / 1e18) // Normalized hashrate
    );
    
    // Meta features
    vector.push(
      features.meta.marketHours ? 1 : 0,
      Math.tanh(features.meta.volumeProfile), // Normalized volume profile
      Math.tanh(features.meta.priceChange24h * 10) // Normalized price change
    );
    
    return vector;
  }

  private generateScenarioDescription(features: FeatureVector): string {
    const conditions: string[] = [];
    
    // RSI conditions
    if (features.technical.rsi > 70) conditions.push('overbought');
    else if (features.technical.rsi < 30) conditions.push('oversold');
    
    // Sentiment conditions
    if (features.sentiment.fearGreedIndex > 75) conditions.push('extreme-greed');
    else if (features.sentiment.fearGreedIndex < 25) conditions.push('extreme-fear');
    
    // Volatility conditions
    if (features.technical.volatility > 0.5) conditions.push('high-volatility');
    else if (features.technical.volatility < 0.2) conditions.push('low-volatility');
    
    // Funding conditions
    if (features.derivatives.fundingRate > 0.001) conditions.push('high-funding');
    else if (features.derivatives.fundingRate < -0.001) conditions.push('negative-funding');
    
    return conditions.join(' ') || 'normal-market';
  }

  private generateRecommendations(
    scenarios: SimilarRecord[],
    outcomes: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];
    
    // Outcome-based recommendations
    if (outcomes.profit > 0.6) {
      recommendations.push('Strong historical performance in similar scenarios suggests favorable conditions');
    } else if (outcomes.loss > 0.6) {
      recommendations.push('Caution advised: similar scenarios historically resulted in losses');
    } else {
      recommendations.push('Mixed historical outcomes suggest careful position sizing');
    }
    
    // Pattern-based recommendations
    const highConfidenceScenarios = scenarios.filter(s => s.metadata.confidence > 0.7);
    if (highConfidenceScenarios.length > 2) {
      const profitRate = highConfidenceScenarios.filter(s => s.metadata.outcome === 'profit').length / highConfidenceScenarios.length;
      if (profitRate > 0.7) {
        recommendations.push('High-confidence historical scenarios show strong profit potential');
      }
    }
    
    // Recent pattern analysis
    const recentScenarios = scenarios.filter(s => 
      Date.now() - s.metadata.timestamp < 30 * 24 * 60 * 60 * 1000 // Last 30 days
    );
    
    if (recentScenarios.length > 0) {
      const recentProfitRate = recentScenarios.filter(s => s.metadata.outcome === 'profit').length / recentScenarios.length;
      if (recentProfitRate > 0.8) {
        recommendations.push('Recent similar patterns have performed exceptionally well');
      } else if (recentProfitRate < 0.3) {
        recommendations.push('Recent similar patterns have underperformed - consider waiting for better conditions');
      }
    }
    
    return recommendations;
  }

  private textToSimpleVector(text: string): number[] {
    // Simple hash-based vector for fallback
    const words = text.toLowerCase().split(/\s+/);
    const vector = new Array(384).fill(0); // Standard embedding dimension
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const hash = this.simpleHash(word);
      
      for (let j = 0; j < 384; j++) {
        vector[j] += Math.sin((hash + j) * 0.1) / words.length;
      }
    }
    
    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

export default VectorService;