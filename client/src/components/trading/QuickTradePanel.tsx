import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTradingStore, useSelectedMarketPrice } from '@/stores/tradingStore';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';

interface TradeRequest {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  orderType: 'market' | 'limit' | 'stop';
  price?: number;
}

export default function QuickTradePanel() {
  const { selectedSymbol, isTrading, setIsTrading } = useTradingStore();
  const selectedPrice = useSelectedMarketPrice();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('1000');
  const [orderType, setOrderType] = useState('market');
  const [limitPrice, setLimitPrice] = useState('');
  const [balance] = useState(10000); // Mock balance for display

  const executeTradeMutation = useMutation({
    mutationFn: async (tradeRequest: TradeRequest) => {
      const response = await apiRequest('POST', '/api/trading/execute', tradeRequest);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Trade Executed",
        description: `Successfully executed ${data.trade?.side} order for ${selectedSymbol}`,
      });
      
      // Refresh portfolio data
      queryClient.invalidateQueries({ queryKey: ['/api/trading/positions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trading/trades'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/summary'] });
      
      setIsTrading(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }

      toast({
        title: "Trade Failed",
        description: error.message || "Failed to execute trade",
        variant: "destructive",
      });
      setIsTrading(false);
    },
  });

  const handleTrade = (side: 'buy' | 'sell') => {
    if (!selectedPrice || !amount) {
      toast({
        title: "Invalid Trade",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    setIsTrading(true);

    const tradeAmount = parseFloat(amount);
    const currentPrice = selectedPrice.price;
    const quantity = tradeAmount / currentPrice;

    const tradeRequest: TradeRequest = {
      symbol: selectedSymbol,
      side,
      quantity,
      orderType: orderType as 'market' | 'limit' | 'stop',
    };

    if (orderType === 'limit' && limitPrice) {
      tradeRequest.price = parseFloat(limitPrice);
    }

    executeTradeMutation.mutate(tradeRequest);
  };

  const calculateEstimatedCost = () => {
    if (!amount || !selectedPrice) return 0;
    return parseFloat(amount);
  };

  const calculateFee = () => {
    const cost = calculateEstimatedCost();
    return cost * 0.001; // 0.1% fee
  };

  return (
    <Card className="bg-gray-800 border-gray-700 p-fluid-2 h-full card-widget">
      <h3 className="text-fluid-lg font-semibold text-white mb-fluid-2">Quick Trade</h3>
      
      <div className="space-y-fluid-2 h-full flex flex-col">
        {/* Buy/Sell Buttons */}
        <div className="grid grid-cols-2 gap-fluid-1">
          <Button
            onClick={() => handleTrade('buy')}
            disabled={isTrading || executeTradeMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white py-fluid-1 px-fluid-2 rounded font-medium transition-colors disabled:opacity-50 text-fluid-sm"
            data-testid="button-buy"
          >
            {isTrading ? 'Processing...' : 'BUY'}
          </Button>
          <Button
            onClick={() => handleTrade('sell')}
            disabled={isTrading || executeTradeMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white py-fluid-1 px-fluid-2 rounded font-medium transition-colors disabled:opacity-50 text-fluid-sm"
            data-testid="button-sell"
          >
            {isTrading ? 'Processing...' : 'SELL'}
          </Button>
        </div>
        
        {/* Trade Form */}
        <div className="space-y-fluid-2 flex-1">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-fluid-xs text-gray-400">Amount (USD)</Label>
              <span className="text-fluid-xs text-gray-400">Balance: ${balance.toLocaleString()}</span>
            </div>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-900 border-gray-600 text-white focus:border-blue-600 text-fluid-sm"
              placeholder="1000"
              data-testid="input-trade-amount"
            />
            {/* Balance Presets */}
            <div className="flex gap-1 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAmount((balance * 0.25).toString())}
                className="flex-1 text-xs bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300"
              >
                25%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAmount((balance * 0.5).toString())}
                className="flex-1 text-xs bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300"
              >
                50%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAmount((balance * 0.75).toString())}
                className="flex-1 text-xs bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300"
              >
                75%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAmount(balance.toString())}
                className="flex-1 text-xs bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300"
              >
                MAX
              </Button>
            </div>
            {/* Fine-grain slider for 50% to MAX */}
            <div className="mt-2">
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={Math.min(100, Math.max(50, (parseFloat(amount) / balance) * 100))}
                onChange={(e) => setAmount(((parseFloat(e.target.value) / 100) * balance).toString())}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${Math.min(100, Math.max(50, (parseFloat(amount) / balance) * 100)) - 50}%, #374151 ${Math.min(100, Math.max(50, (parseFloat(amount) / balance) * 100)) - 50}%, #374151 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>50%</span>
                <span>MAX</span>
              </div>
            </div>
          </div>
          
          <div>
            <Label className="text-fluid-xs text-gray-400 mb-1 block">Order Type</Label>
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger className="w-full bg-gray-900 border-gray-600 text-white focus:border-blue-600 text-fluid-sm" data-testid="select-order-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-600">
                <SelectItem value="market">Market Order</SelectItem>
                <SelectItem value="limit">Limit Order</SelectItem>
                <SelectItem value="stop">Stop Loss</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {orderType === 'limit' && (
            <div>
              <Label className="text-fluid-xs text-gray-400 mb-1 block">Limit Price</Label>
              <Input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="w-full bg-gray-900 border-gray-600 text-white focus:border-blue-600 text-fluid-sm"
                placeholder={selectedPrice?.price.toString() || '0'}
                data-testid="input-limit-price"
              />
            </div>
          )}
        </div>
        
        {/* Trade Summary */}
        <div className="text-fluid-xs text-gray-400 space-y-1 mt-auto border-t border-gray-700 pt-fluid-1">
          <div className="flex justify-between">
            <span>Estimated Cost:</span>
            <span data-testid="text-estimated-cost" className="text-white">${calculateEstimatedCost().toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              Fee:
              <span className="text-xs bg-gray-700 px-1 rounded cursor-help" title="0.10% maker / 0.12% taker fee">
                ⓘ
              </span>
            </span>
            <span data-testid="text-estimated-fee" className="text-white">${calculateFee().toFixed(2)}</span>
          </div>
          {selectedPrice && (
            <div className="flex justify-between">
              <span>Current Price:</span>
              <span data-testid="text-market-price" className="text-white">${selectedPrice.price.toFixed(2)}</span>
            </div>
          )}
          <div className="text-xs text-gray-500 mt-2">
            Pro tip: Use ↑/↓ arrows to adjust amount, Enter to submit
          </div>
        </div>
      </div>
    </Card>
  );
}
