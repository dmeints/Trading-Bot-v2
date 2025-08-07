import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, ArrowRightLeft, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface OnChainEvent {
  id: string;
  tx_hash: string;
  block_number: number;
  token: string;
  amount: number;
  from_address: string;
  to_address: string;
  event_type: 'whale_transfer' | 'large_swap' | 'bridge_activity';
  timestamp: string;
  metadata: {
    usd_value?: number;
    exchange?: string;
    gas_used?: number;
  };
}

interface OnChainEventsProps {
  token?: string;
  maxItems?: number;
}

export function OnChainEvents({ token, maxItems = 5 }: OnChainEventsProps) {
  const { data: events, isLoading, error } = useQuery({
    queryKey: [`/api/fusion/onchain/events`, token],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (token) params.append('token', token);
      const response = await fetch(`/api/fusion/onchain/events?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch on-chain events');
      }
      const result = await response.json();
      return result.data as OnChainEvent[];
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'whale_transfer':
        return <TrendingUp className="h-4 w-4" />;
      case 'large_swap':
        return <ArrowRightLeft className="h-4 w-4" />;
      case 'bridge_activity':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <ExternalLink className="h-4 w-4" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'whale_transfer':
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case 'large_swap':
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case 'bridge_activity':
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatAmount = (amount: number, token: string) => {
    return `${Number(amount).toLocaleString(undefined, { 
      maximumFractionDigits: 2 
    })} ${token}`;
  };

  const formatUsdValue = (value?: number) => {
    if (!value) return null;
    return `$${Number(value).toLocaleString()}`;
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <Card data-testid="onchain-events-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            On-Chain Activity
          </CardTitle>
          <CardDescription>Recent whale transfers and large transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="onchain-events-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            On-Chain Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load on-chain events. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayEvents = events?.slice(0, maxItems) || [];

  return (
    <Card data-testid="onchain-events">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          On-Chain Activity
          {token && (
            <Badge variant="secondary" className="ml-2">
              {token}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Recent whale transfers and large transactions</CardDescription>
      </CardHeader>
      <CardContent>
        {displayEvents.length === 0 ? (
          <div className="text-center py-6">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              No recent on-chain activity
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayEvents.map((event, index) => (
              <div key={event.id} data-testid={`onchain-event-${index}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getEventIcon(event.event_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <Badge className={`text-xs ${getEventColor(event.event_type)}`}>
                        {formatEventType(event.event_type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      {formatAmount(event.amount, event.token)}
                      {event.metadata.usd_value && (
                        <span className="text-muted-foreground ml-2">
                          ({formatUsdValue(event.metadata.usd_value)})
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{truncateAddress(event.from_address)}</span>
                      <ArrowRightLeft className="h-3 w-3" />
                      <span>{truncateAddress(event.to_address)}</span>
                      {event.metadata.exchange && (
                        <>
                          <span>•</span>
                          <span>{event.metadata.exchange}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {index < displayEvents.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}