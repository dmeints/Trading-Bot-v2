import { useTradingStore } from '@/stores/tradingStore';
import { Card } from '@/components/ui/card';
import { BarChart3, TrendingUp, Wallet, Settings, Activity, Zap, Brain } from 'lucide-react';
import { useLocation } from 'wouter';

export default function SidebarNavigation() {
  const { agentStatus, agentActivities } = useTradingStore();
  const [location, setLocation] = useLocation();

  const agentDisplayNames: Record<string, string> = {
    market_analyst: 'Market Analyst',
    news_analyst: 'News Analyst',  
    trading_agent: 'Trading Agent',
    risk_assessor: 'Risk Assessor',
    sentiment_analyst: 'Sentiment Analyst',
  };

  const agentConfidenceScores: Record<string, number> = {
    market_analyst: 87,
    news_analyst: 92,
    trading_agent: 78,
    risk_assessor: 95,
    sentiment_analyst: 83,
  };

  return (
    <aside className="hidden lg:flex w-64 bg-gray-800 border-r border-gray-700 flex-col">
      <div className="p-fluid-2 border-b border-gray-700">
        <h3 className="text-fluid-xs font-semibold text-gray-300 uppercase tracking-wide">AI Agents Status</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto scroll-container-y">
        <div className="p-fluid-2 space-y-fluid-1">
          {Object.entries(agentStatus).map(([agentType, status]) => (
            <Card 
              key={agentType}
              className="bg-gray-700 p-fluid-1 border border-green-500/30 transition-all hover:border-green-500/50"
              data-testid={`card-agent-${agentType}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-fluid-xs font-medium text-white truncate">
                  {agentDisplayNames[agentType] || agentType}
                </span>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0"></div>
              </div>
              <div className="text-xs text-gray-400 truncate-2-lines" data-testid={`text-agent-activity-${agentType}`}>
                {status.lastActivity}
              </div>
              <div className="text-xs text-blue-400 mt-1" data-testid={`text-agent-confidence-${agentType}`}>
                Confidence: {agentConfidenceScores[agentType] || 50}%
              </div>
            </Card>
          ))}
        </div>
      </div>
      
      <div className="p-4 border-t border-gray-700">
        <div className="space-y-2">
          <button 
            onClick={() => setLocation('/')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
              location === '/' 
                ? 'bg-blue-600/20 text-blue-400' 
                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
            data-testid="link-dashboard"
          >
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm font-medium">Dashboard</span>
          </button>
          <button 
            onClick={() => setLocation('/trading')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
              location === '/trading' 
                ? 'bg-blue-600/20 text-blue-400' 
                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
            data-testid="link-trading"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">Trading</span>
          </button>
          <button 
            onClick={() => setLocation('/portfolio')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
              location === '/portfolio' 
                ? 'bg-blue-600/20 text-blue-400' 
                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
            data-testid="link-portfolio"
          >
            <Wallet className="w-4 h-4" />
            <span className="text-sm font-medium">Portfolio</span>
          </button>
          <button 
            onClick={() => setLocation('/mlops')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
              location === '/mlops' 
                ? 'bg-blue-600/20 text-blue-400' 
                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
            data-testid="link-mlops"
          >
            <Brain className="w-4 h-4" />
            <span className="text-sm font-medium">MLOps</span>
          </button>
          <button 
            onClick={() => setLocation('/settings')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
              location === '/settings' 
                ? 'bg-blue-600/20 text-blue-400' 
              : 'text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
            data-testid="link-settings"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium">Settings</span>
          </button>
          
          <button 
            onClick={() => setLocation('/revolutionary')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
              location === '/revolutionary' 
                ? 'bg-purple-600/20 text-purple-400' 
                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
            data-testid="link-revolutionary"
          >
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">Revolutionary AI</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
