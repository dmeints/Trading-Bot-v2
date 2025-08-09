import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, X } from 'lucide-react';

interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export default function PositionsTable() {
  const { data: positionsResponse, isLoading } = useQuery<{success: boolean, data: {positions: Position[]}}>({
    queryKey: ['/api/portfolio/summary'],
    refetchInterval: 5000,
  });
  
  const positions = positionsResponse?.data?.positions || [];

  const { data: account } = useQuery<{equity: number, cash: number, maintenanceMargin: number}>({
    queryKey: ['/api/trading/account'],
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">Loading positions...</div>
        </CardContent>
      </Card>
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

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          Positions
          <div className="text-sm font-normal text-gray-400">
            Account: {formatCurrency(account?.equity || 0)}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No open positions
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className="text-gray-300">Symbol</TableHead>
                  <TableHead className="text-gray-300 text-right">Size</TableHead>
                  <TableHead className="text-gray-300 text-right">Avg Price</TableHead>
                  <TableHead className="text-gray-300 text-right">Market Value</TableHead>
                  <TableHead className="text-gray-300 text-right">Unrealized P&L</TableHead>
                  <TableHead className="text-gray-300 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((position) => {
                  const marketValue = Math.abs(position.quantity) * position.avgPrice;
                  const pnlPercent = position.avgPrice > 0 ? (position.unrealizedPnl / (Math.abs(position.quantity) * position.avgPrice)) * 100 : 0;
                  const isProfit = position.unrealizedPnl >= 0;

                  return (
                    <TableRow key={position.symbol} className="border-gray-700">
                      <TableCell className="font-medium text-white">
                        {position.symbol}
                        <div className="text-xs text-gray-400">
                          {position.quantity > 0 ? 'Long' : 'Short'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-white">
                        {position.quantity.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right text-white">
                        {formatCurrency(position.avgPrice)}
                      </TableCell>
                      <TableCell className="text-right text-white">
                        {formatCurrency(marketValue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <div className={`flex items-center ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                            {isProfit ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                            {formatCurrency(position.unrealizedPnl)}
                          </div>
                          <div className={`text-xs ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                            {formatPercent(pnlPercent)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          data-testid={`close-position-${position.symbol}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        
        {positions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">Total Unrealized P&L:</span>
              <span className={`font-medium ${positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0))}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}