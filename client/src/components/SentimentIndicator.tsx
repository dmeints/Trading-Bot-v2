import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface SentimentData {
  id: string;
  date: string;
  score: number;
  source: 'reddit' | 'twitter' | 'news' | 'aggregate';
  token?: string;
  metadata: {
    total_mentions?: number;
    trending_keywords?: string[];
  };
}

interface SentimentIndicatorProps {
  token?: string;
  showSparkline?: boolean;
  compact?: boolean;
}

export function SentimentIndicator({ token, showSparkline = true, compact = false }: SentimentIndicatorProps) {
  const { data: sentimentData, isLoading, error } = useQuery({
    queryKey: [`/api/fusion/sentiment`, token],
    queryFn: async () => {
      const params = new URLSearchParams({ days: '7' });
      if (token) params.append('token', token);
      const response = await fetch(`/api/fusion/sentiment?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sentiment data');
      }
      const result = await response.json();
      return result.data as SentimentData[];
    },
    refetchInterval: 30 * 60 * 1000, // Refresh every 30 minutes
  });

  const { data: aggregatedData } = useQuery({
    queryKey: [`/api/fusion/sentiment/aggregate`],
    queryFn: async () => {
      const response = await fetch(`/api/fusion/sentiment/aggregate?days=7`);
      if (!response.ok) throw new Error('Failed to fetch aggregated sentiment');
      const result = await response.json();
      return result.data as { date: string; score: number; volume: number }[];
    },
    enabled: showSparkline,
  });

  const getSentimentIcon = (score: number) => {
    if (score > 0.1) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (score < -0.1) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getSentimentLabel = (score: number) => {
    if (score > 0.3) return "Very Positive";
    if (score > 0.1) return "Positive";
    if (score > -0.1) return "Neutral";
    if (score > -0.3) return "Negative";
    return "Very Negative";
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.1) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    if (score < -0.1) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  };

  const currentSentiment = sentimentData?.[0];
  const averageScore = sentimentData?.reduce((sum, item) => sum + item.score, 0) / (sentimentData?.length || 1) || 0;
  const totalMentions = sentimentData?.reduce((sum, item) => sum + (item.metadata.total_mentions || 0), 0) || 0;

  if (isLoading) {
    return (
      <Card data-testid="sentiment-indicator-loading" className={compact ? "p-4" : ""}>
        {!compact && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Market Sentiment
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={compact ? "p-0" : ""}>
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !sentimentData) {
    return (
      <Card data-testid="sentiment-indicator-error" className={compact ? "p-4" : ""}>
        {!compact && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Market Sentiment
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={compact ? "p-0" : ""}>
          <p className="text-sm text-muted-foreground">
            Sentiment data unavailable
          </p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2" data-testid="sentiment-indicator-compact">
        {getSentimentIcon(averageScore)}
        <Badge className={`text-xs ${getSentimentColor(averageScore)}`}>
          {getSentimentLabel(averageScore)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {totalMentions.toLocaleString()} mentions
        </span>
      </div>
    );
  }

  return (
    <Card data-testid="sentiment-indicator">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Market Sentiment
          {token && (
            <Badge variant="secondary" className="ml-2">
              {token}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Social media and news sentiment analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getSentimentIcon(averageScore)}
              <span className="font-medium">{getSentimentLabel(averageScore)}</span>
            </div>
            <Badge className={getSentimentColor(averageScore)}>
              {(averageScore * 100).toFixed(1)}%
            </Badge>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {totalMentions.toLocaleString()} total mentions across platforms
          </div>

          {showSparkline && aggregatedData && aggregatedData.length > 0 && (
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aggregatedData}>
                  <XAxis 
                    dataKey="date" 
                    hide 
                  />
                  <YAxis hide domain={[-1, 1]} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Sentiment']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {currentSentiment?.metadata.trending_keywords && (
            <div>
              <p className="text-xs font-medium mb-2">Trending Keywords:</p>
              <div className="flex flex-wrap gap-1">
                {currentSentiment.metadata.trending_keywords.slice(0, 4).map((keyword, index) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="text-xs"
                    data-testid={`trending-keyword-${index}`}
                  >
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}