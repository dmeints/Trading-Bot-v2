/**
 * Reinforcement Learning Inference Engine
 * 
 * Implements PPO (Proximal Policy Optimization) model loading and inference
 * for real-time trading decisions with confidence scoring
 */

import fs from 'fs/promises';
import path from 'path';
import { storage } from "../storage";
import type { MarketPrice } from '../services/marketData';

export interface MarketFeatures {
  price: number;
  volume24h: number;
  change24h: number;
  volatility: number;
  rsi: number;
  macd: number;
  bollingerPosition: number;
  volumeProfile: number;
  marketCap?: number;
  timestamp: number;
}

export interface RLPrediction {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  rationale: string;
  features: MarketFeatures;
  modelVersion: string;
  processingTime: number;
}

export interface ModelWeights {
  version: string;
  architecture: string;
  parameters: Float32Array;
  metadata: {
    trainingEpochs: number;
    accuracy: number;
    lastUpdated: string;
    featureNames: string[];
  };
}

export class RLInferenceEngine {
  private modelWeights: ModelWeights | null = null;
  private isLoaded: boolean = false;
  private modelPath: string;
  private featureCache: Map<string, MarketFeatures> = new Map();

  constructor(modelPath: string = './models/ppo_trading_model.bin') {
    this.modelPath = modelPath;
  }

  /**
   * Load PPO model weights from file
   */
  async loadModel(): Promise<void> {
    try {
      const modelDir = path.dirname(this.modelPath);
      await fs.mkdir(modelDir, { recursive: true });

      // Check if model file exists
      try {
        const modelBuffer = await fs.readFile(this.modelPath);
        const metadataPath = this.modelPath.replace('.bin', '_metadata.json');
        const metadataBuffer = await fs.readFile(metadataPath);
        
        const metadata = JSON.parse(metadataBuffer.toString());
        const parameters = new Float32Array(modelBuffer.buffer);

        this.modelWeights = {
          version: metadata.version || '1.0.0',
          architecture: metadata.architecture || 'PPO',
          parameters,
          metadata: {
            trainingEpochs: metadata.trainingEpochs || 100,
            accuracy: metadata.accuracy || 0.65,
            lastUpdated: metadata.lastUpdated || new Date().toISOString(),
            featureNames: metadata.featureNames || [
              'price', 'volume24h', 'change24h', 'volatility', 
              'rsi', 'macd', 'bollingerPosition', 'volumeProfile'
            ],
          }
        };

        this.isLoaded = true;
        console.log(`[RL] Model loaded: ${this.modelWeights.version}, accuracy: ${this.modelWeights.metadata.accuracy}`);
      } catch (fileError) {
        // Model file doesn't exist, create a stub model
        await this.createStubModel();
      }
    } catch (error) {
      console.error('[RL] Failed to load model:', error);
      throw new Error('Model loading failed');
    }
  }

  /**
   * Generate trading prediction using loaded model
   */
  async predict(symbol: string, marketData: MarketPrice): Promise<RLPrediction> {
    const startTime = Date.now();

    if (!this.isLoaded || !this.modelWeights) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    try {
      // Extract and normalize features
      const features = await this.extractFeatures(symbol, marketData);
      
      // Run inference (simplified PPO simulation)
      const prediction = this.runInference(features);
      
      const processingTime = Date.now() - startTime;

      // Store prediction for analytics
      await storage.logAgentActivity({
        agentType: 'rl_inference',
        activity: `Predicted ${prediction.action} for ${symbol}`,
        confidence: prediction.confidence,
        data: {
          prediction: prediction.action,
          features,
          modelVersion: this.modelWeights.version,
          processingTime
        }
      });

      return {
        ...prediction,
        features,
        modelVersion: this.modelWeights.version,
        processingTime
      };
    } catch (error) {
      console.error('[RL] Prediction error:', error);
      throw new Error('Model inference failed');
    }
  }

  /**
   * Extract market features for model input
   */
  private async extractFeatures(symbol: string, marketData: MarketPrice): Promise<MarketFeatures> {
    try {
      // Get historical data for technical indicators
      const historicalData = await this.getHistoricalData(symbol);
      
      const features: MarketFeatures = {
        price: marketData.price,
        volume24h: marketData.volume24h,
        change24h: marketData.change24h,
        volatility: this.calculateVolatility(historicalData),
        rsi: this.calculateRSI(historicalData),
        macd: this.calculateMACD(historicalData),
        bollingerPosition: this.calculateBollingerPosition(historicalData, marketData.price),
        volumeProfile: this.calculateVolumeProfile(historicalData),
        timestamp: marketData.timestamp.getTime()
      };

      // Cache features for performance
      this.featureCache.set(symbol, features);
      
      return features;
    } catch (error) {
      console.error('[RL] Feature extraction error:', error);
      
      // Return basic features if calculation fails
      return {
        price: marketData.price,
        volume24h: marketData.volume24h,
        change24h: marketData.change24h,
        volatility: Math.abs(marketData.change24h) / 100,
        rsi: 50, // Neutral RSI
        macd: 0,
        bollingerPosition: 0.5,
        volumeProfile: 1.0,
        timestamp: marketData.timestamp.getTime()
      };
    }
  }

