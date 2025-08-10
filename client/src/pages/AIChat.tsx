/**
 * Phase B - AI Chat Integration Frontend
 * Comprehensive conversational interface for Stevie's AI trading companion
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Send, 
  Bot, 
  User, 
  MessageSquare, 
  TrendingUp, 
  BarChart3, 
  Target, 
  Lightbulb,
  Clock,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Brain,
  Zap,
  Activity,
  Plus,
  History,
  RefreshCw
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  context?: any;
  metadata?: any;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
}

interface ChatResponse {
  response: string;
  conversationId: string;
  analysis?: any;
  recommendations?: any[];
  marketInsights?: any;
}

export default function AIChat() {
  const [activeConversation, setActiveConversation] = useState<string>('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  // Predefined message suggestions
  const messageSuggestions = [
    { 
      text: "Analyze Bitcoin's current market sentiment", 
      icon: TrendingUp, 
      category: "analysis" 
    },
    { 
      text: "What's your trading recommendation for ETH?", 
      icon: Target, 
      category: "trading" 
    },
    { 
      text: "Show me my portfolio performance", 
      icon: BarChart3, 
      category: "portfolio" 
    },
    { 
      text: "Suggest a trading strategy for current conditions", 
      icon: Lightbulb, 
      category: "strategy" 
    },
    { 
      text: "What are the latest market trends?", 
      icon: Activity, 
      category: "market" 
    },
    { 
      text: "Explain the current market volatility", 
      icon: Brain, 
      category: "education" 
    },
  ];

  // Fetch conversations list
  const { data: conversationsData, isLoading: conversationsLoading } = useQuery({
    queryKey: ['/api/ai/conversations'],
    refetchInterval: 30000,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data: { message: string; context?: any; conversationId?: string }) => 
      apiRequest('/api/ai/chat', 'POST', data),
    onSuccess: (data: ChatResponse) => {
      // Add assistant response to messages
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        metadata: {
          analysis: data.analysis,
          recommendations: data.recommendations,
          marketInsights: data.marketInsights,
        },
      };

      setMessages(prev => [...prev, assistantMessage]);
      setActiveConversation(data.conversationId);
      setShowSuggestions(false);
      
      // Refresh conversations list
      queryClient.invalidateQueries({ queryKey: ['/api/ai/conversations'] });
    },
  });

  // Create new conversation mutation
  const newConversationMutation = useMutation({
    mutationFn: () => apiRequest('/api/ai/conversations', 'POST', {}),
    onSuccess: () => {
      setMessages([]);
      setActiveConversation('');
      setShowSuggestions(true);
      queryClient.invalidateQueries({ queryKey: ['/api/ai/conversations'] });
    },
  });

  // Handle send message
  const handleSendMessage = async (messageText?: string) => {
    const message = messageText || messageInput.trim();
    if (!message) return;

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setMessageInput('');
    
    // Send to API
    sendMessageMutation.mutate({
      message,
      conversationId: activeConversation || undefined,
      context: {
        timestamp: new Date().toISOString(),
        source: 'web_chat',
      },
    });
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background" data-testid="ai-chat">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Bot className="h-8 w-8 text-primary" />
              <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-background"></div>
            </div>
            <div>
              <h1 className="text-xl font-semibold" data-testid="chat-title">
                Stevie AI Assistant
              </h1>
              <p className="text-sm text-muted-foreground">
                Your intelligent trading companion
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <Sparkles className="h-3 w-3 mr-1" />
              Online
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => newConversationMutation.mutate()}
              disabled={newConversationMutation.isPending}
              data-testid="button-new-chat"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversations Sidebar */}
        <div className="w-80 border-r bg-card/50">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center">
              <History className="h-4 w-4 mr-2" />
              Recent Conversations
            </h2>
          </div>
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {conversationsLoading ? (
                [...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))
              ) : (
                conversationsData?.conversations?.map((conv: Conversation) => (
                  <Card 
                    key={conv.id} 
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-accent",
                      activeConversation === conv.id && "bg-accent"
                    )}
                    onClick={() => setActiveConversation(conv.id)}
                    data-testid={`conversation-${conv.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="font-medium text-sm line-clamp-1">
                        {conv.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {conv.lastMessage}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(conv.updatedAt).toLocaleDateString()}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {conv.messageCount} msgs
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.length === 0 && showSuggestions && (
                <div className="text-center py-8">
                  <Bot className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Welcome to Stevie AI</h3>
                  <p className="text-muted-foreground mb-6">
                    I'm your AI trading companion. Ask me about market analysis, trading strategies, or portfolio insights.
                  </p>
                  
                  {/* Suggestions Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                    {messageSuggestions.map((suggestion, index) => {
                      const Icon = suggestion.icon;
                      return (
                        <Card 
                          key={index}
                          className="cursor-pointer transition-all hover:shadow-md hover:scale-105"
                          onClick={() => handleSuggestionClick(suggestion.text)}
                          data-testid={`suggestion-${index}`}
                        >
                          <CardContent className="p-4 text-left">
                            <div className="flex items-start space-x-3">
                              <Icon className="h-5 w-5 text-primary mt-1" />
                              <div>
                                <p className="font-medium text-sm">{suggestion.text}</p>
                                <Badge variant="outline" className="mt-2 text-xs">
                                  {suggestion.category}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Chat Messages */}
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 p-4 rounded-lg",
                    message.role === 'user' 
                      ? "bg-primary/10 ml-auto max-w-3xl" 
                      : "bg-secondary/50 mr-auto max-w-4xl"
                  )}
                  data-testid={`message-${index}`}
                >
                  <div className="flex-shrink-0">
                    {message.role === 'user' ? (
                      <User className="h-6 w-6 text-primary" />
                    ) : (
                      <Bot className="h-6 w-6 text-secondary-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">
                        {message.role === 'user' ? 'You' : 'Stevie'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="prose prose-sm max-w-none text-sm">
                      {message.content.split('\n').map((line, i) => {
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return (
                            <div key={i} className="font-semibold text-base mb-2">
                              {line.replace(/\*\*/g, '')}
                            </div>
                          );
                        } else if (line.startsWith('•')) {
                          return (
                            <div key={i} className="ml-4 mb-1">
                              {line}
                            </div>
                          );
                        } else {
                          return line && <p key={i} className="mb-2">{line}</p>;
                        }
                      })}
                    </div>

                    {/* Show analysis and recommendations for assistant messages */}
                    {message.role === 'assistant' && message.metadata && (
                      <div className="mt-4 space-y-3">
                        {message.metadata.recommendations && (
                          <div className="bg-card p-3 rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <Target className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">AI Recommendations</span>
                            </div>
                            {message.metadata.recommendations.map((rec: any, i: number) => (
                              <div key={i} className="text-sm">
                                <span className="font-medium">{rec.action?.toUpperCase()}</span> {rec.symbol} 
                                - {(rec.confidence * 100).toFixed(0)}% confidence
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {sendMessageMutation.isPending && (
                <div className="flex gap-3 p-4 rounded-lg bg-secondary/50 mr-auto max-w-4xl">
                  <Bot className="h-6 w-6 text-secondary-foreground" />
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce"></div>
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-sm text-muted-foreground">Stevie is thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t bg-card p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-2">
                <Textarea
                  ref={inputRef}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask Stevie about markets, strategies, or portfolio analysis..."
                  className="resize-none min-h-[50px] max-h-32"
                  disabled={sendMessageMutation.isPending}
                  data-testid="input-message"
                />
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  size="lg"
                  data-testid="button-send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Quick Actions */}
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>Press Enter to send, Shift+Enter for new line</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Connected to Stevie AI</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}