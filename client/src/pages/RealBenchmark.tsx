import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, BarChart3, TrendingUp, AlertTriangle } from "lucide-react";
import { SafetyBanner } from "@/components/SafetyBanner";
import { ExplainMetricDrawer } from "@/components/bench/ExplainMetricDrawer";
import { queryClient } from "@/lib/queryClient";

interface BenchmarkConfig {
  version: string;
  testPeriodDays: number;
  initialCapital: number;
  symbols: string[];
  compareToVersion?: string;
}

export default function RealBenchmark() {
  const [config, setConfig] = useState<BenchmarkConfig>({
    version: "v1.6",
    testPeriodDays: 7,
    initialCapital: 10000,
    symbols: ["BTC/USD", "ETH/USD"],
  });
  const [explainMetric, setExplainMetric] = useState<{
    open: boolean;
    metric?: string;
    value?: number;
  }>({ open: false });

  const { data: healthData } = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await fetch("/api/health")).json(),
    refetchInterval: 30_000,
  });

  const runBenchmark = useMutation({
    mutationFn: async (benchConfig: BenchmarkConfig) => {
      const response = await fetch("/api/real-benchmark/run-real-benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(benchConfig),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["benchmark-history"] });
    },
  });

  const { data: historyData } = useQuery({
    queryKey: ["benchmark-history"],
    queryFn: async () => (await fetch("/api/real-benchmark/history")).json(),
  });

  const handleRunBenchmark = () => {
    runBenchmark.mutate(config);
  };

  const result = runBenchmark.data?.data;
  const hasBreakers = healthData?.slo && (
    healthData.slo.apiQuota.coingecko.used / healthData.slo.apiQuota.coingecko.limit > 0.8 ||
    healthData.slo.wsStalenessMs.p95 > 2000 ||
    healthData.slo.backtestSuccessRate < 0.95
  );

  return (
    <div className="p-6 space-y-6" data-testid="page-real-benchmark">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Real Algorithm Benchmark</h1>
          <p className="text-gray-600">Test actual trading performance, not UI personality</p>
        </div>
      </div>

      <SafetyBanner 
        breakers={{
          apiQuotaExceeded: healthData?.slo?.apiQuota.coingecko.used / healthData?.slo?.apiQuota.coingecko.limit > 0.8,
          wsStale: healthData?.slo?.wsStalenessMs.p95 > 2000,
          backtestFailRate: healthData?.slo?.backtestSuccessRate < 0.95,
        }}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Benchmark Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="version">Stevie Version</Label>
              <Input
                id="version"
                value={config.version}
                onChange={(e) => setConfig(prev => ({ ...prev, version: e.target.value }))}
                data-testid="input-version"
              />
            </div>
            <div>
              <Label htmlFor="testPeriod">Test Period (days)</Label>
              <Input
                id="testPeriod"
                type="number"
                value={config.testPeriodDays}
                onChange={(e) => setConfig(prev => ({ ...prev, testPeriodDays: parseInt(e.target.value) || 7 }))}
                data-testid="input-test-period"
              />
            </div>
            <div>
              <Label htmlFor="capital">Initial Capital ($)</Label>
              <Input
                id="capital"
                type="number"
                value={config.initialCapital}
                onChange={(e) => setConfig(prev => ({ ...prev, initialCapital: parseInt(e.target.value) || 10000 }))}
                data-testid="input-initial-capital"
              />
            </div>
            <Button 
              onClick={handleRunBenchmark} 
              disabled={runBenchmark.isPending}
              className="w-full"
              data-testid="button-run-benchmark"
            >
              {runBenchmark.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running Benchmark...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Real Algorithm Test
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>Latest Results</CardTitle>
          </CardHeader>
          <CardContent>
            {runBenchmark.isPending && (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Testing Stevie's algorithm on real market data...</p>
              </div>
            )}
            
            {runBenchmark.error && (
              <div className="text-center py-8">
                <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="text-red-600">
                  {runBenchmark.error instanceof Error ? runBenchmark.error.message : "Test failed"}
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600" data-testid="cash-growth-score">
                      {result.summary?.cashReserveScore || 0}/100
                    </div>
                    <div className="text-sm text-green-700">Cash Growth Score</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600" data-testid="total-return">
                      {result.summary?.totalReturn ? `+${(result.summary.totalReturn * 100).toFixed(1)}%` : "0%"}
                    </div>
                    <div className="text-sm text-blue-700">Total Return</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Sharpe Ratio:</span>
                    <button 
                      onClick={() => setExplainMetric({ open: true, metric: "sharpe", value: result.summary?.sharpeRatio })}
                      className="text-blue-600 hover:underline font-mono"
                      data-testid="metric-sharpe"
                    >
                      {result.summary?.sharpeRatio?.toFixed(2) || "0.00"}
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span>Win Rate:</span>
                    <button 
                      onClick={() => setExplainMetric({ open: true, metric: "winRate", value: result.summary?.winRate })}
                      className="text-blue-600 hover:underline font-mono"
                      data-testid="metric-win-rate"
                    >
                      {result.summary?.winRate ? `${(result.summary.winRate * 100).toFixed(1)}%` : "0%"}
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Drawdown:</span>
                    <button 
                      onClick={() => setExplainMetric({ open: true, metric: "maxDrawdown", value: result.summary?.maxDrawdown })}
                      className="text-blue-600 hover:underline font-mono"
                      data-testid="metric-max-drawdown"
                    >
                      {result.summary?.maxDrawdown ? `${(result.summary.maxDrawdown * 100).toFixed(1)}%` : "0%"}
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit Factor:</span>
                    <span className="font-mono" data-testid="metric-profit-factor">
                      {result.summary?.profitFactor?.toFixed(2) || "1.00"}
                    </span>
                  </div>
                </div>

                {result.summary?.recommendations && result.summary.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Recommendations:</h4>
                    <ul className="text-sm space-y-1">
                      {result.summary.recommendations.map((rec: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {explainMetric.open && (
        <ExplainMetricDrawer
          open={explainMetric.open}
          onOpenChange={(open) => setExplainMetric({ open })}
          metric={explainMetric.metric as any}
          value={explainMetric.value}
          inputs={{
            window: {
              fromIso: new Date(Date.now() - config.testPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
              toIso: new Date().toISOString(),
              timeframe: "1h",
              symbols: config.symbols
            },
            feesBps: 2,
            slipBps: 1,
            rngSeed: 42
          }}
          provenance={{
            datasetId: result?.datasetId,
            runId: result?.runId,
            commit: "dev",
            generatedAt: new Date().toISOString()
          }}
        />
      )}
    </div>
  );
}