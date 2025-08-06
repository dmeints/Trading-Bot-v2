import { useAuth } from '@/hooks/useAuth';
import { useTradingStore } from '@/stores/tradingStore';
import { Button } from '@/components/ui/button';
import { Brain, FlaskConical, LayoutDashboard, TrendingUp, Wallet, TestTube, BookOpen, BarChart3, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';

export default function TopNavigation() {
  const { user } = useAuth();
  const { tradingMode, portfolioSnapshot, setTradingMode } = useTradingStore();
  const { toast } = useToast();
  const [location] = useLocation();

  const navLinks = [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/trading', icon: TrendingUp, label: 'Trading' },
    { href: '/portfolio', icon: Wallet, label: 'Portfolio' },
    { href: '/simulation', icon: TestTube, label: 'Simulation' },
    { href: '/journal', icon: BookOpen, label: 'Journal' },
    { href: '/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  const handleModeToggle = () => {
    const newMode = tradingMode === 'paper' ? 'live' : 'paper';
    setTradingMode(newMode);
    toast({
      title: "Trading Mode Changed",
      description: `Switched to ${newMode === 'paper' ? 'Paper Trading' : 'Live Trading'} mode`,
    });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-8">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Skippy</span>
          <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">AI Trading</span>
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center space-x-1">
          {navLinks.map(({ href, icon: Icon, label }) => {
            const isActive = location === href || (href !== '/' && location.startsWith(href));
            return (
              <Link key={href} href={href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex items-center space-x-2 ${
                    isActive 
                      ? 'bg-blue-600/20 text-blue-400' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                  data-testid={`nav-link-${label.toLowerCase()}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
      
      <div className="flex items-center space-x-6">
        {/* Trading Mode */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">Mode:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleModeToggle}
            className={`${
              tradingMode === 'paper'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-green-500/20 text-green-400 border-green-500/30'
            } hover:opacity-80`}
            data-testid="button-trading-mode"
          >
            <FlaskConical className="w-4 h-4 mr-1" />
            {tradingMode === 'paper' ? 'Paper Trading' : 'Live Trading'}
          </Button>
        </div>
        
        {/* Portfolio Value */}
        <div className="text-right">
          <div className="text-sm text-gray-400">Portfolio Value</div>
          <div className="text-lg font-semibold text-green-400" data-testid="text-portfolio-value">
            {portfolioSnapshot?.totalValue ? `$${parseFloat(portfolioSnapshot.totalValue).toLocaleString()}` : '$0.00'}
          </div>
        </div>
        
        {/* Profile */}
        <div className="flex items-center space-x-2">
          <img 
            src={(user as any)?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&w=32&h=32&fit=crop&crop=face"} 
            alt="User Profile" 
            className="w-8 h-8 rounded-full object-cover"
            data-testid="img-user-avatar"
          />
          <span className="text-sm" data-testid="text-user-name">
            {(user as any)?.firstName || (user as any)?.email || 'Trader'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/api/logout'}
            className="text-gray-400 hover:text-white ml-2"
            data-testid="button-logout"
          >
            Logout
          </Button>
        </div>
      </div>
    </nav>
  );
}
