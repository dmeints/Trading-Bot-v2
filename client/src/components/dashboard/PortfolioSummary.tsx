import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { useTradingStore } from '@/stores/tradingStore';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useEffect } from 'react';

interface PortfolioData {
  snapshot?: {
    totalValue: string;
    dailyPnl: string;
    totalPnl: string;
    winRate: number;
    sharpeRatio: number;
  };
  positions: any[];
  recentTrades: any[];
}

export default function PortfolioSummary() {
  const { portfolioSnapshot, setPortfolioSnapshot } = useTradingStore();

  const { data: portfolioData, isLoading } = useQuery<PortfolioData>({
    queryKey: ['/api/portfolio/summary'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  useEffect(() => {
    if (portfolioData?.snapshot) {
      setPortfolioSnapshot(portfolioData.snapshot);
    }
  }, [portfolioData, setPortfolioSnapshot]);

  const displaySnapshot = portfolioSnapshot || portfolioData?.snapshot;

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (isLoading && !displaySnapshot) {
    return (
      <Card className="bg-gray-800 border-gray-700 p-4 h-full">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4 w-48"></div>
          <div className="flex space-x-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="text-center">
                <div className="h-4 bg-gray-700 rounded mb-2 w-20"></div>
                <div className="h-6 bg-gray-700 rounded w-24"></div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const dailyPnl = displaySnapshot?.dailyPnl ? parseFloat(displaySnapshot.dailyPnl) : 0;
  const totalPnl = displaySnapshot?.totalPnl ? parseFloat(displaySnapshot.totalPnl) : 0;

  return (
    <Card className="bg-gray-800 border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Portfolio Performance</h3>
        <div className="flex items-center space-x-4">
          
          <div className="text-center">
            <div className="text-sm text-gray-400">Today's P&L</div>
            <div 
              className={`text-lg font-semibold flex items-center ${
                dailyPnl >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
              data-testid="text-daily-pnl"
            >
              {dailyPnl >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {formatCurrency(dailyPnl)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-sm text-gray-400">Total P&L</div>
            <div 
              className={`text-lg font-semibold flex items-center ${
                totalPnl >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
              data-testid="text-total-pnl"
            >
              {totalPnl >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {formatCurrency(totalPnl)}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-sm text-gray-400">Win Rate</div>
            <div className="text-lg font-semibold text-white" data-testid="text-win-rate">
              {displaySnapshot?.winRate ? formatPercentage(displaySnapshot.winRate) : '0.0%'}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-sm text-gray-400">Sharpe Ratio</div>
            <div className="text-lg font-semibold text-white" data-testid="text-sharpe-ratio">
              {displaySnapshot?.sharpeRatio ? displaySnapshot.sharpeRatio.toFixed(2) : '0.00'}
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm text-gray-400">Portfolio Value</div>
            <div className="text-lg font-semibold text-blue-400 flex items-center" data-testid="text-portfolio-value-summary">
              <DollarSign className="w-4 h-4 mr-1" />
              {displaySnapshot?.totalValue ? formatCurrency(displaySnapshot.totalValue) : '$0.00'}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
