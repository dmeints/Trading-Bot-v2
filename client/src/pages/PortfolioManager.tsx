import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  PieChart,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Shuffle,
  Settings,
  Plus,
  Trash2,
  Activity,
  DollarSign,
  Percent,
  Shield,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Asset {
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  price: number;
  volatility: number;
}

interface Portfolio {
  id: string;
  name: string;
  strategy: string;
  value: number;
  performance: {
    totalReturn: number;
    annualizedReturn: number;
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  lastRebalance: string;
  nextRebalance: string;
  assetCount: number;
}

interface PortfolioDetails {
  id: string;
  config: {
    name: string;
    strategy: string;
    assets: string[];
  };
  weights: Record<string, number>;
  value: number;
  positions: Record<string, {
    symbol: string;
    quantity: number;
    value: number;
    weight: number;
  }>;
  analytics: {
    sectorAllocation: Record<string, number>;
  };
}

interface OptimizationResult {
  weights: Record<string, number>;
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number;
  efficient: boolean;
}

export default function PortfolioManager() {
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('');
  const [portfolioForm, setPortfolioForm] = useState({
    id: '',
    name: '',
    strategy: 'mean_variance',
    assets: [] as string[],
    initialValue: 100000
  });
  const [optimizationForm, setOptimizationForm] = useState({
    strategy: 'mean_variance',
    assets: [] as string[]
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch available assets
  const { data: assetsData, isLoading: assetsLoading } = useQuery({
    queryKey: ['/api/portfolio/assets'],
  });

  // Fetch portfolios
  const { data: portfoliosData, isLoading: portfoliosLoading } = useQuery({
    queryKey: ['/api/portfolio/list'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch selected portfolio details
  const { data: portfolioDetailsData } = useQuery({
    queryKey: ['/api/portfolio', selectedPortfolio],
    enabled: !!selectedPortfolio,
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Create portfolio mutation
  const createPortfolio = useMutation({
    mutationFn: async (portfolioData: any) => {
      const response = await fetch('/api/portfolio/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(portfolioData),
      });
      
      if (!response.ok) throw new Error('Failed to create portfolio');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/list'] });
      setPortfolioForm({
        id: '',
        name: '',
        strategy: 'mean_variance',
        assets: [],
        initialValue: 100000
      });
      toast({
        title: "Portfolio Created",
        description: "Portfolio has been created and optimized successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create portfolio.",
        variant: "destructive",
      });
    },
  });

  // Run optimization mutation
  const runOptimization = useMutation({
    mutationFn: async (optimizationData: any) => {
      const response = await fetch('/api/portfolio/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optimizationData),
      });
      
      if (!response.ok) throw new Error('Failed to run optimization');
      return response.json();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to run optimization.",
        variant: "destructive",
      });
    },
  });

  // Rebalance portfolio mutation
  const rebalancePortfolio = useMutation({
    mutationFn: async (portfolioId: string) => {
      const response = await fetch(`/api/portfolio/${portfolioId}/rebalance`, {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Failed to rebalance portfolio');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio', selectedPortfolio] });
      toast({
        title: "Portfolio Rebalanced",
        description: `${data.data.actions.length} trades executed successfully.`,
      });
    },
  });

  // Delete portfolio mutation
  const deletePortfolio = useMutation({
    mutationFn: async (portfolioId: string) => {
      const response = await fetch(`/api/portfolio/${portfolioId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete portfolio');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/list'] });
      if (selectedPortfolio) setSelectedPortfolio('');
      toast({
        title: "Portfolio Deleted",
        description: "Portfolio has been deleted successfully.",
      });
    },
  });

  const assets: Asset[] = assetsData?.data?.assets || [];
  const portfolios: Portfolio[] = portfoliosData?.data?.portfolios || [];
  const portfolioDetails: PortfolioDetails = portfolioDetailsData?.data;
  const optimizationResult: OptimizationResult = runOptimization.data?.data;

  const handleCreatePortfolio = () => {
    if (!portfolioForm.id || !portfolioForm.name || portfolioForm.assets.length === 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields and select at least one asset.",
        variant: "destructive",
      });
      return;
    }

    createPortfolio.mutate(portfolioForm);
  };

  const handleRunOptimization = () => {
    if (optimizationForm.assets.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one asset to optimize.",
        variant: "destructive",
      });
      return;
    }

    runOptimization.mutate(optimizationForm);
  };

  const toggleAsset = (assetSymbol: string, isPortfolioForm: boolean = true) => {
    if (isPortfolioForm) {
      setPortfolioForm(prev => ({
        ...prev,
        assets: prev.assets.includes(assetSymbol)
          ? prev.assets.filter(a => a !== assetSymbol)
          : [...prev.assets, assetSymbol]
      }));
    } else {
      setOptimizationForm(prev => ({
        ...prev,
        assets: prev.assets.includes(assetSymbol)
          ? prev.assets.filter(a => a !== assetSymbol)
          : [...prev.assets, assetSymbol]
      }));
    }
  };

  const getStrategyName = (strategy: string) => {
    const names: Record<string, string> = {
      'mean_variance': 'Mean-Variance',
      'risk_parity': 'Risk Parity',
      'black_litterman': 'Black-Litterman',
      'equal_weight': 'Equal Weight'
    };
    return names[strategy] || strategy;
  };

  const getPerformanceColor = (value: number, type: 'return' | 'sharpe') => {
    switch (type) {
      case 'return':
        return value > 0.1 ? 'text-green-600' : value > 0 ? 'text-yellow-600' : 'text-red-600';
      case 'sharpe':
        return value > 1.0 ? 'text-green-600' : value > 0.5 ? 'text-yellow-600' : 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (assetsLoading || portfoliosLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portfolio Manager</h1>
          <p className="text-muted-foreground">Advanced portfolio optimization and multi-asset management</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            {portfolios.length} Portfolios
          </Badge>
          <Badge variant="secondary">
            ${portfoliosData?.data?.summary?.totalValue?.toLocaleString() || '0'} AUM
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Total Value</div>
            <DollarSign className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-green-600">
            ${portfoliosData?.data?.summary?.totalValue?.toLocaleString() || '0'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Active Portfolios</div>
            <PieChart className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{portfolios.length}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Avg Return</div>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold mt-2 text-blue-600">
            {portfoliosData?.data?.summary?.avgReturn ? 
              (portfoliosData.data.summary.avgReturn * 100).toFixed(1) + '%' : '0%'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Asset Universe</div>
            <Target className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{assets.length}</div>
        </Card>
      </div>

      <Tabs defaultValue="portfolios" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="portfolios">Portfolios</TabsTrigger>
          <TabsTrigger value="create">Create Portfolio</TabsTrigger>
          <TabsTrigger value="optimize">Optimizer</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Portfolios Tab */}
        <TabsContent value="portfolios" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Portfolio List */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Portfolio List</h3>
              
              {portfolios.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No portfolios created yet
                </div>
              ) : (
                <div className="space-y-3">
                  {portfolios.map((portfolio) => (
                    <div key={portfolio.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{portfolio.name}</span>
                            <Badge variant="outline">{getStrategyName(portfolio.strategy)}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {portfolio.assetCount} assets • ${portfolio.value.toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedPortfolio(portfolio.id)}
                            data-testid={`button-view-${portfolio.id}`}
                          >
                            <Activity className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rebalancePortfolio.mutate(portfolio.id)}
                            disabled={rebalancePortfolio.isPending}
                            data-testid={`button-rebalance-${portfolio.id}`}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deletePortfolio.mutate(portfolio.id)}
                            disabled={deletePortfolio.isPending}
                            data-testid={`button-delete-${portfolio.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Return:</span>
                          <span className={`ml-1 font-medium ${getPerformanceColor(portfolio.performance.totalReturn, 'return')}`}>
                            {(portfolio.performance.totalReturn * 100).toFixed(2)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sharpe:</span>
                          <span className={`ml-1 font-medium ${getPerformanceColor(portfolio.performance.sharpeRatio, 'sharpe')}`}>
                            {portfolio.performance.sharpeRatio.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Vol:</span>
                          <span className="ml-1">{(portfolio.performance.volatility * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Portfolio Details */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Portfolio Details</h3>
              
              {selectedPortfolio && portfolioDetails ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Asset Allocation</h4>
                    <div className="space-y-2">
                      {Object.entries(portfolioDetails.positions).map(([symbol, position]) => (
                        <div key={symbol} className="flex justify-between items-center">
                          <span className="text-sm">{symbol}</span>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {(position.weight * 100).toFixed(1)}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ${position.value.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Sector Allocation</h4>
                    <div className="space-y-2">
                      {Object.entries(portfolioDetails.analytics.sectorAllocation).map(([sector, weight]) => (
                        <div key={sector} className="flex justify-between items-center">
                          <span className="text-sm">{sector}</span>
                          <span className="text-sm font-medium">{(weight * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Select a portfolio to view details
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Create Portfolio Tab */}
        <TabsContent value="create" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Portfolio Configuration</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="portfolio-id">Portfolio ID</Label>
                    <Input
                      id="portfolio-id"
                      value={portfolioForm.id}
                      onChange={(e) => setPortfolioForm(prev => ({ ...prev, id: e.target.value }))}
                      placeholder="my-portfolio"
                      data-testid="input-portfolio-id"
                    />
                  </div>
                  <div>
                    <Label htmlFor="portfolio-name">Portfolio Name</Label>
                    <Input
                      id="portfolio-name"
                      value={portfolioForm.name}
                      onChange={(e) => setPortfolioForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="My Portfolio"
                      data-testid="input-portfolio-name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="strategy">Optimization Strategy</Label>
                    <select
                      id="strategy"
                      value={portfolioForm.strategy}
                      onChange={(e) => setPortfolioForm(prev => ({ ...prev, strategy: e.target.value }))}
                      className="w-full p-2 border rounded-md bg-background"
                      data-testid="select-strategy"
                    >
                      <option value="mean_variance">Mean-Variance</option>
                      <option value="risk_parity">Risk Parity</option>
                      <option value="black_litterman">Black-Litterman</option>
                      <option value="equal_weight">Equal Weight</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="initial-value">Initial Value ($)</Label>
                    <Input
                      id="initial-value"
                      type="number"
                      value={portfolioForm.initialValue}
                      onChange={(e) => setPortfolioForm(prev => ({ 
                        ...prev, 
                        initialValue: parseInt(e.target.value) 
                      }))}
                      data-testid="input-initial-value"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleCreatePortfolio} 
                  disabled={createPortfolio.isPending}
                  className="w-full"
                  data-testid="button-create-portfolio"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {createPortfolio.isPending ? 'Creating...' : 'Create Portfolio'}
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Asset Selection</h3>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {assets.map((asset) => (
                  <div key={asset.symbol} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={portfolioForm.assets.includes(asset.symbol)}
                        onChange={() => toggleAsset(asset.symbol, true)}
                        className="rounded"
                      />
                      <div>
                        <div className="font-medium">{asset.symbol}</div>
                        <div className="text-sm text-muted-foreground">{asset.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">${asset.price.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{asset.sector}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Optimizer Tab */}
        <TabsContent value="optimize" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Portfolio Optimizer</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="opt-strategy">Strategy</Label>
                  <select
                    id="opt-strategy"
                    value={optimizationForm.strategy}
                    onChange={(e) => setOptimizationForm(prev => ({ ...prev, strategy: e.target.value }))}
                    className="w-full p-2 border rounded-md bg-background"
                    data-testid="select-opt-strategy"
                  >
                    <option value="mean_variance">Mean-Variance</option>
                    <option value="risk_parity">Risk Parity</option>
                    <option value="black_litterman">Black-Litterman</option>
                    <option value="equal_weight">Equal Weight</option>
                  </select>
                </div>

                <div>
                  <Label>Selected Assets ({optimizationForm.assets.length})</Label>
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {assets.map((asset) => (
                      <label key={asset.symbol} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={optimizationForm.assets.includes(asset.symbol)}
                          onChange={() => toggleAsset(asset.symbol, false)}
                          className="rounded"
                        />
                        <span className="text-sm">{asset.symbol} - {asset.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleRunOptimization} 
                  disabled={runOptimization.isPending}
                  className="w-full"
                  data-testid="button-run-optimization"
                >
                  <Target className="w-4 h-4 mr-2" />
                  {runOptimization.isPending ? 'Optimizing...' : 'Run Optimization'}
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Optimization Results</h3>
              
              {optimizationResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Expected Return</span>
                      <div className="text-lg font-semibold text-green-600">
                        {(optimizationResult.expectedReturn * 100).toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Expected Volatility</span>
                      <div className="text-lg font-semibold">
                        {(optimizationResult.expectedVolatility * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
                    <div className={`text-lg font-semibold ${getPerformanceColor(optimizationResult.sharpeRatio, 'sharpe')}`}>
                      {optimizationResult.sharpeRatio.toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <span className="text-sm text-muted-foreground mb-2 block">Optimal Weights</span>
                    <div className="space-y-2">
                      {Object.entries(optimizationResult.weights)
                        .sort(([, a], [, b]) => b - a)
                        .map(([symbol, weight]) => (
                        <div key={symbol} className="flex justify-between items-center">
                          <span className="text-sm">{symbol}</span>
                          <div className="flex items-center space-x-2">
                            <Progress value={weight * 100} className="w-20 h-2" />
                            <span className="text-sm font-medium w-12 text-right">
                              {(weight * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Badge className={optimizationResult.efficient ? "bg-green-600" : "bg-yellow-600"}>
                    {optimizationResult.efficient ? 'Efficient Portfolio' : 'Constrained Portfolio'}
                  </Badge>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Run optimization to see results
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Strategies Used</div>
                <BarChart3 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2">
                {Object.entries(portfoliosData?.data?.summary?.strategies || {}).map(([strategy, count]) => (
                  <div key={strategy} className="flex justify-between items-center">
                    <span className="text-sm">{getStrategyName(strategy)}</span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Sector Diversity</div>
                <PieChart className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold mt-2">
                {assetsData?.data?.summary?.sectors?.length || 0}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Total Market Cap</div>
                <DollarSign className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold mt-2">
                ${Math.round((assetsData?.data?.summary?.totalMarketCap || 0) / 1e9)}B
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}