import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertCircle, TrendingUp, TrendingDown, Bell } from 'lucide-react';

interface TradingNotificationsProps {
  // Mock data for demo - in real app this would come from WebSocket or API
  notifications?: Array<{
    type: 'trade_fill' | 'price_alert' | 'balance_low' | 'ai_signal' | 'risk_warning';
    title: string;
    message: string;
    timestamp: Date;
    data?: any;
  }>;
}

export default function TradingNotifications({ notifications = [] }: TradingNotificationsProps) {
  const { toast } = useToast();

  // Mock notifications for demo
  useEffect(() => {
    const mockNotifications = [
      {
        type: 'trade_fill' as const,
        title: 'Order Filled',
        message: 'Your BTC buy order for $1,000 has been executed at $114,590',
        timestamp: new Date(),
        delay: 3000
      },
      {
        type: 'price_alert' as const,
        title: 'Price Alert Triggered',
        message: 'ETH has reached your target price of $3,660',
        timestamp: new Date(),
        delay: 8000
      },
      {
        type: 'ai_signal' as const,
        title: 'AI Signal',
        message: 'Strong bullish signal detected for SOL (confidence: 87%)',
        timestamp: new Date(),
        delay: 15000
      }
    ];

    // Demo: Show mock notifications after delays
    mockNotifications.forEach((notification, index) => {
      setTimeout(() => {
        showNotification(notification.type, notification.title, notification.message);
      }, notification.delay);
    });
  }, []);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'trade_fill':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'price_alert':
        return <Bell className="w-5 h-5 text-blue-400" />;
      case 'balance_low':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'ai_signal':
        return <TrendingUp className="w-5 h-5 text-purple-400" />;
      case 'risk_warning':
        return <TrendingDown className="w-5 h-5 text-red-400" />;
      default:
        return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  const getNotificationVariant = (type: string) => {
    switch (type) {
      case 'trade_fill':
        return 'success';
      case 'risk_warning':
      case 'balance_low':
        return 'destructive';
      case 'ai_signal':
        return 'default';
      default:
        return 'default';
    }
  };

  const showNotification = (type: string, title: string, message: string) => {
    toast({
      title: title,
      description: message,
      variant: getNotificationVariant(type) as any,
      duration: type === 'risk_warning' ? 10000 : 5000, // Keep warnings longer
    });
  };

  // Process incoming notifications
  useEffect(() => {
    notifications.forEach((notification) => {
      showNotification(notification.type, notification.title, notification.message);
    });
  }, [notifications]);

  return null; // This component only manages notifications, no UI
}