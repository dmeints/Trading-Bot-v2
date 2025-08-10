import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { 
  Play,
  Square,
  AlertTriangle,
  Activity,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Zap,
  Shield,
  Wifi,
  WifiOff,
  Settings,
  Bell,
  Target,
  BarChart3,
  Timer,
  Pause,
  StopCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BrokerStatus {
  brokerId: string;
  connected: boolean;
  lastHeartbeat: string;
  apiLimits: {
    weight: number;
    maxWeight: number;
    orders: number;
    maxOrders: number;
  };
  latency: number;
}

interface Order {
  id: string;
  brokerId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  quantity: number;
  price?: number;
  status: string;
  filledQuantity: number;
  averagePrice: number;
  timestamp: string;
}

interface Position {
  brokerId: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  averagePrice: number;
  marketValue: number;
  unrealizedPnl: number;
  timestamp: string;
}

interface Balance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  usdValue: number;
}

export default function LiveTrading() {
  const [selectedBroker, setSelectedBroker] = useState<string>('');
  const [orderForm, setOrderForm] = useState({
    symbol: 'BTC/USD',
    side: 'buy',
    type: 'market',
    quantity: '',
    price: ''
  });
  const [brokerForm, setBrokerForm] = useState({
    id: '',
    name: '',
    type: 'binance',
    apiKey: '',
    apiSecret: '',
    passphrase: '',
    testnet: true
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch system status
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/live/status'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch brokers
  const { data: brokersData, isLoading: brokersLoading } = useQuery({
    queryKey: ['/api/live/brokers'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['/api/live/orders'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch positions
  const { data: positionsData, isLoading: positionsLoading } = useQuery({
    queryKey: ['/api/live/positions'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch risk metrics
  const { data: riskData } = useQuery({
    queryKey: ['/api/live/risk/metrics'],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  // Fetch balances for selected broker
  const { data: balancesData } = useQuery({
    queryKey: ['/api/live/balances', selectedBroker],
    enabled: !!selectedBroker,
    refetchInterval: 10000,
  });

  // Toggle trading mode mutation
  const toggleTradingMode = useMutation({
    mutationFn: async (isLive: boolean) => {
      const response = await fetch('/api/live/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLive }),
      });
      
      if (!response.ok) throw new Error('Failed to toggle trading mode');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/live/status'] });
      toast({
        title: "Trading Mode Updated",
        description: `Switched to ${data.data.isLiveTradingMode ? 'LIVE' : 'PAPER'} trading mode.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update trading mode.",
        variant: "destructive",
      });
    },
  });

  // Add broker mutation
  const addBroker = useMutation({
    mutationFn: async (brokerConfig: any) => {
      const response = await fetch('/api/live/brokers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brokerConfig),
      });
      
      if (!response.ok) throw new Error('Failed to add broker');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/live/brokers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/live/status'] });
      setBrokerForm({
        id: '',
        name: '',
        type: 'binance',
        apiKey: '',
        apiSecret: '',
        passphrase: '',
        testnet: true
      });
      toast({
        title: "Broker Added",
        description: "Broker connection has been established successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add broker.",
        variant: "destructive",
      });
    },
  });

  // Place order mutation
  const placeOrder = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await fetch('/api/live/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderData, brokerId: selectedBroker }),
      });
      
      if (!response.ok) throw new Error('Failed to place order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/live/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/live/positions'] });
      setOrderForm(prev => ({ ...prev, quantity: '', price: '' }));
      toast({
        title: "Order Placed",
        description: "Order has been submitted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to place order.",
        variant: "destructive",
      });
    },
  });

  // Cancel order mutation
  const cancelOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/live/orders/${orderId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to cancel order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/live/orders'] });
      toast({
        title: "Order Cancelled",
        description: "Order has been cancelled successfully.",
      });
    },
  });

  // Emergency stop mutation
  const emergencyStop = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/live/emergency/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) throw new Error('Failed to execute emergency stop');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/live/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/live/orders'] });
      toast({
        title: "Emergency Stop Activated",
        description: "All trading has been stopped and open orders cancelled.",
      });
    },
  });

  const systemStatus = statusData?.data;
  const brokers: BrokerStatus[] = brokersData?.data?.brokers || [];
  const orders: Order[] = ordersData?.data?.orders || [];
  const positions: Position[] = positionsData?.data?.positions || [];
  const riskMetrics = riskData?.data;
  const balances: Balance[] = balancesData?.data?.balances || [];

  const isLiveMode = systemStatus?.isLiveTradingMode || false;
  const connectedBrokers = brokers.filter(b => b.connected).length;

  const handlePlaceOrder = () => {
    if (!selectedBroker) {
      toast({
        title: "Error",
        description: "Please select a broker first.",
        variant: "destructive",
      });
      return;
    }

    placeOrder.mutate({
      symbol: orderForm.symbol,
      side: orderForm.side,
      type: orderForm.type,
      quantity: parseFloat(orderForm.quantity),
      price: orderForm.price ? parseFloat(orderForm.price) : undefined
    });
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'filled': return 'bg-green-600';
      case 'open': return 'bg-blue-600';
      case 'cancelled': return 'bg-gray-600';
      case 'rejected': return 'bg-red-600';
      default: return 'bg-yellow-600';
    }
  };

  const getRiskAlertColor = (level: string) => {
    switch (level) {
      case 'HIGH': return 'bg-red-600';
      case 'MEDIUM': return 'bg-yellow-600';
      default: return 'bg-green-600';
    }
  };

  if (statusLoading) {
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
          <h1 className="text-2xl font-bold text-foreground">Live Trading</h1>
          <p className="text-muted-foreground">Real-time trading execution with professional risk management</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={isLiveMode}
              onCheckedChange={(checked) => toggleTradingMode.mutate(checked)}
              disabled={toggleTradingMode.isPending}
            />
            <span className={`font-semibold ${isLiveMode ? 'text-red-600' : 'text-green-600'}`}>
              {isLiveMode ? 'LIVE MODE' : 'PAPER MODE'}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => emergencyStop.mutate()}
            disabled={emergencyStop.isPending}
            className="border-red-600 text-red-600 hover:bg-red-50"
            data-testid="button-emergency-stop"
          >
            <StopCircle className="w-4 h-4 mr-2" />
            Emergency Stop
          </Button>
        </div>
      </div>

      {/* Risk Alert Banner */}
      {riskMetrics && riskMetrics.alertLevel !== 'LOW' && (
        <Card className={`p-4 border-l-4 ${riskMetrics.alertLevel === 'HIGH' ? 'border-red-600 bg-red-50' : 'border-yellow-600 bg-yellow-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className={`w-5 h-5 ${riskMetrics.alertLevel === 'HIGH' ? 'text-red-600' : 'text-yellow-600'}`} />
              <div>
                <h3 className="font-semibold">Risk Alert: {riskMetrics.alertLevel}</h3>
                <p className="text-sm">Monitor position exposure and consider risk reduction measures</p>
              </div>
            </div>
            <Badge className={getRiskAlertColor(riskMetrics.alertLevel)}>
              {riskMetrics.alertLevel} RISK
            </Badge>
          </div>
        </Card>
      )}

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Trading Mode</div>
            {isLiveMode ? (
              <Activity className="w-4 h-4 text-red-600 animate-pulse" />
            ) : (
              <Pause className="w-4 h-4 text-green-600" />
            )}
          </div>
          <div className={`text-2xl font-bold mt-2 ${isLiveMode ? 'text-red-600' : 'text-green-600'}`}>
            {isLiveMode ? 'LIVE' : 'PAPER'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Connected Brokers</div>
            <Wifi className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold mt-2">{connectedBrokers}/{brokers.length}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Active Orders</div>
            <BarChart3 className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {orders.filter(o => o.status === 'open').length}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Total P&L</div>
            {riskMetrics?.totalUnrealizedPnl >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
          </div>
          <div className={`text-2xl font-bold mt-2 ${riskMetrics?.totalUnrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${riskMetrics?.totalUnrealizedPnl?.toLocaleString() || '0'}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="trading" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="trading">Order Entry</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="orders">Order History</TabsTrigger>
          <TabsTrigger value="brokers">Brokers</TabsTrigger>
          <TabsTrigger value="risk">Risk Monitor</TabsTrigger>
        </TabsList>

        {/* Order Entry Tab */}
        <TabsContent value="trading" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Place Order</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="broker-select">Broker</Label>
                  <select 
                    id="broker-select"
                    value={selectedBroker}
                    onChange={(e) => setSelectedBroker(e.target.value)}
                    className="w-full p-2 border rounded-md bg-background"
                    data-testid="select-broker"
                  >
                    <option value="">Select Broker</option>
                    {brokers.filter(b => b.connected).map((broker) => (
                      <option key={broker.brokerId} value={broker.brokerId}>
                        {broker.brokerId} ({Math.round(broker.latency)}ms)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="symbol">Symbol</Label>
                    <Input
                      id="symbol"
                      value={orderForm.symbol}
                      onChange={(e) => setOrderForm(prev => ({ ...prev, symbol: e.target.value }))}
                      placeholder="BTC/USD"
                      data-testid="input-symbol"
                    />
                  </div>
                  <div>
                    <Label htmlFor="side">Side</Label>
                    <select
                      id="side"
                      value={orderForm.side}
                      onChange={(e) => setOrderForm(prev => ({ ...prev, side: e.target.value }))}
                      className="w-full p-2 border rounded-md bg-background"
                      data-testid="select-side"
                    >
                      <option value="buy">Buy</option>
                      <option value="sell">Sell</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Order Type</Label>
                    <select
                      id="type"
                      value={orderForm.type}
                      onChange={(e) => setOrderForm(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full p-2 border rounded-md bg-background"
                      data-testid="select-order-type"
                    >
                      <option value="market">Market</option>
                      <option value="limit">Limit</option>
                      <option value="stop">Stop</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.00001"
                      value={orderForm.quantity}
                      onChange={(e) => setOrderForm(prev => ({ ...prev, quantity: e.target.value }))}
                      placeholder="0.1"
                      data-testid="input-quantity"
                    />
                  </div>
                </div>

                {orderForm.type === 'limit' && (
                  <div>
                    <Label htmlFor="price">Price</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={orderForm.price}
                      onChange={(e) => setOrderForm(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="65000"
                      data-testid="input-price"
                    />
                  </div>
                )}

                <Button 
                  onClick={handlePlaceOrder} 
                  disabled={placeOrder.isPending || !selectedBroker}
                  className="w-full"
                  data-testid="button-place-order"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {placeOrder.isPending ? 'Placing...' : 'Place Order'}
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Account Balances</h3>
              
              {selectedBroker ? (
                <div className="space-y-3">
                  {balances.map((balance) => (
                    <div key={balance.asset} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <span className="font-medium">{balance.asset}</span>
                        <div className="text-sm text-muted-foreground">
                          Free: {balance.free.toFixed(6)} | Locked: {balance.locked.toFixed(6)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{balance.total.toFixed(6)}</div>
                        <div className="text-sm text-muted-foreground">
                          ${balance.usdValue.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Select a broker to view balances
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Positions Tab */}
        <TabsContent value="positions" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Open Positions</h3>
            
            {positions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No open positions
              </div>
            ) : (
              <div className="space-y-3">
                {positions.map((position, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{position.symbol}</div>
                      <div className="text-sm text-muted-foreground">
                        {position.side.toUpperCase()} • {position.quantity.toFixed(6)} @ ${position.averagePrice.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${position.marketValue.toLocaleString()}</div>
                      <div className={`text-sm ${position.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {position.unrealizedPnl >= 0 ? '+' : ''}${position.unrealizedPnl.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Recent Orders</h3>
            
            {orders.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No orders yet
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 10).map((order) => (
                  <div key={order.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge className={getOrderStatusColor(order.status)}>
                        {order.status.toUpperCase()}
                      </Badge>
                      <div>
                        <div className="font-medium">{order.symbol}</div>
                        <div className="text-sm text-muted-foreground">
                          {order.side.toUpperCase()} • {order.quantity} • {order.type.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <div className="font-medium">
                          {order.averagePrice > 0 ? `$${order.averagePrice.toFixed(2)}` : '-'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Filled: {order.filledQuantity}/{order.quantity}
                        </div>
                      </div>
                      {order.status === 'open' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelOrder.mutate(order.id)}
                          disabled={cancelOrder.isPending}
                          data-testid={`button-cancel-${order.id}`}
                        >
                          <Square className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Brokers Tab */}
        <TabsContent value="brokers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Add New Broker</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="broker-id">Broker ID</Label>
                    <Input
                      id="broker-id"
                      value={brokerForm.id}
                      onChange={(e) => setBrokerForm(prev => ({ ...prev, id: e.target.value }))}
                      placeholder="my-binance"
                      data-testid="input-broker-id"
                    />
                  </div>
                  <div>
                    <Label htmlFor="broker-name">Name</Label>
                    <Input
                      id="broker-name"
                      value={brokerForm.name}
                      onChange={(e) => setBrokerForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="My Binance Account"
                      data-testid="input-broker-name"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="broker-type">Broker Type</Label>
                  <select
                    id="broker-type"
                    value={brokerForm.type}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full p-2 border rounded-md bg-background"
                    data-testid="select-broker-type"
                  >
                    <option value="binance">Binance</option>
                    <option value="coinbase">Coinbase Pro</option>
                    <option value="kraken">Kraken</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="api-key">API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      value={brokerForm.apiKey}
                      onChange={(e) => setBrokerForm(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="Enter API Key"
                      data-testid="input-api-key"
                    />
                  </div>
                  <div>
                    <Label htmlFor="api-secret">API Secret</Label>
                    <Input
                      id="api-secret"
                      type="password"
                      value={brokerForm.apiSecret}
                      onChange={(e) => setBrokerForm(prev => ({ ...prev, apiSecret: e.target.value }))}
                      placeholder="Enter API Secret"
                      data-testid="input-api-secret"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={brokerForm.testnet}
                    onCheckedChange={(checked) => setBrokerForm(prev => ({ ...prev, testnet: checked }))}
                  />
                  <Label>Use Testnet</Label>
                </div>

                <Button 
                  onClick={() => addBroker.mutate(brokerForm)} 
                  disabled={addBroker.isPending}
                  className="w-full"
                  data-testid="button-add-broker"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {addBroker.isPending ? 'Adding...' : 'Add Broker'}
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Connected Brokers</h3>
              
              <div className="space-y-3">
                {brokers.map((broker) => (
                  <div key={broker.brokerId} className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {broker.connected ? (
                        <Wifi className="w-4 h-4 text-green-600" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-red-600" />
                      )}
                      <div>
                        <div className="font-medium">{broker.brokerId}</div>
                        <div className="text-sm text-muted-foreground">
                          Latency: {Math.round(broker.latency)}ms
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={broker.connected ? "default" : "destructive"}>
                        {broker.connected ? 'Connected' : 'Disconnected'}
                      </Badge>
                      <div className="text-sm text-muted-foreground mt-1">
                        API: {broker.apiLimits.weight}/{broker.apiLimits.maxWeight}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Risk Monitor Tab */}
        <TabsContent value="risk" className="space-y-4">
          {riskMetrics && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Total Exposure</div>
                    <Target className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    ${riskMetrics.totalExposure?.toLocaleString() || '0'}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Concentration Risk</div>
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    {((riskMetrics.concentrationRisk || 0) * 100).toFixed(1)}%
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Position Count</div>
                    <BarChart3 className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold mt-2">{riskMetrics.positionCount || 0}</div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Alert Level</div>
                    <Shield className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold mt-2">
                    <Badge className={getRiskAlertColor(riskMetrics.alertLevel)}>
                      {riskMetrics.alertLevel}
                    </Badge>
                  </div>
                </Card>
              </div>

              <Card className="p-4">
                <h3 className="font-semibold mb-4">Risk Limits</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Exposure Utilization</span>
                      <span>
                        ${riskMetrics.totalExposure?.toLocaleString() || '0'} / 
                        ${riskMetrics.riskLimits?.maxExposure?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <Progress 
                      value={((riskMetrics.totalExposure || 0) / (riskMetrics.riskLimits?.maxExposure || 1000000)) * 100} 
                      className="h-2" 
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Concentration Limit</span>
                      <span>
                        {((riskMetrics.concentrationRisk || 0) * 100).toFixed(1)}% / 
                        {((riskMetrics.riskLimits?.maxConcentration || 0.25) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Progress 
                      value={((riskMetrics.concentrationRisk || 0) / (riskMetrics.riskLimits?.maxConcentration || 0.25)) * 100} 
                      className="h-2" 
                    />
                  </div>
                </div>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}