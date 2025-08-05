import { storage } from "../storage";
import { aiOrchestrator } from "./aiAgents";
import type { InsertTrade, InsertPosition, User } from "@shared/schema";

export interface TradeRequest {
  userId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  orderType: 'market' | 'limit' | 'stop';
  price?: number;
  stopPrice?: number;
}

export interface TradeResult {
  success: boolean;
  trade?: any;
  position?: any;
  error?: string;
}

export class TradingEngine {
  async executeTrade(request: TradeRequest): Promise<TradeResult> {
    try {
      const user = await storage.getUser(request.userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // In paper trading mode, simulate the trade
      if (user.tradingMode === 'paper') {
        return await this.executePaperTrade(request);
      }

      // For live trading, integrate with actual exchange APIs
      return await this.executeLiveTrade(request);
    } catch (error) {
      console.error('Trade execution error:', error);
      return { success: false, error: 'Trade execution failed' };
    }
  }

  private async executePaperTrade(request: TradeRequest): Promise<TradeResult> {
    try {
      // Get current market price (simulate or from cache)
      const marketData = await storage.getMarketData(request.symbol);
      const currentPrice = marketData?.price ? parseFloat(marketData.price) : this.getSimulatedPrice(request.symbol);

      const executionPrice = request.orderType === 'market' ? currentPrice : (request.price || currentPrice);
      const fee = (parseFloat(executionPrice.toString()) * request.quantity) * 0.001; // 0.1% fee

      // Create trade record
      const trade: InsertTrade = {
        userId: request.userId,
        symbol: request.symbol,
        side: request.side,
        quantity: request.quantity.toString(),
        price: executionPrice.toString(),
        fee: fee.toString(),
        orderType: request.orderType,
        aiRecommendation: false,
        pnl: '0', // Will be calculated later
      };

      const createdTrade = await storage.createTrade(trade);

      // Update or create position
      const position = await this.updatePosition(request, executionPrice);

      return {
        success: true,
        trade: createdTrade,
        position,
      };
    } catch (error) {
      console.error('Paper trade execution error:', error);
      return { success: false, error: 'Paper trade execution failed' };
    }
  }

  private async executeLiveTrade(request: TradeRequest): Promise<TradeResult> {
    // TODO: Implement live trading with actual exchange APIs
    // For now, fallback to paper trading
    return await this.executePaperTrade(request);
  }

  private async updatePosition(request: TradeRequest, price: number) {
    try {
      const existingPositions = await storage.getUserPositions(request.userId);
      const existingPosition = existingPositions.find(p => p.symbol === request.symbol);

      if (existingPosition) {
        // Update existing position
        const currentQuantity = parseFloat(existingPosition.quantity);
        const newQuantity = request.side === 'buy' 
          ? currentQuantity + request.quantity
          : currentQuantity - request.quantity;

        if (newQuantity <= 0) {
          // Close position
          return await storage.closePosition(existingPosition.id);
        } else {
          // Update position
          const avgPrice = ((currentQuantity * parseFloat(existingPosition.entryPrice)) + (request.quantity * price)) / newQuantity;
          return await storage.updatePosition(existingPosition.id, {
            quantity: newQuantity.toString(),
            entryPrice: avgPrice.toString(),
            currentPrice: price.toString(),
          });
        }
      } else if (request.side === 'buy') {
        // Create new position
        const position: InsertPosition = {
          userId: request.userId,
          symbol: request.symbol,
          side: request.side,
          quantity: request.quantity.toString(),
          entryPrice: price.toString(),
          currentPrice: price.toString(),
        };
        return await storage.createPosition(position);
      }

      return null;
    } catch (error) {
      console.error('Position update error:', error);
      throw error;
    }
  }

  private getSimulatedPrice(symbol: string): number {
    // Simulate realistic crypto prices
    const basePrices: { [key: string]: number } = {
      'BTC/USD': 42000,
      'ETH/USD': 2800,
      'SOL/USD': 98,
      'ADA/USD': 0.5,
      'DOT/USD': 7.5,
    };

    const basePrice = basePrices[symbol] || 100;
    // Add some random variation (±2%)
    const variation = (Math.random() - 0.5) * 0.04;
    return basePrice * (1 + variation);
  }

  async generateAIRecommendation(userId: string, symbol: string) {
    try {
      const user = await storage.getUser(userId);
      const marketData = await storage.getMarketData(symbol);
      const positions = await storage.getUserPositions(userId);

      const analysisData = {
        marketData,
        userPreferences: { riskTolerance: user?.riskTolerance || 'medium' },
        positions,
      };

      const recommendation = await aiOrchestrator.runAgent('trading_agent', analysisData);
      
      if (recommendation.data && recommendation.data.action !== 'hold') {
        // Store recommendation
        await storage.createRecommendation({
          userId,
          symbol,
          action: recommendation.data.action,
          entryPrice: recommendation.data.entry_price?.toString(),
          targetPrice: recommendation.data.target_price?.toString(),
          stopLoss: recommendation.data.stop_loss?.toString(),
          confidence: recommendation.confidence,
          reasoning: recommendation.data.reasoning,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        });
      }

      return recommendation;
    } catch (error) {
      console.error('AI recommendation error:', error);
      throw error;
    }
  }
}

export const tradingEngine = new TradingEngine();
