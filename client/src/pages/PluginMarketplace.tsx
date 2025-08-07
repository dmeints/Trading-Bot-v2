import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, 
  Star, 
  Package, 
  Search, 
  Filter, 
  Trash2, 
  RefreshCw, 
  Settings,
  ExternalLink,
  Shield,
  Clock
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface MarketplacePlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  category: string;
  price: string;
  url: string;
}

interface InstalledPlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  status: 'active' | 'disabled' | 'error';
}

export default function PluginMarketplace() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');

  // Fetch marketplace plugins
  const { data: marketplaceResponse, isLoading: marketplaceLoading } = useQuery({
    queryKey: ['/api/plugins/marketplace'],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Fetch installed plugins
  const { data: installedResponse, isLoading: installedLoading } = useQuery({
    queryKey: ['/api/plugins'],
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
  });

  const marketplacePlugins = (marketplaceResponse?.data || []) as MarketplacePlugin[];
  const installedPlugins = (installedResponse?.data || []) as InstalledPlugin[];

  // Install plugin mutation
  const installMutation = useMutation({
    mutationFn: async (plugin: MarketplacePlugin) => {
      await apiRequest('/api/plugins/marketplace/install', {
        method: 'POST',
        body: JSON.stringify({
          pluginUrl: plugin.url,
          pluginName: plugin.name
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: (_, plugin) => {
      queryClient.invalidateQueries({ queryKey: ['/api/plugins'] });
      toast({
        title: "Plugin Installed",
        description: `${plugin.name} has been installed successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: "Installation Failed",
        description: error instanceof Error ? error.message : "Failed to install plugin",
        variant: "destructive",
      });
    },
  });

  // Uninstall plugin mutation
  const uninstallMutation = useMutation({
    mutationFn: async (pluginName: string) => {
      await apiRequest(`/api/plugins/${pluginName}`, { method: 'DELETE' });
    },
    onSuccess: (_, pluginName) => {
      queryClient.invalidateQueries({ queryKey: ['/api/plugins'] });
      toast({
        title: "Plugin Uninstalled",
        description: `${pluginName} has been uninstalled`,
      });
    },
    onError: (error) => {
      toast({
        title: "Uninstall Failed",
        description: error instanceof Error ? error.message : "Failed to uninstall plugin",
        variant: "destructive",
      });
    },
  });

  // Reload plugin mutation
  const reloadMutation = useMutation({
    mutationFn: async (pluginName: string) => {
      await apiRequest(`/api/plugins/${pluginName}/reload`, { method: 'POST' });
    },
    onSuccess: (_, pluginName) => {
      queryClient.invalidateQueries({ queryKey: ['/api/plugins'] });
      toast({
        title: "Plugin Reloaded",
        description: `${pluginName} has been reloaded`,
      });
    },
    onError: (error) => {
      toast({
        title: "Reload Failed",
        description: error instanceof Error ? error.message : "Failed to reload plugin",
        variant: "destructive",
      });
    },
  });

  // Filter marketplace plugins
  const filteredMarketplace = marketplacePlugins.filter(plugin => {
    const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || plugin.category === categoryFilter;
    const matchesPrice = priceFilter === 'all' || 
                        (priceFilter === 'free' && plugin.price === 'free') ||
                        (priceFilter === 'paid' && plugin.price !== 'free');
    
    return matchesSearch && matchesCategory && matchesPrice;
  });

  const isPluginInstalled = (pluginName: string) => {
    return installedPlugins.some(installed => installed.name === pluginName);
  };

  const getPluginStatus = (pluginName: string) => {
    const installed = installedPlugins.find(plugin => plugin.name === pluginName);
    return installed?.status || 'not_installed';
  };

  const categories = Array.from(new Set(marketplacePlugins.map(p => p.category)));

  return (
    <div className="space-y-6" data-testid="plugin-marketplace">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plugin Marketplace</h1>
          <p className="text-muted-foreground">
            Extend Skippy's capabilities with community-built plugins
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/plugins'] })}
            data-testid="refresh-plugins"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="marketplace" className="space-y-4">
        <TabsList>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="installed">Installed ({installedPlugins.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-plugins"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.replace('_', ' ').toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priceFilter} onValueChange={setPriceFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Price" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Marketplace Grid */}
          {marketplaceLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-muted rounded mb-4"></div>
                    <div className="h-10 bg-muted rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMarketplace.map((plugin) => (
                <Card key={plugin.name} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{plugin.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <span>by {plugin.author}</span>
                          <Badge variant="outline">{plugin.version}</Badge>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span>{plugin.rating}</span>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {plugin.description}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="secondary">
                        {plugin.category.replace('_', ' ')}
                      </Badge>
                      <Badge variant={plugin.price === 'free' ? 'default' : 'outline'}>
                        {plugin.price}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {plugin.downloads.toLocaleString()} downloads
                      </span>
                    </div>
                    
                    <div className="flex gap-2">
                      {isPluginInstalled(plugin.name) ? (
                        <Button variant="outline" disabled className="flex-1">
                          <Shield className="h-4 w-4 mr-2" />
                          Installed
                        </Button>
                      ) : (
                        <Button
                          onClick={() => installMutation.mutate(plugin)}
                          disabled={installMutation.isPending}
                          className="flex-1"
                          data-testid={`install-${plugin.name}`}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {installMutation.isPending ? 'Installing...' : 'Install'}
                        </Button>
                      )}
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!marketplaceLoading && filteredMarketplace.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No plugins found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filter criteria
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="installed" className="space-y-4">
          {installedLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="h-6 bg-muted rounded w-1/3 mb-2"></div>
                        <div className="h-4 bg-muted rounded w-2/3"></div>
                      </div>
                      <div className="h-10 bg-muted rounded w-24"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : installedPlugins.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No plugins installed</h3>
              <p className="text-muted-foreground">
                Browse the marketplace to install your first plugin
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {installedPlugins.map((plugin) => (
                <Card key={plugin.name} data-testid={`installed-plugin-${plugin.name}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{plugin.name}</h3>
                          <Badge variant="outline">{plugin.version}</Badge>
                          <Badge 
                            variant={
                              plugin.status === 'active' ? 'default' :
                              plugin.status === 'error' ? 'destructive' : 'secondary'
                            }
                          >
                            {plugin.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {plugin.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          by {plugin.author}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reloadMutation.mutate(plugin.name)}
                          disabled={reloadMutation.isPending}
                          data-testid={`reload-${plugin.name}`}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`configure-${plugin.name}`}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => uninstallMutation.mutate(plugin.name)}
                          disabled={uninstallMutation.isPending}
                          data-testid={`uninstall-${plugin.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}