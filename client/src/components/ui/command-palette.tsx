import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Search, TrendingUp, TrendingDown, BarChart3, Settings, Zap } from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';
import { useLocation } from 'wouter';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  keywords: string[];
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { selectedSymbol, setSelectedSymbol } = useTradingStore();
  const [location, setLocation] = useLocation();

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const commands: Command[] = [
    {
      id: 'buy-btc',
      label: 'Quick Buy BTC',
      description: 'Execute market buy order for Bitcoin',
      icon: TrendingUp,
      action: () => {
        setSelectedSymbol('BTC/USD');
        setLocation('/trading');
      },
      keywords: ['buy', 'bitcoin', 'btc', 'purchase', 'trade']
    },
    {
      id: 'sell-eth',
      label: 'Quick Sell ETH',
      description: 'Execute market sell order for Ethereum',
      icon: TrendingDown,
      action: () => {
        setSelectedSymbol('ETH/USD');
        setLocation('/trading');
      },
      keywords: ['sell', 'ethereum', 'eth', 'trade']
    },
    {
      id: 'ai-analysis',
      label: 'Get AI Analysis',
      description: 'View AI recommendations for current market',
      icon: Zap,
      action: () => {
        setLocation('/');
        // Scroll to AI recommendations section
        setTimeout(() => {
          document.getElementById('ai-recommendations')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },
      keywords: ['ai', 'analysis', 'recommendations', 'insights', 'intelligence']
    },
    {
      id: 'portfolio',
      label: 'View Portfolio',
      description: 'Navigate to portfolio overview',
      icon: BarChart3,
      action: () => setLocation('/portfolio'),
      keywords: ['portfolio', 'holdings', 'balance', 'assets']
    },
    {
      id: 'settings',
      label: 'Open Settings',
      description: 'Configure trading preferences',
      icon: Settings,
      action: () => setLocation('/settings'),
      keywords: ['settings', 'preferences', 'config', 'options']
    },
    {
      id: 'switch-btc',
      label: 'Switch to BTC/USD',
      description: 'Change active trading pair to Bitcoin',
      icon: TrendingUp,
      action: () => setSelectedSymbol('BTC/USD'),
      keywords: ['switch', 'bitcoin', 'btc', 'pair', 'symbol']
    },
    {
      id: 'switch-eth',
      label: 'Switch to ETH/USD',
      description: 'Change active trading pair to Ethereum',
      icon: TrendingUp,
      action: () => setSelectedSymbol('ETH/USD'),
      keywords: ['switch', 'ethereum', 'eth', 'pair', 'symbol']
    }
  ];

  const filteredCommands = commands.filter(command =>
    command.label.toLowerCase().includes(query.toLowerCase()) ||
    command.description?.toLowerCase().includes(query.toLowerCase()) ||
    command.keywords.some(keyword => keyword.toLowerCase().includes(query.toLowerCase()))
  );

  const executeCommand = (command: Command) => {
    command.action();
    setIsOpen(false);
    setQuery('');
  };

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="hidden md:flex items-center space-x-2 bg-gray-800 border-gray-600 text-gray-400 hover:text-white hover:border-gray-500"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm">Search commands...</span>
        <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-gray-600 bg-gray-700 px-1.5 font-mono text-xs text-gray-400">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-lg p-0 overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center border-b border-gray-700 px-4">
            <Search className="w-4 h-4 text-gray-400 mr-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent border-none text-white placeholder-gray-400 focus:outline-none py-4 text-sm"
              autoFocus
            />
            <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border border-gray-600 bg-gray-700 px-1.5 font-mono text-xs text-gray-400">
              ESC
            </kbd>
          </div>

          {/* Commands List */}
          <div className="max-h-80 overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No commands found</p>
                <p className="text-xs">Try searching for "buy", "sell", "portfolio", or "ai"</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCommands.map((command, index) => (
                  <div
                    key={command.id}
                    onClick={() => executeCommand(command)}
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors group"
                  >
                    <command.icon className="w-4 h-4 text-gray-400 group-hover:text-white" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm">{command.label}</div>
                      {command.description && (
                        <div className="text-xs text-gray-400 truncate">{command.description}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {index < 9 && (
                        <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border border-gray-600 bg-gray-700 px-1.5 font-mono text-xs">
                          {index + 1}
                        </kbd>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-700 px-4 py-2 text-xs text-gray-400 flex justify-between">
            <span>↑↓ to navigate • ↵ to select • ESC to close</span>
            <span>⌘K to open</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}