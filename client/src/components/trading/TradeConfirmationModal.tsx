import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface TradeConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tradeDetails: {
    symbol: string;
    side: 'buy' | 'sell';
    amount: number;
    price: number;
    orderType: string;
    estimatedFee: number;
    estimatedSlippage: number;
    pnlImpact?: number;
  };
}

export default function TradeConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  tradeDetails
}: TradeConfirmationModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    await onConfirm();
    setIsConfirming(false);
  };

  const totalCost = tradeDetails.amount + tradeDetails.estimatedFee;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <div className={`p-2 rounded-lg ${
              tradeDetails.side === 'buy' ? 'bg-green-600/20' : 'bg-red-600/20'
            }`}>
              {tradeDetails.side === 'buy' ? 
                <TrendingUp className="w-5 h-5 text-green-400" /> :
                <TrendingDown className="w-5 h-5 text-red-400" />
              }
            </div>
            <span>Confirm Trade</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Trade Summary */}
          <div className="bg-gray-900 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Action:</span>
              <Badge 
                className={`${
                  tradeDetails.side === 'buy' 
                    ? 'bg-green-600/20 text-green-400' 
                    : 'bg-red-600/20 text-red-400'
                }`}
                data-testid={`button-${tradeDetails.side}`}
              >
                {tradeDetails.side.toUpperCase()} {tradeDetails.symbol}
              </Badge>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Order Type:</span>
              <span className="font-medium capitalize">{tradeDetails.orderType}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Amount:</span>
              <span className="font-medium">${(tradeDetails.amount || 0).toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Price:</span>
              <span className="font-medium">${(tradeDetails.price || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-gray-900 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-white mb-2">Cost Breakdown</h4>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Trade Amount:</span>
              <span>${(tradeDetails.amount || 0).toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Estimated Fee:</span>
              <span>${(tradeDetails.estimatedFee || 0).toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Estimated Slippage:</span>
              <span>{(tradeDetails.estimatedSlippage || 0).toFixed(3)}%</span>
            </div>
            
            {tradeDetails.pnlImpact && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">P&L Impact:</span>
                <span className={tradeDetails.pnlImpact > 0 ? 'text-green-400' : 'text-red-400'}>
                  ${(tradeDetails.pnlImpact || 0).toFixed(2)}
                </span>
              </div>
            )}
            
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="flex justify-between font-medium">
                <span>Total Cost:</span>
                <span>${(totalCost || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Warnings */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-amber-400 font-medium mb-1">Please Review</p>
                <p className="text-gray-300">
                  This is a {tradeDetails.orderType} order that will execute immediately. 
                  Make sure the amount and price are correct before confirming.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="space-x-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
            className={`${
              tradeDetails.side === 'buy' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            } text-white`}
            data-testid={`button-confirm button-execute button-${tradeDetails.side}`}
          >
            {isConfirming ? 'Executing...' : 'Confirm Trade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}