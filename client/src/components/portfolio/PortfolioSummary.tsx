import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Percent, Activity } from 'lucide-react';

interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export default function PortfolioSummary() {
  const { data: account, isLoading: accountLoading } = useQuery<{equity: number, cash: number, maintenanceMargin: number}>({
    queryKey: ['/api/trading/account'],
    refetchInterval: 5000,
  });

  const { data: positions = [] } = useQuery<Position[]>({
    queryKey: ['/api/trading/positions'],
    refetchInterval: 5000,
  });

  const { data: fills = [] } = useQuery<any[]>({
    queryKey: ['/api/trading/fills'],
    refetchInterval: 10000,
  });

  if (accountLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="text-center text-gray-400">Loading...</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${(value >= 0 ? '+' : '')}${value.toFixed(2)}%`;
  };

  // Calculate portfolio metrics
  const totalEquity = account?.equity || 0;
  const totalCash = account?.cash || 0;
  const totalUnrealizedPnL = positions.reduce((sum: number, pos: any) => sum + (pos.unrealizedPnl || 0), 0);
  const totalRealizedPnL = positions.reduce((sum: number, pos: any) => sum + (pos.realizedPnl || 0), 0);
  
  // Today's P&L calculation (simplified - would need historical data for accurate calculation)
  const todaysPnL = totalUnrealizedPnL; // Simplified for now
  const todaysPnLPercent = totalEquity > 0 ? (todaysPnL / totalEquity) * 100 : 0;
  
  const isPositiveDay = todaysPnL >= 0;
  const activePositions = positions.length;
  const utilizationPercent = totalEquity > 0 ? ((totalEquity - totalCash) / totalEquity) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
      {/* Total Portfolio Value */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="flex flex-row items-center space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Total Equity</CardTitle>
          <DollarSign className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(totalEquity)}
          </div>
          <p className="text-xs text-gray-400">
            Cash: {formatCurrency(totalCash)}
          </p>
        </CardContent>
      </Card>

      {/* Today's P&L */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="flex flex-row items-center space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Today's P&L</CardTitle>
          {isPositiveDay ? (
            <TrendingUp className="h-4 w-4 text-green-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-400" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${isPositiveDay ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(todaysPnL)}
          </div>
          <p className={`text-xs ${isPositiveDay ? 'text-green-400' : 'text-red-400'}`}>
            {formatPercent(todaysPnLPercent)}
          </p>
        </CardContent>
      </Card>

      {/* Total Unrealized P&L */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="flex flex-row items-center space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Unrealized P&L</CardTitle>
          <Percent className="h-4 w-4 text-purple-400" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(totalUnrealizedPnL)}
          </div>
          <p className="text-xs text-gray-400">
            Realized: {formatCurrency(totalRealizedPnL)}
          </p>
        </CardContent>
      </Card>

      {/* Active Positions */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="flex flex-row items-center space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Active Positions</CardTitle>
          <Activity className="h-4 w-4 text-orange-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {activePositions}
          </div>
          <p className="text-xs text-gray-400">
            {formatPercent(utilizationPercent)} utilized
          </p>
        </CardContent>
      </Card>
    </div>
  );
}