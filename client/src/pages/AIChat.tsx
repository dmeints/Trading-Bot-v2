import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Send, Bot, User, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, queryClient as defaultQueryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    confidence?: number;
    tradingSignal?: 'BUY' | 'SELL' | 'HOLD';
    marketData?: any;
  };
}

interface ChatResponse {
  message: string;
  confidence?: number;
  tradingSignal?: 'BUY' | 'SELL' | 'HOLD';
  marketData?: any;
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hey there! I'm Stevie, your AI trading companion! 🚀 I'm here to help you analyze markets, understand trading opportunities, and make data-driven decisions. What would you like to know about the crypto markets today?",
      timestamp: new Date(),
      metadata: { confidence: 0.95 }
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClientInstance = useQueryClient();
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get current market context for Stevie
  const { data: marketData } = useQuery({
    queryKey: ['/api/market/price'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: portfolioData } = useQuery({
    queryKey: ['/api/portfolio/summary'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: recommendations } = useQuery({
    queryKey: ['/api/ai/recommendations'],
    refetchInterval: 60000, // Refresh every minute
  });

  const sendMessage = useMutation({
    mutationFn: async (message: string): Promise<ChatResponse> => {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          context: {
            marketData: marketData?.data,
            portfolioData: portfolioData?.data,
            recommendations: recommendations || []
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return {
        message: data.message,
        confidence: data.confidence,
        tradingSignal: data.tradingSignal,
        marketData: data.marketData,
      };
    },
    onSuccess: (response) => {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: response.message,
        timestamp: new Date(),
        metadata: {
          confidence: response.confidence,
          tradingSignal: response.tradingSignal,
          marketData: response.marketData,
        }
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    },
    onError: (error: any) => {
      console.error('Chat error:', error);
      toast({
        title: "Chat Error",
        description: "Failed to get response from Stevie. Please try again.",
        variant: "destructive",
      });
      setIsTyping(false);
    },
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessage.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    sendMessage.mutate(input.trim());
  };

  const getSignalBadge = (signal?: string) => {
    if (!signal) return null;
    
    const config = {
      BUY: { color: 'bg-green-600', icon: TrendingUp },
      SELL: { color: 'bg-red-600', icon: AlertCircle },
      HOLD: { color: 'bg-blue-600', icon: CheckCircle },
    }[signal];

    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white ml-2`}>
        <Icon className="w-3 h-3 mr-1" />
        {signal}
      </Badge>
    );
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return null;
    
    const percentage = Math.round(confidence * 100);
    const color = confidence > 0.8 ? 'bg-green-100 text-green-800' : 
                  confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-red-100 text-red-800';

    return (
      <Badge className={`${color} text-xs ml-2`}>
        {percentage}% confidence
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4 space-y-4">
      {/* Header */}
      <Card className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="flex items-center space-x-3">
          <Bot className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold">Stevie AI Chat</h1>
            <p className="text-sm opacity-90">Your intelligent trading companion with real-time market analysis</p>
          </div>
        </div>
      </Card>

      {/* Market Context Panel */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 text-sm">
          {marketData?.data?.price && (
            <div className="flex items-center space-x-2">
              <span className="text-muted-foreground">BTC:</span>
              <span className="font-medium">${(marketData.data.price as number)?.toLocaleString()}</span>
            </div>
          )}
          {portfolioData?.data && (
            <div className="flex items-center space-x-2">
              <span className="text-muted-foreground">Portfolio:</span>
              <span className="font-medium">${(portfolioData.data as any).totalValue?.toLocaleString()}</span>
            </div>
          )}
          {recommendations && Array.isArray(recommendations) && recommendations.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-muted-foreground">Active Signals:</span>
              <span className="font-medium">{recommendations.length}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Messages */}
      <Card className="flex-1 p-4">
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.type === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div
                  className={`max-w-md p-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  
                  {message.metadata && (
                    <div className="flex flex-wrap items-center mt-2">
                      {getSignalBadge(message.metadata.tradingSignal)}
                      {getConfidenceBadge(message.metadata.confidence)}
                    </div>
                  )}
                  
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>

                {message.type === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            
            {isTyping && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="max-w-md p-3 rounded-lg bg-muted">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </Card>

      {/* Input */}
      <Card className="p-4">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Stevie about markets, trading strategies, or get portfolio analysis..."
            className="flex-1"
            disabled={sendMessage.isPending}
            data-testid="input-chat-message"
          />
          <Button 
            type="submit" 
            disabled={!input.trim() || sendMessage.isPending}
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </Card>

      {/* Quick Actions */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setInput("What's the current market sentiment for Bitcoin?")}
            data-testid="button-market-sentiment"
          >
            Market Sentiment
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setInput("Analyze my portfolio performance")}
            data-testid="button-portfolio-analysis"
          >
            Portfolio Analysis
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setInput("What trading opportunities do you see right now?")}
            data-testid="button-trading-opportunities"
          >
            Trading Opportunities
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setInput("Explain your latest recommendation")}
            data-testid="button-explain-recommendation"
          >
            Explain Recommendations
          </Button>
        </div>
      </Card>
    </div>
  );
}