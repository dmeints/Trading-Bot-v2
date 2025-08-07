import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TestTube, Users, TrendingUp, Activity } from 'lucide-react';
import { useExperimentList, useExperimentMetrics } from '@/hooks/useExperiment';

interface ExperimentMetrics {
  variant: string;
  users: number;
  events: number;
  conversionRate: number;
  clickThroughRate: number;
}

export function ExperimentDashboard() {
  const { experiments = [], isLoading } = useExperimentList();
  const [selectedExperiment, setSelectedExperiment] = useState<string>('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">A/B Experiments</h1>
        <Button>
          <TestTube className="w-4 h-4 mr-2" />
          Create Experiment
        </Button>
      </div>

      {/* Experiments Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Active Experiments</CardTitle>
            <Activity className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {experiments.filter((exp: any) => exp.isActive).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-600">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Total Users</CardTitle>
            <Users className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">1,247</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-600">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">Avg. Conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">12.4%</div>
          </CardContent>
        </Card>
      </div>

      {/* Experiments List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Running Experiments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {experiments.map((experiment: any) => (
              <div
                key={experiment.id}
                className="flex items-center justify-between p-3 bg-gray-700 rounded cursor-pointer hover:bg-gray-600"
                onClick={() => setSelectedExperiment(experiment.id)}
              >
                <div>
                  <h3 className="font-medium text-white">{experiment.name}</h3>
                  <p className="text-sm text-gray-400">{experiment.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={experiment.isActive ? 'default' : 'secondary'}>
                    {experiment.isActive ? 'Active' : 'Paused'}
                  </Badge>
                  <span className="text-sm text-gray-400">
                    {experiment.trafficAllocation}%
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {selectedExperiment && (
          <ExperimentDetails experimentId={selectedExperiment} />
        )}
      </div>
    </div>
  );
}

function ExperimentDetails({ experimentId }: { experimentId: string }) {
  const { metrics, isLoading } = useExperimentMetrics(experimentId);
  const experiment = useQuery({
    queryKey: ['/api/experiments', experimentId],
  });

  if (isLoading || experiment.isLoading) {
    return (
      <Card className="bg-gray-800 border-gray-600">
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </CardContent>
      </Card>
    );
  }

  const chartData = (metrics as any)?.variants?.map((variant: ExperimentMetrics) => ({
    name: variant.variant,
    users: variant.users,
    conversion: variant.conversionRate * 100,
    ctr: variant.clickThroughRate * 100,
  })) || [];

  return (
    <Card className="bg-gray-800 border-gray-600">
      <CardHeader>
        <CardTitle className="text-white">{experiment.data?.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="metrics" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="variants">Variants</TabsTrigger>
          </TabsList>
          
          <TabsContent value="metrics" className="space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar dataKey="conversion" fill="#3B82F6" name="Conversion %" />
                  <Bar dataKey="ctr" fill="#10B981" name="CTR %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="variants" className="space-y-4">
            {(experiment.data as any)?.variants?.map((variant: any) => (
              <div key={variant.id} className="bg-gray-700 p-3 rounded">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white">{variant.name}</h4>
                  <Badge>{variant.weight}%</Badge>
                </div>
                <Progress value={variant.weight} className="mb-2" />
                <p className="text-sm text-gray-400">
                  Users: {(metrics as any)?.variants?.find((m: any) => m.variant === variant.id)?.users || 0}
                </p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}