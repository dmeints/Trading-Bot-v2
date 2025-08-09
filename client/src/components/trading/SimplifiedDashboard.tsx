import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, AlertTriangle, Activity } from "lucide-react";

interface MarketData {
  symbol: string;
  price: number;
  change24h?: number;
  volume?: number;
}

interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
}

interface PortfolioSummary {
  positions: Position[];
  summary: {
    totalValue: number;
    totalPnL: number;
    positionCount: number;
    lastUpdated: string | Date;
  };
}

export default function SimplifiedDashboard() {
  const { data: marketData } = useQuery<MarketData[]>({
    queryKey: ['/api/market/latest'],
    refetchInterval: 30000,
  });

  const { data: portfolioData } = useQuery<PortfolioSummary>({
    queryKey: ['/api/portfolio/summary'],
    refetchInterval: 10000,
  });

  const { data: agentStatus } = useQuery<Record<string, string>>({
    queryKey: ['/api/ai/status'],
    refetchInterval: 30000,
  });

  // Extract portfolio metrics
  const positions = portfolioData?.positions || [];
  const totalPnL = portfolioData?.summary.totalPnL || 0;
  const totalValue = portfolioData?.summary.totalValue || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Trading Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Badge variant={agentStatus?.market_insight === 'active' ? 'default' : 'secondary'}>
            AI Agent: {agentStatus?.market_insight || 'Offline'}
          </Badge>
        </div>
      </div>

      {/* Market Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {marketData?.slice(0, 4).map((market) => (
          <Card key={market.symbol} className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">
                {market.symbol}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                ${market.price.toLocaleString()}
              </div>
              {market.change24h && (
                <div className={`flex items-center text-sm ${
                  market.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {market.change24h >= 0 ? (
                    <TrendingUp className="w-4 h-4 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 mr-1" />
                  )}
                  {Math.abs(market.change24h || 0).toFixed(2)}%
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Portfolio Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-gray-400">Total Value</div>
              <div className="text-2xl font-bold text-white">
                ${totalValue.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Total P&L</div>
              <div className={`text-xl font-semibold ${
                totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                ${totalPnL > 0 ? '+' : ''}${totalPnL.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Open Positions</div>
              <div className="text-lg font-medium text-white">
                {positions.length}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Positions */}
        <Card className="lg:col-span-2 bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Active Positions</CardTitle>
          </CardHeader>
          <CardContent>
            {positions && positions.length > 0 ? (
              <div className="space-y-3">
                {positions.slice(0, 5).map((position, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-700 rounded">
                    <div>
                      <div className="font-medium text-white">{position.symbol}</div>
                      <div className="text-sm text-gray-400">
                        {position.quantity} @ ${position.avgPrice}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${
                        position.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        ${position.unrealizedPnl > 0 ? '+' : ''}{(position.unrealizedPnl || 0).toFixed(2)}
                      </div>
                      <div className={`text-sm ${
                        ((position.unrealizedPnl / (position.quantity * position.avgPrice)) * 100) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {((position.unrealizedPnl / (position.quantity * position.avgPrice)) * 100) > 0 ? '+' : ''}
                        {(((position.unrealizedPnl || 0) / ((position.quantity || 1) * (position.avgPrice || 1))) * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Activity className="w-8 h-8 mx-auto mb-2" />
                <p>No active positions</p>
                <p className="text-sm">Start trading to see positions here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              View All Positions
            </Button>
            <Button variant="outline" size="sm">
              Market Analysis
            </Button>
            <Button variant="outline" size="sm">
              Trading History
            </Button>
            <Button variant="outline" size="sm">
              Risk Assessment
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights Preview */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Market Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
              <div>
                <div className="text-sm font-medium text-white">Market Insight Agent</div>
                <div className="text-sm text-gray-400">
                  Analyzing current market conditions and identifying trading opportunities
                </div>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
              <div>
                <div className="text-sm font-medium text-white">Risk Assessment</div>
                <div className="text-sm text-gray-400">
                  Monitoring portfolio exposure and calculating risk metrics
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}