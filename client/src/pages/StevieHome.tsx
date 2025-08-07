/**
 * Stevie Home Page - Main interface for AI trading companion
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import StevieChat from '@/components/StevieChat';
import { useQuery } from '@tanstack/react-query';
import { Bot, Brain, TrendingUp, Shield } from 'lucide-react';

export function StevieHome() {
  // Get Stevie's personality for display
  const { data: personalityData } = useQuery({
    queryKey: ['/api/stevie/personality'],
    staleTime: 1000 * 60 * 60,
    retry: false
  });

  const personality = (personalityData as any)?.data;

  return (
    <div className="container mx-auto p-6 max-w-7xl" data-testid="stevie-home">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
              <Bot className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Meet Stevie</h1>
              <p className="text-lg text-muted-foreground">Your AI Trading Companion</p>
            </div>
          </div>
          
          {personality && (
            <div className="max-w-2xl mx-auto">
              <p className="text-muted-foreground leading-relaxed">
                {personality.backstory}
              </p>
            </div>
          )}
        </div>

        {/* Personality & Expertise Cards */}
        {personality && (
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-lg">Expertise</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {personality.expertise.map((skill: string, index: number) => (
                  <Badge key={index} variant="secondary" className="mr-2 mb-2">
                    {skill}
                  </Badge>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg">Trading Style</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {personality.tone}
                </p>
                <div className="mt-3 space-y-1">
                  {personality.traits.map((trait: string, index: number) => (
                    <Badge key={index} variant="outline" className="mr-2 mb-1 text-xs">
                      {trait}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-lg">Communication</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {personality.vocabulary}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Separator />

        {/* Main Chat Interface */}
        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <StevieChat />
          </div>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <button
                  className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  data-testid="ask-market-analysis"
                >
                  <div className="font-medium">Market Analysis</div>
                  <div className="text-sm text-muted-foreground">
                    Get Stevie's take on current market conditions
                  </div>
                </button>
                
                <button
                  className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  data-testid="ask-risk-assessment"
                >
                  <div className="font-medium">Risk Assessment</div>
                  <div className="text-sm text-muted-foreground">
                    Review your portfolio risk levels
                  </div>
                </button>
                
                <button
                  className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  data-testid="ask-strategy-help"
                >
                  <div className="font-medium">Strategy Discussion</div>
                  <div className="text-sm text-muted-foreground">
                    Talk through trading strategies
                  </div>
                </button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Trading Principles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>• Risk management first</div>
                <div>• Data-driven decisions</div>
                <div>• Patience over FOMO</div>
                <div>• Learn from every trade</div>
                <div>• Consistent small wins</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StevieHome;