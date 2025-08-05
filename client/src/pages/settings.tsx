import { useAuth } from '@/hooks/useAuth';
import TopNavigation from '@/components/layout/TopNavigation';
import SidebarNavigation from '@/components/layout/SidebarNavigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTradingStore } from '@/stores/tradingStore';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export default function Settings() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { tradingMode, setTradingMode } = useTradingStore();
  const { toast } = useToast();
  const [riskTolerance, setRiskTolerance] = useState('medium');
  const [maxPositionSize, setMaxPositionSize] = useState('10000');
  const [stopLossEnabled, setStopLossEnabled] = useState(true);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/api/login";
    return null;
  }

  const handleSaveSettings = () => {
    toast({
      title: "Settings Saved",
      description: "Your trading preferences have been updated.",
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <TopNavigation />
      
      <div className="flex pt-16">
        <SidebarNavigation />
        
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Settings</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Account Settings */}
              <Card className="bg-gray-800 border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Account Settings</h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-gray-400 mb-1">Name</Label>
                    <Input
                      value={(user as any)?.firstName || (user as any)?.email || 'Trader'}
                      readOnly
                      className="w-full bg-gray-900 border-gray-600 text-white"
                      data-testid="input-user-name"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-400 mb-1">Email</Label>
                    <Input
                      value={(user as any)?.email || ''}
                      readOnly
                      className="w-full bg-gray-900 border-gray-600 text-white"
                      data-testid="input-user-email"
                    />
                  </div>
                </div>
              </Card>

              {/* Trading Settings */}
              <Card className="bg-gray-800 border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Trading Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-400">Trading Mode</Label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">Paper</span>
                      <Switch
                        checked={tradingMode === 'live'}
                        onCheckedChange={(checked) => setTradingMode(checked ? 'live' : 'paper')}
                        data-testid="switch-trading-mode"
                      />
                      <span className="text-sm">Live</span>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-gray-400 mb-1">Risk Tolerance</Label>
                    <select
                      value={riskTolerance}
                      onChange={(e) => setRiskTolerance(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 text-white rounded px-3 py-2"
                      data-testid="select-risk-tolerance"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-gray-400 mb-1">Max Position Size (USD)</Label>
                    <Input
                      type="number"
                      value={maxPositionSize}
                      onChange={(e) => setMaxPositionSize(e.target.value)}
                      className="w-full bg-gray-900 border-gray-600 text-white"
                      data-testid="input-max-position-size"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-400">Auto Stop Loss</Label>
                    <Switch
                      checked={stopLossEnabled}
                      onCheckedChange={setStopLossEnabled}
                      data-testid="switch-stop-loss"
                    />
                  </div>
                </div>
              </Card>

              {/* AI Agent Settings */}
              <Card className="bg-gray-800 border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">AI Agent Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-400">Market Analysis Agent</Label>
                    <Switch defaultChecked data-testid="switch-market-agent" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-400">News Sentiment Agent</Label>
                    <Switch defaultChecked data-testid="switch-news-agent" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-400">Risk Assessment Agent</Label>
                    <Switch defaultChecked data-testid="switch-risk-agent" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-400">Trading Execution Agent</Label>
                    <Switch defaultChecked data-testid="switch-trading-agent" />
                  </div>
                </div>
              </Card>

              {/* Actions */}
              <Card className="bg-gray-800 border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Actions</h3>
                <div className="space-y-3">
                  <Button
                    onClick={handleSaveSettings}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="button-save-settings"
                  >
                    Save Settings
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                    data-testid="button-reset-settings"
                  >
                    Reset to Defaults
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => window.location.href = '/api/logout'}
                    className="w-full"
                    data-testid="button-logout-settings"
                  >
                    Logout
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}