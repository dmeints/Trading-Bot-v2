import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import TopNavigation from '@/components/layout/TopNavigation';
import SidebarNavigation from '@/components/layout/SidebarNavigation';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import MarketOverview from '@/components/dashboard/MarketOverview';
import TradingChart from '@/components/trading/TradingChart';
import QuickTradePanel from '@/components/trading/QuickTradePanel';
import AIRecommendations from '@/components/trading/AIRecommendations';
import PortfolioSummary from '@/components/dashboard/PortfolioSummary';
import RecentTrades from '@/components/dashboard/RecentTrades';
import { AdaptiveCard } from '@/components/ui/adaptive-card';
import { StatusIndicator, DataFreshness, TradingStatus } from '@/components/ui/status-indicator';
import { FeedbackWidget } from '@/components/ui/feedback-widget';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import { Settings, Expand } from 'lucide-react';

export default function Dashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { userLevel } = useUIStore();
  const {
    updateMarketPrice,
    updateAgentStatus,
    updateAgentActivities,
    setRecommendations,
    setPositions,
    setRecentTrades,
    setPortfolioSnapshot,
    marketPrices,
    agentStatuses,
    tradingMode,
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
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <TopNavigation />
      
      <div className="flex flex-1 min-h-0">
        <SidebarNavigation />
        
        <main className="flex-1 lg:ml-64 min-h-0">
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0 overflow-auto p-4 pt-20 lg:pt-6">
              <div className="dashboard-grid max-w-7xl mx-auto" data-testid="dashboard-grid">
                
                {/* Market Overview with Enhanced Status */}
                <AdaptiveCard
                  title="Market Overview"
                  level={userLevel}
                  status="live"
                  className="col-span-1 md:col-span-2 min-h-0"
                  actions={[
                    { icon: <Settings className="w-3 h-3" />, label: "Configure", onClick: () => {} },
                    { icon: <Expand className="w-3 h-3" />, label: "Fullscreen", onClick: () => {} }
                  ]}
                >
                  <div className="flex justify-between items-center mb-4">
                    <TradingStatus
                      isMarketOpen={true}
                      hasActiveOrders={false}
                      connectionStatus={isConnected ? 'connected' : 'disconnected'}
                    />
                    <DataFreshness lastUpdate={new Date()} threshold={5} />
                  </div>
                  <MarketOverview />
                </AdaptiveCard>

                {/* Trading Chart */}
                <AdaptiveCard
                  title="Live Trading Chart"
                  level={userLevel}
                  status="live"
                  className="col-span-1 md:col-span-2 lg:col-span-3 min-h-0"
                  expandable={false}
                >
                  <TradingChart />
                </AdaptiveCard>

                {/* Quick Trade Panel */}
                <AdaptiveCard
                  title="Quick Trade"
                  level={userLevel}
                  status={tradingMode === 'paper' ? 'delayed' : 'live'}
                  className="col-span-1 min-h-0"
                >
                  <QuickTradePanel />
                </AdaptiveCard>

                {/* AI Recommendations */}
                <AdaptiveCard
                  title="AI Analysis"
                  level={userLevel}
                  status="live"
                  className="col-span-1 md:col-span-2 min-h-0"
                  actions={[
                    { icon: <Settings className="w-3 h-3" />, label: "Configure AI", onClick: () => {} }
                  ]}
                >
                  <div className="mb-3 flex space-x-2">
                    {Object.entries(agentStatuses).map(([type, status]) => (
                      <div key={type} className="flex items-center space-x-1">
                        <StatusIndicator 
                          status={status.status === 'active' ? 'online' : 'offline'} 
                          size="sm" 
                        />
                        <span className="text-xs text-gray-400 capitalize">{type}</span>
                      </div>
                    ))}
                  </div>
                  <AIRecommendations />
                </AdaptiveCard>

                {/* Portfolio Summary */}
                <AdaptiveCard
                  title="Portfolio"
                  level={userLevel}
                  status="live"
                  className="col-span-1 lg:col-span-2 min-h-0"
                >
                  <PortfolioSummary />
                </AdaptiveCard>

                {/* Recent Trades */}
                <AdaptiveCard
                  title="Recent Activity"
                  level={userLevel}
                  status="live"
                  className="col-span-1 md:col-span-2 min-h-0"
                >
                  <RecentTrades />
                </AdaptiveCard>

              </div>
            </div>
          </div>
        </main>
      </div>
      
      <MobileBottomNav />
      <FeedbackWidget />
    </div>
  );
}
