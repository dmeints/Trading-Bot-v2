import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';

// Placeholder components - implement as needed  
const CopilotChat = () => <div className="text-gray-400">AI Copilot coming soon</div>;
const MarketInsights = () => <div className="text-gray-400">Market insights loading...</div>;

export default function AIInsights() {
  const { data: agentStatus } = useQuery({
    queryKey: ['/api/ai/status'],
    refetchInterval: 30000,
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">AI Market Insights</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market Insight Agent Status */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Agent Status</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Market Insight</span>
              <span className={`px-2 py-1 rounded text-xs ${
                agentStatus?.market_insight === 'active' ? 'bg-green-600' : 'bg-gray-600'
              }`}>
                {agentStatus?.market_insight || 'Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Risk Assessor</span>
              <span className={`px-2 py-1 rounded text-xs ${
                agentStatus?.risk_assessor === 'active' ? 'bg-green-600' : 'bg-gray-600'
              }`}>
                {agentStatus?.risk_assessor || 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Market Insights */}
        <div className="lg:col-span-2 bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Current Analysis</h2>
          <Suspense fallback={<div className="text-gray-400">Loading insights...</div>}>
            <MarketInsights />
          </Suspense>
        </div>

        {/* AI Copilot Chat */}
        <div className="lg:col-span-3 bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-4">AI Trading Assistant</h2>
          <Suspense fallback={<div className="text-gray-400">Loading copilot...</div>}>
            <CopilotChat />
          </Suspense>
        </div>
      </div>
    </div>
  );
}