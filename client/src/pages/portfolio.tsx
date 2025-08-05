import { useAuth } from '@/hooks/useAuth';
import TopNavigation from '@/components/layout/TopNavigation';
import SidebarNavigation from '@/components/layout/SidebarNavigation';
import PortfolioSummary from '@/components/dashboard/PortfolioSummary';
import RecentTrades from '@/components/dashboard/RecentTrades';
import { Card } from '@/components/ui/card';
import { useTradingStore } from '@/stores/tradingStore';

export default function Portfolio() {
  const { isAuthenticated, isLoading } = useAuth();
  const { positions } = useTradingStore();

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
            <h1 className="text-2xl font-bold mb-6">Portfolio Overview</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <PortfolioSummary />
              <Card className="bg-gray-800 border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Open Positions</h3>
                {positions.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    No open positions
                  </div>
                ) : (
                  <div className="space-y-3">
                    {positions.slice(0, 5).map((position) => (
                      <div 
                        key={position.id} 
                        className="flex items-center justify-between p-3 bg-gray-700 rounded"
                        data-testid={`position-${position.id}`}
                      >
                        <div>
                          <div className="font-medium">{position.symbol}</div>
                          <div className="text-sm text-gray-400">
                            {position.side.toUpperCase()} • {parseFloat(position.quantity).toFixed(6)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${parseFloat(position.currentPrice).toLocaleString()}</div>
                          <div className={`text-sm ${parseFloat(position.unrealizedPnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${parseFloat(position.unrealizedPnl).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
            
            <RecentTrades />
          </div>
        </main>
      </div>
    </div>
  );
}