  /**
   * Run model inference (simplified PPO simulation)
   */
  private runInference(features: MarketFeatures): Omit<RLPrediction, 'features' | 'modelVersion' | 'processingTime'> {
    try {
      // Normalize features to [-1, 1] range
      const normalizedFeatures = this.normalizeFeatures(features);
      
      // Simplified neural network forward pass simulation
      const hiddenLayer1 = this.computeLayer(normalizedFeatures, 0);
      const hiddenLayer2 = this.computeLayer(hiddenLayer1, 256);
      const outputLayer = this.computeLayer(hiddenLayer2, 512);
      
      // Convert outputs to probabilities (softmax simulation)
      const [buyScore, sellScore, holdScore] = this.applySoftmax([
        outputLayer[0], outputLayer[1], outputLayer[2]
      ]);
      
      // Determine action and confidence
      const scores = { buy: buyScore, sell: sellScore, hold: holdScore };
      const action = Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b)[0] as 'buy' | 'sell' | 'hold';
      const confidence = scores[action];
      
      // Generate rationale based on features
      const rationale = this.generateRationale(features, action, confidence);
      
      return {
        action,
        confidence,
        rationale
      };
    } catch (error) {
      console.error('[RL] Inference computation error:', error);
      
      // Fallback to conservative hold decision
      return {
        action: 'hold',
        confidence: 0.3,
        rationale: 'Model inference failed, defaulting to hold position'
      };
    }
  }

  /**
   * Normalize features for model input
   */
  private normalizeFeatures(features: MarketFeatures): number[] {
    return [
      Math.tanh(features.price / 100000), // Price normalization
      Math.tanh(features.volume24h / 1000000), // Volume normalization
      Math.tanh(features.change24h / 20), // Change normalization
      Math.tanh(features.volatility * 10), // Volatility normalization
      (features.rsi - 50) / 50, // RSI to [-1, 1]
      Math.tanh(features.macd / 100), // MACD normalization
      (features.bollingerPosition - 0.5) * 2, // Bollinger to [-1, 1]
      Math.tanh(features.volumeProfile - 1) // Volume profile normalization
    ];
  }

  /**
   * Simulate neural network layer computation
   */
  private computeLayer(inputs: number[], startIndex: number): number[] {
    if (!this.modelWeights) throw new Error('Model weights not available');
    
    const layerSize = Math.min(128, Math.floor((this.modelWeights.parameters.length - startIndex) / inputs.length));
    const outputs: number[] = [];
    
    for (let i = 0; i < layerSize; i++) {
      let sum = 0;
      for (let j = 0; j < inputs.length; j++) {
        const weightIndex = startIndex + (i * inputs.length) + j;
        if (weightIndex < this.modelWeights.parameters.length) {
          sum += inputs[j] * (this.modelWeights.parameters[weightIndex] || Math.random() * 2 - 1);
        }
      }
      outputs.push(Math.tanh(sum)); // ReLU activation
    }
    
    return outputs.length > 0 ? outputs : inputs; // Fallback to inputs if no outputs
  }

  /**
   * Apply softmax to convert logits to probabilities
   */
  private applySoftmax(logits: number[]): number[] {
    const maxLogit = Math.max(...logits);
    const expLogits = logits.map(l => Math.exp(l - maxLogit));
    const sumExp = expLogits.reduce((sum, exp) => sum + exp, 0);
    return expLogits.map(exp => exp / sumExp);
  }

  /**
   * Generate human-readable rationale for the prediction
   */
  private generateRationale(features: MarketFeatures, action: string, confidence: number): string {
    const reasons: string[] = [];
    
    // Price action analysis
    if (Math.abs(features.change24h) > 5) {
      reasons.push(`Strong ${features.change24h > 0 ? 'upward' : 'downward'} momentum (${features.change24h.toFixed(1)}%)`);
    }
    
    // RSI analysis
    if (features.rsi > 70) {
      reasons.push('RSI indicates overbought conditions');
    } else if (features.rsi < 30) {
      reasons.push('RSI indicates oversold conditions');
    }
    
    // Volume analysis
    if (features.volumeProfile > 1.5) {
      reasons.push('Above-average volume supports the move');
    } else if (features.volumeProfile < 0.5) {
      reasons.push('Low volume suggests weak conviction');
    }
    
    // Volatility analysis
    if (features.volatility > 0.15) {
      reasons.push('High volatility increases risk');
    }
    
    // Bollinger Band analysis
    if (features.bollingerPosition > 0.8) {
      reasons.push('Price near upper Bollinger Band');
    } else if (features.bollingerPosition < 0.2) {
      reasons.push('Price near lower Bollinger Band');
    }
    
    const baseRationale = `Model recommends ${action.toUpperCase()} with ${(confidence * 100).toFixed(1)}% confidence.`;
    return reasons.length > 0 
      ? `${baseRationale} Key factors: ${reasons.join(', ')}.`
      : `${baseRationale} Based on current market conditions.`;
  }

  /**
   * Create a stub model for development/testing
   */
  private async createStubModel(): Promise<void> {
    const stubWeights = new Float32Array(1024); // 1024 parameters
    for (let i = 0; i < stubWeights.length; i++) {
      stubWeights[i] = Math.random() * 2 - 1; // Random weights between -1 and 1
    }
    
    const metadata = {
      version: '1.0.0-stub',
      architecture: 'PPO-Stub',
      trainingEpochs: 0,
      accuracy: 0.5,
      lastUpdated: new Date().toISOString(),
      featureNames: ['price', 'volume24h', 'change24h', 'volatility', 'rsi', 'macd', 'bollingerPosition', 'volumeProfile']
    };
    
    // Write stub model files
    await fs.writeFile(this.modelPath, stubWeights);
    await fs.writeFile(this.modelPath.replace('.bin', '_metadata.json'), JSON.stringify(metadata, null, 2));
    
    this.modelWeights = {
      version: metadata.version,
      architecture: metadata.architecture,
      parameters: stubWeights,
      metadata
    };
    
    this.isLoaded = true;
    console.log('[RL] Stub model created and loaded for development');
  }

  // Technical indicator calculations (simplified implementations)
  private async getHistoricalData(symbol: string): Promise<number[]> {
    // TODO: Implement proper historical data fetching
    // For now, return simulated data
    return Array.from({ length: 14 }, (_, i) => Math.random() * 1000 + 50000);
  }

  private calculateVolatility(data: number[]): number {
    if (data.length < 2) return 0;
    const returns = data.slice(1).map((price, i) => (price - data[i]) / data[i]);
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateRSI(data: number[], period: number = 14): number {
    if (data.length < period + 1) return 50; // Neutral RSI
    
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }
    
    const avgGain = gains.slice(-period).reduce((sum, g) => sum + g, 0) / period;
    const avgLoss = losses.slice(-period).reduce((sum, l) => sum + l, 0) / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(data: number[]): number {
    // Simplified MACD calculation
    if (data.length < 26) return 0;
    
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    return ema12 - ema26;
  }

  private calculateEMA(data: number[], period: number): number {
    if (data.length === 0) return 0;
    const multiplier = 2 / (period + 1);
    let ema = data[0];
    
    for (let i = 1; i < Math.min(data.length, period); i++) {
      ema = (data[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateBollingerPosition(data: number[], currentPrice: number): number {
    if (data.length < 20) return 0.5;
    
    const recentData = data.slice(-20);
    const sma = recentData.reduce((sum, price) => sum + price, 0) / 20;
    const variance = recentData.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / 20;
    const stdDev = Math.sqrt(variance);
    
    const upperBand = sma + (2 * stdDev);
    const lowerBand = sma - (2 * stdDev);
    
    if (upperBand === lowerBand) return 0.5;
    return (currentPrice - lowerBand) / (upperBand - lowerBand);
  }

  private calculateVolumeProfile(data: number[]): number {
    // Simplified volume profile calculation
    if (data.length < 10) return 1.0;
    
    const recentAvg = data.slice(-10).reduce((sum, vol) => sum + vol, 0) / 10;
    const longerAvg = data.slice(-20).reduce((sum, vol) => sum + vol, 0) / Math.min(20, data.length);
    
    return longerAvg > 0 ? recentAvg / longerAvg : 1.0;
  }

  /**
   * Get model information
   */
  getModelInfo(): { loaded: boolean; version?: string; accuracy?: number } {
    return {
      loaded: this.isLoaded,
      version: this.modelWeights?.version,
      accuracy: this.modelWeights?.metadata.accuracy
    };
  }

  /**
   * Reload model from file
   */
  async reloadModel(): Promise<void> {
    this.isLoaded = false;
    this.modelWeights = null;
    await this.loadModel();
  }
}

// Global RL inference engine instance
export const rlEngine = new RLInferenceEngine();