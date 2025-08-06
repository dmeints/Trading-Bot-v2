import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useTradingStore, useSelectedMarketPrice } from '@/stores/tradingStore';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Calculator, TrendingUp, TrendingDown, AlertTriangle, Target, Shield } from 'lucide-react';

const advancedOrderSchema = z.object({
  orderType: z.enum(['market', 'limit', 'stop', 'stop_limit', 'trailing_stop', 'oco']),
  side: z.enum(['buy', 'sell']),
  quantity: z.number().positive(),
  price: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  trailingAmount: z.number().positive().optional(),
  trailingPercent: z.number().min(0.1).max(50).optional(),
  timeInForce: z.enum(['GTC', 'IOC', 'FOK', 'DAY']),
  reduceOnly: z.boolean().optional(),
  postOnly: z.boolean().optional(),
});

type AdvancedOrderForm = z.infer<typeof advancedOrderSchema>;

export default function AdvancedOrderPanel() {
  const { selectedSymbol, tradingMode } = useTradingStore();
  const selectedPrice = useSelectedMarketPrice();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('buy');
  const [riskCalculation, setRiskCalculation] = useState<{
    riskAmount: number;
    riskPercentage: number;
    rewardRatio: number;
  } | null>(null);

  const form = useForm<AdvancedOrderForm>({
    resolver: zodResolver(advancedOrderSchema),
    defaultValues: {
      orderType: 'limit',
      side: 'buy',
      quantity: 0,
      timeInForce: 'GTC',
      reduceOnly: false,
      postOnly: false,
    },
  });

  const executeOrderMutation = useMutation({
    mutationFn: async (data: AdvancedOrderForm) => {
      const response = await fetch('/api/trading/execute/advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, symbol: selectedSymbol }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Order Placed",
        description: `Advanced order placed successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/trading'] });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to place order",
        variant: "destructive",
      });
    },
  });

  const calculateRisk = (formData: AdvancedOrderForm) => {
    if (!selectedPrice || !formData.price || !formData.stopPrice) return;
    
    const entryPrice = formData.price;
    const stopPrice = formData.stopPrice;
    const quantity = formData.quantity;
    
    const riskPerUnit = Math.abs(entryPrice - stopPrice);
    const totalRisk = riskPerUnit * quantity;
    const portfolioValue = 100000; // This should come from portfolio data
    const riskPercentage = (totalRisk / portfolioValue) * 100;
    
    // Calculate potential reward (assuming 2:1 ratio)
    const targetPrice = entryPrice + (riskPerUnit * 2);
    const rewardPerUnit = Math.abs(targetPrice - entryPrice);
    const rewardRatio = rewardPerUnit / riskPerUnit;
    
    setRiskCalculation({
      riskAmount: totalRisk,
      riskPercentage,
      rewardRatio,
    });
  };

  const onSubmit = (data: AdvancedOrderForm) => {
    const orderData = {
      ...data,
      side: activeTab as 'buy' | 'sell',
    };
    executeOrderMutation.mutate(orderData);
  };

  const orderType = form.watch('orderType');
  const isLoading = executeOrderMutation.isPending;

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-4">
        <CardTitle className="text-white flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <Calculator className="w-5 h-5 text-blue-400" />
            <span>Advanced Orders</span>
          </span>
          <Badge variant="outline" className="text-xs">
            {tradingMode === 'paper' ? 'Paper' : 'Live'} Trading
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 bg-gray-700">
            <TabsTrigger value="buy" className="data-[state=active]:bg-green-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              Buy
            </TabsTrigger>
            <TabsTrigger value="sell" className="data-[state=active]:bg-red-600">
              <TrendingDown className="w-4 h-4 mr-1" />
              Sell
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Order Type Selection */}
              <div className="space-y-2">
                <Label className="text-gray-300">Order Type</Label>
                <Select
                  value={orderType}
                  onValueChange={(value: any) => form.setValue('orderType', value)}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">Market</SelectItem>
                    <SelectItem value="limit">Limit</SelectItem>
                    <SelectItem value="stop">Stop Loss</SelectItem>
                    <SelectItem value="stop_limit">Stop Limit</SelectItem>
                    <SelectItem value="trailing_stop">Trailing Stop</SelectItem>
                    <SelectItem value="oco">One-Cancels-Other (OCO)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label className="text-gray-300">Quantity</Label>
                <Input
                  type="number"
                  step="0.00001"
                  placeholder="0.00000"
                  {...form.register('quantity', { valueAsNumber: true })}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>

              {/* Price (for limit orders) */}
              {(orderType === 'limit' || orderType === 'stop_limit') && (
                <div className="space-y-2">
                  <Label className="text-gray-300 flex items-center justify-between">
                    <span>Limit Price</span>
                    {selectedPrice && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => form.setValue('price', selectedPrice.price)}
                        className="h-auto p-1 text-xs text-blue-400"
                      >
                        Use Market: ${selectedPrice.price.toFixed(2)}
                      </Button>
                    )}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...form.register('price', { valueAsNumber: true })}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              )}

              {/* Stop Price */}
              {(orderType === 'stop' || orderType === 'stop_limit' || orderType === 'oco') && (
                <div className="space-y-2">
                  <Label className="text-gray-300">Stop Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...form.register('stopPrice', { valueAsNumber: true })}
                    className="bg-gray-700 border-gray-600 text-white"
                    onChange={() => calculateRisk(form.getValues())}
                  />
                </div>
              )}

              {/* Trailing Stop Options */}
              {orderType === 'trailing_stop' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Trailing Amount ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...form.register('trailingAmount', { valueAsNumber: true })}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Trailing Percent (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      {...form.register('trailingPercent', { valueAsNumber: true })}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>
              )}

              {/* Time in Force */}
              <div className="space-y-2">
                <Label className="text-gray-300">Time in Force</Label>
                <Select
                  value={form.watch('timeInForce')}
                  onValueChange={(value: any) => form.setValue('timeInForce', value)}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GTC">Good Till Canceled</SelectItem>
                    <SelectItem value="IOC">Immediate or Cancel</SelectItem>
                    <SelectItem value="FOK">Fill or Kill</SelectItem>
                    <SelectItem value="DAY">Day Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Advanced Options */}
              <div className="space-y-3">
                <Label className="text-gray-300">Advanced Options</Label>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <Label htmlFor="reduce-only" className="text-sm text-gray-300">
                      Reduce Only
                    </Label>
                  </div>
                  <Switch
                    id="reduce-only"
                    checked={form.watch('reduceOnly')}
                    onCheckedChange={(checked) => form.setValue('reduceOnly', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Target className="w-4 h-4 text-green-400" />
                    <Label htmlFor="post-only" className="text-sm text-gray-300">
                      Post Only
                    </Label>
                  </div>
                  <Switch
                    id="post-only"
                    checked={form.watch('postOnly')}
                    onCheckedChange={(checked) => form.setValue('postOnly', checked)}
                  />
                </div>
              </div>

              {/* Risk Calculation */}
              {riskCalculation && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="text-gray-300 flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span>Risk Analysis</span>
                    </Label>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Risk Amount</p>
                        <p className="text-white font-medium">
                          ${riskCalculation.riskAmount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Risk Percentage</p>
                        <p className={`font-medium ${riskCalculation.riskPercentage > 2 ? 'text-red-400' : 'text-green-400'}`}>
                          {riskCalculation.riskPercentage.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Risk Level</span>
                        <span className="text-gray-300">{riskCalculation.riskPercentage.toFixed(1)}%</span>
                      </div>
                      <Progress 
                        value={Math.min(riskCalculation.riskPercentage, 5)} 
                        max={5} 
                        className="h-2"
                      />
                    </div>
                    
                    <div className="text-sm">
                      <span className="text-gray-400">Reward Ratio: </span>
                      <span className="text-white font-medium">
                        1:{riskCalculation.rewardRatio.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading || !selectedSymbol}
                className={`w-full font-medium py-3 ${
                  activeTab === 'buy' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                } text-white transition-colors`}
              >
                {isLoading ? 'Placing Order...' : `Place ${orderType.toUpperCase()} ${activeTab.toUpperCase()} Order`}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}