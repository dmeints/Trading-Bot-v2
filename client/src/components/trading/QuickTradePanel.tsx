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
    <Card className="bg-gray-800 border-gray-700 p-4 h-full">
      <h3 className="text-lg font-semibold text-white mb-4">Quick Trade</h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => handleTrade('buy')}
            disabled={isTrading || executeTradeMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-medium transition-colors disabled:opacity-50"
            data-testid="button-buy"
          >
            {isTrading ? 'Processing...' : 'BUY'}
          </Button>
          <Button
            onClick={() => handleTrade('sell')}
            disabled={isTrading || executeTradeMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded font-medium transition-colors disabled:opacity-50"
            data-testid="button-sell"
          >
            {isTrading ? 'Processing...' : 'SELL'}
          </Button>
        </div>
        
        <div>
          <Label className="text-sm text-gray-400 mb-1">Amount (USD)</Label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-gray-900 border-gray-600 text-white focus:border-blue-600"
            placeholder="1000"
            data-testid="input-trade-amount"
          />
        </div>
        
        <div>
          <Label className="text-sm text-gray-400 mb-1">Order Type</Label>
          <Select value={orderType} onValueChange={setOrderType}>
            <SelectTrigger className="w-full bg-gray-900 border-gray-600 text-white focus:border-blue-600" data-testid="select-order-type">
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
            <Label className="text-sm text-gray-400 mb-1">Limit Price</Label>
            <Input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="w-full bg-gray-900 border-gray-600 text-white focus:border-blue-600"
              placeholder={selectedPrice?.price.toString() || '0'}
              data-testid="input-limit-price"
            />
          </div>
        )}
        
        <div className="text-xs text-gray-400 space-y-1">
          <div className="flex justify-between">
            <span>Estimated Cost:</span>
            <span data-testid="text-estimated-cost">${calculateEstimatedCost().toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Fee:</span>
            <span data-testid="text-estimated-fee">${calculateFee().toFixed(2)}</span>
          </div>
          {selectedPrice && (
            <div className="flex justify-between">
              <span>Current Price:</span>
              <span data-testid="text-market-price">${selectedPrice.price.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
