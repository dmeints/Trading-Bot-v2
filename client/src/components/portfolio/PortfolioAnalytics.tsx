import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, PieChart, Activity, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsP, Cell } from 'recharts';

interface PortfolioAnalytics {
  totalValue: number;
  totalPnL: number;
  totalPnLPercentage: number;
  riskScore: number;
  sharpRatio: number;
  maxDrawdown: number;
  positions: Array<{
    symbol: string;
    value: number;
    percentage: number;
    pnl: number;
    pnlPercentage: number;
  }>;
  performance: Array<{
    date: string;
    value: number;
    pnl: number;
  }>;
}

const COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function PortfolioAnalytics() {
  const { data: analytics, isLoading } = useQuery<PortfolioAnalytics>({
    queryKey: ['/api/portfolio/analytics'],
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                <div className="h-8 bg-gray-700 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) return null;

  const getRiskLevel = (score: number) => {
    if (score < 30) return { label: 'Low', color: 'bg-green-500' };
    if (score < 70) return { label: 'Medium', color: 'bg-yellow-500' };
    return { label: 'High', color: 'bg-red-500' };
  };

  const riskLevel = getRiskLevel(analytics.riskScore);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Value</p>
                <p className="text-2xl font-bold text-white">
                  ${analytics.totalValue.toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total P&L</p>
                <p className={`text-2xl font-bold ${analytics.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {analytics.totalPnL >= 0 ? '+' : ''}${analytics.totalPnL.toLocaleString()}
                </p>
                <p className={`text-sm ${analytics.totalPnLPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {analytics.totalPnLPercentage >= 0 ? '+' : ''}{(analytics.totalPnLPercentage || 0).toFixed(2)}%
                </p>
              </div>
              {analytics.totalPnL >= 0 ? (
                <TrendingUp className="w-8 h-8 text-green-400" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-400" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Risk Score</p>
                <div className="flex items-center space-x-2 mt-2">
                  <Progress value={analytics.riskScore} className="flex-1" />
                  <Badge className={`${riskLevel.color} text-white text-xs`}>
                    {riskLevel.label}
                  </Badge>
                </div>
                <p className="text-lg font-bold text-white mt-1">
                  {analytics.riskScore}/100
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Sharpe Ratio</p>
                <p className="text-2xl font-bold text-white">
                  {(analytics.sharpRatio || 0).toFixed(2)}
                </p>
                <p className="text-sm text-gray-400">
                  Max Drawdown: {(analytics.maxDrawdown || 0).toFixed(2)}%
                </p>
              </div>
              <Activity className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart and Portfolio Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <span>Portfolio Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.performance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#F3F4F6' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#0EA5E9" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <PieChart className="w-5 h-5 text-green-400" />
              <span>Asset Allocation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsP>
                <RechartsP data={analytics.positions} cx="50%" cy="50%" outerRadius={80}>
                  {analytics.positions.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </RechartsP>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                />
              </RechartsP>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {analytics.positions.map((position, index) => (
                <div key={position.symbol} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-300">{position.symbol}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-white">{(position.percentage || 0).toFixed(1)}%</span>
                    <br />
                    <span className={position.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {position.pnl >= 0 ? '+' : ''}{(position.pnlPercentage || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}