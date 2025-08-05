import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTradingStore } from '@/stores/tradingStore';
import TopNavigation from '@/components/layout/TopNavigation';
import SidebarNavigation from '@/components/layout/SidebarNavigation';
import MarketOverview from '@/components/dashboard/MarketOverview';
import TradingChart from '@/components/trading/TradingChart';
import QuickTradePanel from '@/components/trading/QuickTradePanel';
import AIRecommendations from '@/components/trading/AIRecommendations';
import PortfolioSummary from '@/components/dashboard/PortfolioSummary';
import RecentTrades from '@/components/dashboard/RecentTrades';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';

export default function Dashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const {
    updateMarketPrice,
    updateAgentStatus,
    updateAgentActivities,
    setRecommendations,
    setPositions,
    setRecentTrades,
    setPortfolioSnapshot,
  } = useTradingStore();

  // Handle unauthorized access
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // WebSocket connection for real-time data
  const { isConnected, connectionStatus, sendMessage } = useWebSocket({
    onMessage: (message) => {
      switch (message.type) {
        case 'price_update':
          if (message.data) {
            updateMarketPrice(message.data);
          }
          break;

        case 'agent_update':
          if (message.data) {
            updateAgentStatus(message.data.agentType, {
              status: 'active',
              lastActivity: message.data.activity || 'Processing...',
            });
          }
          break;

        case 'recommendations':
          if (message.data) {
            setRecommendations(message.data);
          }
          break;

        case 'portfolio_data':
          if (message.data) {
            if (message.data.positions) setPositions(message.data.positions);
            if (message.data.recentTrades) setRecentTrades(message.data.recentTrades);
            if (message.data.snapshot) setPortfolioSnapshot(message.data.snapshot);
          }
          break;

        case 'agent_status':
          if (message.data) {
            if (message.data.recentActivities) {
              updateAgentActivities(message.data.recentActivities);
            }
          }
          break;

        case 'system_alert':
          if (message.data) {
            toast({
              title: message.data.type,
              description: message.data.message,
              variant: message.data.severity === 'error' ? 'destructive' : 'default',
            });
          }
          break;

        case 'welcome':
          console.log('Connected to Skippy AI Trading System');
          break;

        case 'error':
          console.error('WebSocket error:', message.data?.error);
          break;
      }
    },
    onConnect: () => {
      if (user) {
        // Authenticate WebSocket connection
        sendMessage({
          type: 'authenticate',
          data: { userId: (user as any).id },
        });

        // Subscribe to major crypto prices
        sendMessage({
          type: 'subscribe_prices',
          data: { symbols: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD', 'DOT/USD'] },
        });

        // Request initial data
        sendMessage({ type: 'get_agent_status' });
        sendMessage({ type: 'get_portfolio' });
        sendMessage({ type: 'get_recommendations' });
      }
    },
    onError: (error) => {
      console.error('WebSocket connection error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to real-time data feed",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4 mx-auto animate-pulse">
            <i className="fas fa-brain text-white text-xl"></i>
          </div>
          <div className="text-white text-lg">Loading Skippy...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <TopNavigation />
      
      <div className="flex h-screen pt-16">
        <SidebarNavigation />
        
        <main className="flex-1 overflow-hidden">
          <div className="h-full grid grid-cols-12 grid-rows-6 gap-4 p-4">
            {/* Market Overview Header */}
            <div className="col-span-12 row-span-1">
              <MarketOverview />
            </div>

            {/* Main Chart */}
            <div className="col-span-8 row-span-4">
              <TradingChart />
            </div>

            {/* Trading Panel */}
            <div className="col-span-4 row-span-2">
              <QuickTradePanel />
            </div>

            {/* AI Recommendations */}
            <div className="col-span-4 row-span-2">
              <AIRecommendations />
            </div>

            {/* Portfolio Summary */}
            <div className="col-span-6 row-span-1">
              <PortfolioSummary />
            </div>

            {/* Recent Trades */}
            <div className="col-span-6 row-span-1">
              <RecentTrades />
            </div>
          </div>
        </main>
      </div>

      {/* WebSocket Status Indicator */}
      <div className="fixed bottom-4 right-4 flex items-center space-x-2 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700" data-testid="websocket-status">
        <div className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
        }`}></div>
        <span className="text-xs text-gray-400">
          {connectionStatus === 'connected' ? 'Live Data Connected' : 'Connecting...'}
        </span>
      </div>
    </div>
  );
}
