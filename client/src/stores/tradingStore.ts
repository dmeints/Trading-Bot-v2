import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface MarketPrice {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  timestamp: Date;
}

interface Position {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: string;
  entryPrice: string;
  currentPrice: string;
  unrealizedPnl: string;
  status: string;
}

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  fee: string;
  pnl: string;
  executedAt: string;
}

interface AgentActivity {
  id: string;
  agentType: string;
  activity: string;
  confidence: number;
  createdAt: string;
}

interface Recommendation {
  id: string;
  symbol: string;
  action: string;
  entryPrice?: string;
  targetPrice?: string;
  stopLoss?: string;
  confidence: number;
  reasoning?: string;
  status: string;
  createdAt: string;
}

interface PortfolioSnapshot {
  totalValue: string;
  dailyPnl: string;
  totalPnl: string;
  winRate: number;
  sharpeRatio: number;
}

interface TradingState {
  // Market data
  marketPrices: Record<string, MarketPrice>;
  selectedSymbol: string;
  
  // Trading
  positions: Position[];
  recentTrades: Trade[];
  
  // AI Agents
  agentActivities: AgentActivity[];
  agentStatus: Record<string, { status: string; lastActivity: string }>;
  
  // Recommendations
  recommendations: Recommendation[];
  
  // Portfolio
  portfolioSnapshot: PortfolioSnapshot | null;
  
  // UI State
  tradingMode: 'paper' | 'live';
  isTrading: boolean;
  
  // Actions
  updateMarketPrice: (price: MarketPrice) => void;
  setSelectedSymbol: (symbol: string) => void;
  setPositions: (positions: Position[]) => void;
  setRecentTrades: (trades: Trade[]) => void;
  addTrade: (trade: Trade) => void;
  updateAgentActivities: (activities: AgentActivity[]) => void;
  updateAgentStatus: (agentType: string, status: { status: string; lastActivity: string }) => void;
  setRecommendations: (recommendations: Recommendation[]) => void;
  setPortfolioSnapshot: (snapshot: PortfolioSnapshot) => void;
  setTradingMode: (mode: 'paper' | 'live') => void;
  setIsTrading: (isTrading: boolean) => void;
}

export const useTradingStore = create<TradingState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    marketPrices: {},
    selectedSymbol: 'BTC/USD',
    positions: [],
    recentTrades: [],
    agentActivities: [],
    agentStatus: {
      market_analyst: { status: 'active', lastActivity: 'Analyzing market trends' },
      news_analyst: { status: 'active', lastActivity: 'Processing sentiment' },
      trading_agent: { status: 'active', lastActivity: 'Scanning opportunities' },
      risk_assessor: { status: 'active', lastActivity: 'Monitoring exposure' },
      sentiment_analyst: { status: 'active', lastActivity: 'Reading social signals' },
    },
    recommendations: [],
    portfolioSnapshot: null,
    tradingMode: 'paper',
    isTrading: false,

    // Actions
    updateMarketPrice: (price) =>
      set((state) => ({
        marketPrices: {
          ...state.marketPrices,
          [price.symbol]: price,
        },
      })),

    setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),

    setPositions: (positions) => set({ positions }),

    setRecentTrades: (trades) => set({ recentTrades: trades }),

    addTrade: (trade) =>
      set((state) => ({
        recentTrades: [trade, ...state.recentTrades.slice(0, 9)], // Keep last 10 trades
      })),

    updateAgentActivities: (activities) => set({ agentActivities: activities }),

    updateAgentStatus: (agentType, status) =>
      set((state) => ({
        agentStatus: {
          ...state.agentStatus,
          [agentType]: status,
        },
      })),

    setRecommendations: (recommendations) => set({ recommendations }),

    setPortfolioSnapshot: (snapshot) => set({ portfolioSnapshot: snapshot }),

    setTradingMode: (mode) => set({ tradingMode: mode }),

    setIsTrading: (isTrading) => set({ isTrading }),
  }))
);

// Selectors
export const useMarketPrice = (symbol: string) =>
  useTradingStore((state) => state.marketPrices[symbol]);

export const useSelectedMarketPrice = () =>
  useTradingStore((state) => state.marketPrices[state.selectedSymbol]);

export const useAgentByType = (agentType: string) =>
  useTradingStore((state) => state.agentStatus[agentType]);
