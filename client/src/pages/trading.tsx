import { useAuth } from '@/hooks/useAuth';
import TopNavigation from '@/components/layout/TopNavigation';
import SidebarNavigation from '@/components/layout/SidebarNavigation';
import TradingChart from '@/components/trading/TradingChart';
import QuickTradePanel from '@/components/trading/QuickTradePanel';
import AIRecommendations from '@/components/trading/AIRecommendations';

export default function Trading() {
  const { isAuthenticated, isLoading } = useAuth();

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
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
              {/* Trading Chart - Takes 2 columns */}
              <div className="lg:col-span-2">
                <TradingChart />
              </div>
              
              {/* Right sidebar with trade panel and recommendations */}
              <div className="space-y-6">
                <div className="h-1/2">
                  <QuickTradePanel />
                </div>
                <div className="h-1/2">
                  <AIRecommendations />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}