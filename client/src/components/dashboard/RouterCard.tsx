
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

interface RouterSnapshot {
  policyId: string;
  score: number;
  explorationBonus: number;
  confidence: number;
}

export const RouterCard: React.FC = () => {
  const [snapshot, setSnapshot] = useState<RouterSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSnapshot = async () => {
      try {
        const response = await fetch('/api/router/snapshot');
        if (response.ok) {
          const data = await response.json();
          setSnapshot(data);
        }
      } catch (error) {
        console.error('Failed to fetch router snapshot:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Strategy Router</CardTitle>
          <CardDescription>Current policy selection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategy Router</CardTitle>
        <CardDescription>Current policy selection</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {snapshot ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Active Policy</span>
              <Badge variant="default">{snapshot.policyId}</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Score</span>
              <span className="font-mono text-sm">
                {snapshot.score.toFixed(4)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Exploration</span>
              <span className="font-mono text-sm">
                {snapshot.explorationBonus.toFixed(4)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Confidence</span>
              <div className="flex items-center space-x-2">
                <div className="w-12 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${(snapshot.confidence || 0) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-xs">
                  {((snapshot.confidence || 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">No data available</div>
        )}
      </CardContent>
    </Card>
  );
};
