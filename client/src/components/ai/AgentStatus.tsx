import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTradingStore } from '@/stores/tradingStore';
import { Brain, TrendingUp, Newspaper, Bot, Shield, Heart } from 'lucide-react';
import { useEffect } from 'react';

interface AgentActivity {
  id: string;
  agentType: string;
  activity: string;
  confidence: number;
  createdAt: string;
}

interface AgentStatusData {
  agents: Array<{
    type: string;
    status: string;
    lastActivity: string;
  }>;
  recentActivities: AgentActivity[];
}

export default function AgentStatus() {
  const { agentStatus, agentActivities, updateAgentStatus, updateAgentActivities } = useTradingStore();

  const { data: statusData, isLoading } = useQuery<AgentStatusData>({
    queryKey: ['/api/ai/agents/status'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  useEffect(() => {
    if (statusData) {
      // Update agent status
      statusData.agents.forEach((agent: any) => {
        updateAgentStatus(agent.type, {
          status: agent.status,
          lastActivity: agent.lastActivity,
        });
      });
      
      // Update recent activities
      if (statusData.recentActivities) {
        updateAgentActivities(statusData.recentActivities);
      }
    }
  }, [statusData, updateAgentStatus, updateAgentActivities]);

  const agentIcons: Record<string, React.ReactNode> = {
    market_analyst: <TrendingUp className="w-4 h-4" />,
    news_analyst: <Newspaper className="w-4 h-4" />,
    trading_agent: <Bot className="w-4 h-4" />,
    risk_assessor: <Shield className="w-4 h-4" />,
    sentiment_analyst: <Heart className="w-4 h-4" />,
  };

  const agentDisplayNames: Record<string, string> = {
    market_analyst: 'Market Analyst',
    news_analyst: 'News Analyst',
    trading_agent: 'Trading Agent',
    risk_assessor: 'Risk Assessor',
    sentiment_analyst: 'Sentiment Analyst',
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-amber-400';
    return 'text-red-400';
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500';
      case 'processing':
        return 'bg-amber-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (isLoading && Object.keys(agentStatus).length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700 p-4 h-full">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white mb-2">AI Agent Status</h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 bg-gray-600 rounded w-24"></div>
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
              </div>
              <div className="h-3 bg-gray-600 rounded w-32 mb-1"></div>
              <div className="h-3 bg-gray-600 rounded w-20"></div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700 p-4 h-full overflow-hidden">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">AI Agent Status</h3>
        <div className="flex items-center space-x-2">
          <Brain className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-gray-400">
            {Object.keys(agentStatus).length} agents active
          </span>
        </div>
      </div>
      
      <div className="space-y-3 overflow-y-auto max-h-[calc(100%-6rem)]">
        {Object.entries(agentStatus).map(([agentType, status]) => {
          const recentActivity = agentActivities.find(a => a.agentType === agentType);
          const confidence = recentActivity?.confidence || 0.75;

          return (
            <Card 
              key={agentType}
              className="bg-gray-700 p-3 border border-green-500/30 hover:border-green-500/50 transition-colors"
              data-testid={`agent-status-card-${agentType}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="text-blue-400">
                    {agentIcons[agentType] || <Brain className="w-4 h-4" />}
                  </div>
                  <span className="text-sm font-medium text-white">
                    {agentDisplayNames[agentType] || agentType}
                  </span>
                </div>
                <div 
                  className={`w-2 h-2 rounded-full animate-pulse ${getStatusColor(status.status)}`}
                  data-testid={`agent-status-indicator-${agentType}`}
                ></div>
              </div>
              
              <div className="text-xs text-gray-400 mb-2" data-testid={`agent-activity-${agentType}`}>
                {status.lastActivity}
              </div>
              
              <div className="flex items-center justify-between">
                <Badge 
                  variant="outline" 
                  className="text-xs px-2 py-0.5 border-gray-500 text-gray-300"
                >
                  {status.status}
                </Badge>
                <span 
                  className={`text-xs font-medium ${getConfidenceColor(confidence)}`}
                  data-testid={`agent-confidence-${agentType}`}
                >
                  {Math.round(confidence * 100)}% confidence
                </span>
              </div>
            </Card>
          );
        })}
      </div>
      
      {/* Recent Activities Section */}
      {agentActivities.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Recent Activity</h4>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {agentActivities.slice(0, 3).map((activity) => (
              <div 
                key={activity.id} 
                className="text-xs text-gray-400 flex items-center space-x-2"
                data-testid={`recent-activity-${activity.id}`}
              >
                <div className="text-blue-400">
                  {agentIcons[activity.agentType] || <Brain className="w-3 h-3" />}
                </div>
                <span className="flex-1 truncate">{activity.activity}</span>
                <span className={getConfidenceColor(activity.confidence)}>
                  {Math.round(activity.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
