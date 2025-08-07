import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, TrendingUp, Clock, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface SimilarResult {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, any>;
  timestamp: string;
  similarity: number;
}

interface FindSimilarButtonProps {
  recordId: string;
  recordType: 'trade' | 'signal' | 'backtest';
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function FindSimilarButton({ 
  recordId, 
  recordType, 
  variant = "outline", 
  size = "sm" 
}: FindSimilarButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: similarResults, isLoading, error } = useQuery({
    queryKey: [`/api/vector/similar`, recordId],
    queryFn: async () => {
      const response = await fetch(`/api/vector/similar?id=${recordId}&k=5`);
      if (!response.ok) {
        throw new Error('Failed to fetch similar records');
      }
      const result = await response.json();
      return result.data as SimilarResult[];
    },
    enabled: isOpen, // Only fetch when dialog is open
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'trade':
        return <TrendingUp className="h-4 w-4" />;
      case 'signal':
        return <Activity className="h-4 w-4" />;
      case 'backtest':
        return <Clock className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity > 0.8) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    if (similarity > 0.6) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    if (similarity > 0.4) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          data-testid={`button-find-similar-${recordId}`}
        >
          <Search className="h-4 w-4 mr-2" />
          Find Similar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Similar {recordType}s to {recordId}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-muted-foreground">Finding similar records...</span>
            </div>
          )}
          
          {error && (
            <div className="text-center py-8">
              <p className="text-sm text-red-600 dark:text-red-400">
                Failed to find similar records. Please try again.
              </p>
            </div>
          )}
          
          {similarResults && similarResults.length === 0 && (
            <div className="text-center py-8">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                No similar records found for this {recordType}.
              </p>
            </div>
          )}
          
          {similarResults && similarResults.length > 0 && (
            <div className="space-y-4">
              {similarResults.map((result, index) => (
                <div 
                  key={result.id} 
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  data-testid={`similar-result-${index}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(result.type)}
                      <span className="font-medium text-sm">{result.id}</span>
                      <Badge variant="secondary" className="text-xs">
                        {result.type}
                      </Badge>
                    </div>
                    <Badge 
                      className={`text-xs ${getSimilarityColor(result.similarity)}`}
                      data-testid={`similarity-${index}`}
                    >
                      {(result.similarity * 100).toFixed(1)}% similar
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {result.content}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatTimestamp(result.timestamp)}</span>
                    {result.metadata && Object.keys(result.metadata).length > 0 && (
                      <div className="flex gap-2">
                        {result.metadata.symbol && (
                          <Badge variant="outline" className="text-xs">
                            {result.metadata.symbol}
                          </Badge>
                        )}
                        {result.metadata.side && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              result.metadata.side === 'buy' 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {result.metadata.side}
                          </Badge>
                        )}
                        {result.metadata.price && (
                          <span className="text-xs">
                            ${Number(result.metadata.price).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}