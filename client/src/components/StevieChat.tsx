/**
 * StevieChat - AI Trading Companion Interface
 * 
 * Interactive chat component for communicating with Stevie
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, TrendingUp, AlertTriangle, Heart } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ChatMessage {
  id: string;
  type: 'user' | 'stevie';
  content: string;
  timestamp: string;
  messageType?: 'greeting' | 'risk_warning' | 'trade_success' | 'market_analysis' | 'encouragement';
}

interface SteviePersonality {
  name: string;
  backstory: string;
  tone: string;
  vocabulary: string;
  expertise: string[];
  traits: string[];
}

export function StevieChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Get Stevie's personality info
  const { data: personalityData } = useQuery({
    queryKey: ['/api/stevie/personality'],
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    retry: false
  });

  const personality: SteviePersonality | undefined = (personalityData as any)?.data;

  // Get daily tip on component mount
  const { data: dailyTipData } = useQuery({
    queryKey: ['/api/stevie/daily-tip'],
    staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
    retry: false
  });

  // Get greeting on component mount  
  const { data: greetingData } = useQuery({
    queryKey: ['/api/stevie/greeting'],
    staleTime: 1000 * 60 * 15, // Cache for 15 minutes
    retry: false
  });

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest('/api/stevie/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message,
          context: {
            portfolioValue: 0
          }
        })
      });
    },
    onSuccess: (response: any) => {
      const stevieMessage: ChatMessage = {
        id: `stevie-${Date.now()}`,
        type: 'stevie',
        content: response?.data?.message || 'I received your message but had trouble responding.',
        timestamp: response?.data?.timestamp || new Date().toISOString(),
        messageType: 'market_analysis'
      };
      setMessages(prev => [...prev, stevieMessage]);
      setIsTyping(false);
    },
    onError: () => {
      const errorMessage: ChatMessage = {
        id: `stevie-error-${Date.now()}`,
        type: 'stevie',
        content: "Sorry, I'm having a technical moment. Can you try that again?",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsTyping(false);
    }
  });

  // Initialize with greeting and daily tip
  useEffect(() => {
    const initMessages: ChatMessage[] = [];
    
    const greetingResponse = greetingData as any;
    const tipResponse = dailyTipData as any;
    
    if (greetingResponse?.data?.message) {
      initMessages.push({
        id: 'greeting',
        type: 'stevie',
        content: greetingResponse.data.message,
        timestamp: greetingResponse.timestamp || new Date().toISOString(),
        messageType: 'greeting'
      });
    }
    
    if (tipResponse?.data?.tip) {
      initMessages.push({
        id: 'daily-tip',
        type: 'stevie',
        content: `💡 Today's Trading Tip: ${tipResponse.data.tip}`,
        timestamp: tipResponse.timestamp || new Date().toISOString()
      });
    }
    
    if (initMessages.length > 0) {
      setMessages(initMessages);
    }
  }, [greetingData, dailyTipData]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || chatMutation.isPending) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    
    // Send to Stevie
    chatMutation.mutate(inputMessage);
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageIcon = (messageType?: string) => {
    switch (messageType) {
      case 'trade_success':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'risk_warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'encouragement':
        return <Heart className="h-4 w-4 text-pink-500" />;
      default:
        return <Bot className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Card className="flex flex-col h-[600px]" data-testid="stevie-chat-container">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
              ST
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-lg">Stevie - AI Trading Companion</CardTitle>
            {personality && (
              <p className="text-sm text-muted-foreground">
                {personality.backstory.split('.')[0]}.
              </p>
            )}
          </div>
          <Badge variant="outline" className="text-xs">
            Online
          </Badge>
        </div>
        
        {personality && (
          <div className="flex flex-wrap gap-2 pt-2">
            {personality.expertise.slice(0, 3).map((skill, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                data-testid={`message-${message.type}-${message.id}`}
              >
                {message.type === 'stevie' && (
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                      ST
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : ''}`}>
                  <div 
                    className={`p-3 rounded-lg ${
                      message.type === 'user' 
                        ? 'bg-blue-600 text-white ml-auto' 
                        : 'bg-gray-100 dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {message.type === 'stevie' && message.messageType && (
                        <div className="mt-0.5">
                          {getMessageIcon(message.messageType)}
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                
                {message.type === 'user' && (
                  <Avatar className="h-8 w-8 mt-1 order-1">
                    <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            
            {isTyping && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                    ST
                  </AvatarFallback>
                </Avatar>
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="flex items-center gap-1">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">Stevie is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <Separator />

        <div className="p-4">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Stevie about trading strategies, market analysis, or risk management..."
              className="flex-1"
              disabled={chatMutation.isPending}
              data-testid="chat-input"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || chatMutation.isPending}
              size="icon"
              data-testid="send-message-button"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <span>{personality?.traits.join(' • ')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default StevieChat;