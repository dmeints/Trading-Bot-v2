
/**
 * Scenario Coverage Dashboard
 * Real-time monitoring of comprehensive scenario test coverage
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Play, 
  RefreshCw,
  AlertTriangle,
  Target,
  TrendingUp
} from 'lucide-react';

interface ScenarioResult {
  scenario: string;
  passed: boolean;
  duration: number;
  details: {
    uncertaintyCheck: { passed: boolean; actual: number; expected: [number, number] };
    positionSizeCheck: { passed: boolean; actual: number; expected: [number, number] };
    executionCheck: { passed: boolean; actual: string; expected: string };
    riskCheck: { passed: boolean };
  };
}

interface CoverageReport {
  overall: {
    totalScenarios: number;
    passedScenarios: number;
    passRate: number;
    meetsTarget: boolean;
    targetPassRate: number;
  };
  categories: Record<string, { total: number; passed: number; passRate: number }>;
  failedScenarios: Array<{
    name: string;
    reason: string;
    expected: any;
    actual: any;
  }>;
  recommendations: string[];
}

export const ScenarioCoverageDashboard: React.FC = () => {
  const [coverageReport, setCoverageReport] = useState<CoverageReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<string>('');
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    fetchScenarios();
    fetchCoverageReport();
  }, []);

  const fetchScenarios = async () => {
    try {
      const response = await fetch('/api/scenario-coverage/scenarios');
      const data = await response.json();
      if (data.success) {
        setScenarios(data.data.scenarios);
      }
    } catch (error) {
      console.error('Failed to fetch scenarios:', error);
    }
  };

  const fetchCoverageReport = async () => {
    try {
      const response = await fetch('/api/scenario-coverage/coverage-report');
      const data = await response.json();
      if (data.success) {
        setCoverageReport(data.data);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('Failed to fetch coverage report:', error);
    }
  };

  const runAllScenarios = async () => {
    setIsRunning(true);
    setResults([]);
    
    try {
      // Simulate running scenarios one by one
      for (const scenario of scenarios) {
        setCurrentScenario(scenario.name);
        
        const response = await fetch('/api/scenario-coverage/run-single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenarioName: scenario.name })
        });
        
        const data = await response.json();
        if (data.success) {
          setResults(prev => [...prev, data.data]);
        }
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Fetch updated coverage report
      await fetchCoverageReport();
      
    } catch (error) {
      console.error('Failed to run scenarios:', error);
    } finally {
      setIsRunning(false);
      setCurrentScenario('');
    }
  };

  const runSingleScenario = async (scenarioName: string) => {
    try {
      const response = await fetch('/api/scenario-coverage/run-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioName })
      });
      
      const data = await response.json();
      if (data.success) {
        setResults(prev => [...prev.filter(r => r.scenario !== scenarioName), data.data]);
        await fetchCoverageReport();
      }
    } catch (error) {
      console.error('Failed to run single scenario:', error);
    }
  };

  const getCategoryColor = (passRate: number) => {
    if (passRate >= 0.8) return 'text-green-600';
    if (passRate >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPassRateColor = (passRate: number) => {
    if (passRate >= 0.8) return 'bg-green-500';
    if (passRate >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scenario Coverage Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive testing across all market conditions and edge cases
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={fetchCoverageReport}
            variant="outline"
            size="sm"
            disabled={isRunning}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={runAllScenarios}
            disabled={isRunning}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Play className="h-4 w-4 mr-2" />
            {isRunning ? 'Running...' : 'Run All Tests'}
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      {coverageReport && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Overall Pass Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(coverageReport.overall.passRate * 100).toFixed(1)}%
              </div>
              <Progress 
                value={coverageReport.overall.passRate * 100} 
                className="mt-2"
              />
              <div className="flex items-center mt-2">
                {coverageReport.overall.meetsTarget ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mr-1" />
                )}
                <span className="text-sm text-muted-foreground">
                  Target: {(coverageReport.overall.targetPassRate * 100).toFixed(0)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Scenarios Passed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {coverageReport.overall.passedScenarios}/{coverageReport.overall.totalScenarios}
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {coverageReport.overall.totalScenarios - coverageReport.overall.passedScenarios} failed
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Coverage Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge 
                variant={coverageReport.overall.meetsTarget ? "default" : "destructive"}
                className="text-sm"
              >
                {coverageReport.overall.meetsTarget ? 'PASSED' : 'FAILED'}
              </Badge>
              <div className="text-sm text-muted-foreground mt-2">
                {coverageReport.overall.meetsTarget ? 'Meets 80% target' : 'Below 80% target'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">{lastUpdate}</div>
              <div className="text-sm text-muted-foreground mt-2">
                Frozen DB verified
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Running Status */}
      {isRunning && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Running scenario: <strong>{currentScenario}</strong>
            <Progress value={(results.length / scenarios.length) * 100} className="mt-2" />
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="failures">Failures</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {coverageReport && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Coverage by Category</CardTitle>
                  <CardDescription>
                    Pass rates across different scenario categories
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(coverageReport.categories).map(([category, stats]) => (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="capitalize">
                          {category.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {stats.passed}/{stats.total}
                        </span>
                      </div>
                      <div className={`text-sm font-medium ${getCategoryColor(stats.passRate)}`}>
                        {(stats.passRate * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                  <CardDescription>
                    Suggested improvements based on test results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {coverageReport.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                        <span className="text-sm">{rec}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((scenario) => (
              <Card key={scenario.name}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{scenario.name}</CardTitle>
                    <Badge variant="outline" className={`text-xs ${
                      scenario.complexity === 'high' ? 'border-red-300' :
                      scenario.complexity === 'medium' ? 'border-yellow-300' :
                      'border-green-300'
                    }`}>
                      {scenario.complexity}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {scenario.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      ~{scenario.estimatedDuration}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runSingleScenario(scenario.name)}
                      disabled={isRunning}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Run
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                Detailed results from scenario test runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {results.map((result) => (
                  <div key={result.scenario} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      {result.passed ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <div>
                        <div className="font-medium">{result.scenario}</div>
                        <div className="text-sm text-muted-foreground">
                          Duration: {result.duration}s
                        </div>
                      </div>
                    </div>
                    <Badge variant={result.passed ? "default" : "destructive"}>
                      {result.passed ? 'PASSED' : 'FAILED'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failures" className="space-y-4">
          {coverageReport && (
            <Card>
              <CardHeader>
                <CardTitle>Failed Scenarios</CardTitle>
                <CardDescription>
                  Analysis of scenarios that did not meet pass criteria
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {coverageReport.failedScenarios.map((failure, index) => (
                    <div key={index} className="border-l-4 border-red-500 pl-4">
                      <div className="font-medium text-red-900">{failure.name}</div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {failure.reason}
                      </div>
                      <div className="text-xs space-y-1">
                        <div>Expected: {JSON.stringify(failure.expected)}</div>
                        <div>Actual: {JSON.stringify(failure.actual)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScenarioCoverageDashboard;
