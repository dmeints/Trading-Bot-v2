import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Brain, 
  Download, 
  Trash2, 
  Plus,
  Settings,
  Activity,
  Database,
  Upload,
  Eye,
  Play,
  Pause,
  AlertTriangle
} from 'lucide-react';

interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  type: 'trading' | 'sentiment' | 'risk' | 'market-analysis';
  createdAt: string;
  updatedAt: string;
  accuracy?: number;
  trainingData?: {
    samples: number;
    dateRange: { from: string; to: string };
  };
  performance?: {
    precision: number;
    recall: number;
    f1Score: number;
  };
  parameters?: Record<string, any>;
  isActive: boolean;
  description?: string;
}

interface ModelStats {
  totalModels: number;
  activeModels: number;
  totalFiles: number;
  totalFileSize: number;
  modelsByType: Record<string, number>;
  lastUpdated: string;
}

export default function ModelManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [adminSecret, setAdminSecret] = useState(localStorage.getItem('admin_secret') || '');

  const { data: models, isLoading: modelsLoading } = useQuery<ModelMetadata[]>({
    queryKey: ['/api/admin/models', selectedType],
    queryFn: async () => {
      const url = selectedType === 'all' 
        ? '/api/admin/models' 
        : `/api/admin/models?type=${selectedType}`;
      const response = await fetch(url, {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to fetch models');
      return response.json();
    },
    enabled: !!adminSecret,
  });

  const { data: stats } = useQuery<ModelStats>({
    queryKey: ['/api/admin/models/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/models/stats', {
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to fetch model stats');
      return response.json();
    },
    enabled: !!adminSecret,
    refetchInterval: 30000,
  });

  const createModelMutation = useMutation({
    mutationFn: async (modelData: Partial<ModelMetadata>) => {
      const response = await fetch('/api/admin/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify(modelData),
      });
      if (!response.ok) throw new Error('Failed to create model');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/models'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Model Created",
        description: "New model registered successfully",
      });
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create model",
        variant: "destructive",
      });
    },
  });

  const toggleModelMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await fetch(`/api/admin/models/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error('Failed to update model');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/models'] });
      toast({
        title: "Model Updated",
        description: "Model status changed successfully",
      });
    },
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/models/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to delete model');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/models'] });
      toast({
        title: "Model Deleted",
        description: "Model and associated files removed",
      });
    },
  });

  const backupModelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/models/${id}/backup`, {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
      });
      if (!response.ok) throw new Error('Failed to backup model');
      return response.blob();
    },
    onSuccess: (blob, id) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `model_backup_${id}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Backup Created",
        description: "Model backup downloaded successfully",
      });
    },
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTypeColor = (type: string) => {
    const colors = {
      trading: 'bg-blue-500',
      sentiment: 'bg-green-500',
      risk: 'bg-red-500',
      'market-analysis': 'bg-purple-500',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-500';
  };

  const CreateModelDialog = () => {
    const [formData, setFormData] = useState({
      name: '',
      version: '1.0.0',
      type: 'trading' as const,
      description: '',
      isActive: false,
    });

    return (
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Register Model
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Register New Model</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-300">Model Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-gray-700 border-gray-600 text-white"
                placeholder="Enter model name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version" className="text-gray-300">Version</Label>
              <Input
                id="version"
                value={formData.version}
                onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type" className="text-gray-300">Type</Label>
              <Select value={formData.type} onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trading">Trading</SelectItem>
                  <SelectItem value="sentiment">Sentiment</SelectItem>
                  <SelectItem value="risk">Risk</SelectItem>
                  <SelectItem value="market-analysis">Market Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-gray-300">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="bg-gray-700 border-gray-600 text-white"
                rows={3}
                placeholder="Model description..."
              />
            </div>
            <div className="flex items-center justify-between">
              <Button
                onClick={() => createModelMutation.mutate(formData)}
                disabled={!formData.name || createModelMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createModelMutation.isPending ? 'Creating...' : 'Register Model'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  if (!adminSecret) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Admin access required. Please authenticate via the admin panel first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold flex items-center space-x-3">
            <Brain className="w-8 h-8 text-blue-400" />
            <span>Model Management</span>
          </h1>
          <CreateModelDialog />
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Models</p>
                    <p className="text-2xl font-bold text-white">{stats.totalModels}</p>
                  </div>
                  <Database className="w-8 h-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Active Models</p>
                    <p className="text-2xl font-bold text-white">{stats.activeModels}</p>
                  </div>
                  <Activity className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Files</p>
                    <p className="text-2xl font-bold text-white">{stats.totalFiles}</p>
                  </div>
                  <Upload className="w-8 h-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Storage Used</p>
                    <p className="text-2xl font-bold text-white">{formatBytes(stats.totalFileSize)}</p>
                  </div>
                  <Settings className="w-8 h-8 text-orange-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">By Type</p>
                  {Object.entries(stats.modelsByType).map(([type, count]) => (
                    <div key={type} className="flex justify-between text-sm">
                      <span className="capitalize">{type.replace('-', ' ')}</span>
                      <span className="text-gray-300">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex items-center space-x-4 mb-6">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-48 bg-gray-800 border-gray-600 text-white">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="trading">Trading</SelectItem>
              <SelectItem value="sentiment">Sentiment</SelectItem>
              <SelectItem value="risk">Risk</SelectItem>
              <SelectItem value="market-analysis">Market Analysis</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modelsLoading ? (
            <div className="col-span-full text-center text-gray-400 py-8">
              Loading models...
            </div>
          ) : !models || models.length === 0 ? (
            <div className="col-span-full text-center text-gray-400 py-8">
              No models found
            </div>
          ) : (
            models.map((model) => (
              <Card key={model.id} className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg">{model.name}</CardTitle>
                    <Badge className={`${getTypeColor(model.type)} text-white`}>
                      {model.type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>v{model.version}</span>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${model.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                      <span>{model.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {model.description && (
                    <p className="text-gray-300 text-sm">{model.description}</p>
                  )}
                  
                  {model.accuracy && (
                    <div className="text-sm">
                      <span className="text-gray-400">Accuracy: </span>
                      <span className="text-white">{(model.accuracy * 100).toFixed(1)}%</span>
                    </div>
                  )}

                  {model.performance && (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400">Precision:</span>
                        <br />
                        <span className="text-white">{(model.performance.precision * 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Recall:</span>
                        <br />
                        <span className="text-white">{(model.performance.recall * 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400">F1:</span>
                        <br />
                        <span className="text-white">{(model.performance.f1Score * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-400">
                    <div>Created: {new Date(model.createdAt).toLocaleDateString()}</div>
                    <div>Updated: {new Date(model.updatedAt).toLocaleDateString()}</div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleModelMutation.mutate({ id: model.id, isActive: !model.isActive })}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      disabled={toggleModelMutation.isPending}
                    >
                      {model.isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => backupModelMutation.mutate(model.id)}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      disabled={backupModelMutation.isPending}
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteModelMutation.mutate(model.id)}
                      disabled={deleteModelMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}