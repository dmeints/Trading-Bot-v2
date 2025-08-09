import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import TopNavigation from '@/components/layout/TopNavigation';
import SidebarNavigation from '@/components/layout/SidebarNavigation';
import TradingChart from '@/components/trading/TradingChart';
import AdvancedChart from '@/components/trading/AdvancedChart';
import QuickTradePanel from '@/components/trading/QuickTradePanel';
import AdvancedOrderPanel from '@/components/trading/AdvancedOrderPanel';
import QuotePanel from '@/components/trade/QuotePanel';
import OrderTicket from '@/components/trade/OrderTicket';
import OrderBook from '@/components/trading/OrderBook';
import AIRecommendations from '@/components/trading/AIRecommendations';
import SocialTradingFeed from '@/components/social/SocialTradingFeed';
import WatchlistPanel from '@/components/trading/WatchlistPanel';
import DepthOfMarketHeatmap from '@/components/trading/DepthOfMarketHeatmap';
import ChartIndicatorsPanel from '@/components/trading/ChartIndicatorsPanel';
import ChartDrawingTools from '@/components/trading/ChartDrawingTools';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import TradingNotifications from '@/components/notifications/TradingNotifications';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Trading() {
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedDrawingTool, setSelectedDrawingTool] = useState<'select' | 'trendline' | 'horizontal' | 'vertical' | 'rectangle' | 'circle' | 'text' | 'fibonacci'>('select');
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding for first-time users (check localStorage)
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('skippy-tour-completed');
    if (!hasSeenTour && isAuthenticated) {
      setShowOnboarding(true);
    }
  }, [isAuthenticated]);

  const handleCompleteTour = () => {
    localStorage.setItem('skippy-tour-completed', 'true');
    setShowOnboarding(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/api/login";
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <TopNavigation />
      
      <div className="flex pt-16">
        <SidebarNavigation />
        
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Advanced Trading</h1>
            
            <Tabs defaultValue="trading" className="w-full">
              <TabsList className="grid grid-cols-4 w-full max-w-md bg-gray-800 mb-6">
                <TabsTrigger value="trading" className="text-white data-[state=active]:bg-blue-600">
                  Trading
                </TabsTrigger>
                <TabsTrigger value="advanced" className="text-white data-[state=active]:bg-blue-600">
                  Advanced
                </TabsTrigger>
                <TabsTrigger value="analytics" className="text-white data-[state=active]:bg-blue-600">
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="social" className="text-white data-[state=active]:bg-blue-600">
                  Social
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="trading" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-16rem)]">
                  {/* Left sidebar with watchlist and depth */}
                  <div className="space-y-6" data-tour="watchlist-panel">
                    <div className="h-1/2">
                      <WatchlistPanel />
                    </div>
                    <div className="h-1/2">
                      <DepthOfMarketHeatmap />
                    </div>
                  </div>
                  
                  {/* Trading Chart - Takes 2 columns */}
                  <div className="lg:col-span-2" data-testid="trading-chart">
                    <TradingChart />
                  </div>
                  
                  {/* Right sidebar with trade panel and indicators */}
                  <div className="space-y-6">
                    <div className="h-1/3">
                      <QuotePanel />
                    </div>
                    <div className="h-1/3">
                      <OrderTicket />
                    </div>
                    <div className="h-1/3">
                      <AIRecommendations />
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-16rem)]">
                  {/* Advanced Chart */}
                  <div className="lg:col-span-3">
                    <AdvancedChart />
                  </div>
                  
                  {/* Trading Tools */}
                  <div className="space-y-6 h-full overflow-y-auto">
                    <OrderBook />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <OrderTicket />
                  <AIRecommendations />
                </div>
              </TabsContent>
              
              <TabsContent value="analytics" className="space-y-6">
                <div className="text-center py-12">
                  <h3 className="text-xl font-semibold text-white mb-4">
                    Advanced Analytics Coming Soon
                  </h3>
                  <p className="text-gray-400 mb-8">
                    Comprehensive portfolio analytics and performance insights will be available in the next update.
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="social" className="space-y-6">
                <SocialTradingFeed />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}