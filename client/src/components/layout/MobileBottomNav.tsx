import { Link, useLocation } from 'wouter';
import { BarChart3, TrendingUp, Wallet, Settings, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MobileBottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: '/', icon: BarChart3, label: 'Dashboard' },
    { href: '/trading', icon: TrendingUp, label: 'Trading' },
    { href: '/portfolio', icon: Wallet, label: 'Portfolio' },
    { href: '/analytics', icon: Activity, label: 'Analytics' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-800 border-t border-gray-700 px-fluid-1 py-fluid-1" data-testid="bottom-nav">
      <div className="flex items-center justify-around">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = location === href || (href !== '/' && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <Button
                variant="ghost"
                size="sm"
                className={`flex flex-col items-center space-y-1 p-fluid-1 h-auto min-w-0 ${
                  isActive 
                    ? 'text-blue-400' 
                    : 'text-gray-400 hover:text-white'
                }`}
                data-testid={`mobile-nav-${label.toLowerCase()}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs leading-none">{label}</span>
              </Button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}