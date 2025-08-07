import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from './useAuth';

interface ExperimentVariant {
  id: string;
  name: string;
  config: Record<string, any>;
  weight: number;
}

interface Experiment {
  id: string;
  name: string;
  description?: string;
  variants: ExperimentVariant[];
  isActive: boolean;
  trafficAllocation: number;
}

interface ExperimentAssignment {
  experimentId: string;
  variant: string;
  assignedAt: string;
}

export function useExperiment(experimentName: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get user's experiment assignment
  const { data: assignment, isLoading } = useQuery({
    queryKey: ['/api/experiments/assignment', experimentName],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Track experiment event mutation
  const trackEventMutation = useMutation({
    mutationFn: async ({ eventType, eventData }: { eventType: string; eventData?: Record<string, any> }) => {
      return await apiRequest('/api/experiments/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experimentName,
          eventType,
          eventData,
        }),
      });
    },
  });

  const getVariant = (defaultVariant: string = 'control'): string => {
    if (isLoading || !assignment) return defaultVariant;
    return assignment?.variant || defaultVariant;
  };

  const isVariant = (variantName: string): boolean => {
    return getVariant() === variantName;
  };

  const trackEvent = (eventType: string, eventData?: Record<string, any>) => {
    if (!user) return;
    trackEventMutation.mutate({ eventType, eventData });
  };

  return {
    getVariant,
    isVariant,
    trackEvent,
    isLoading,
    assignment,
  };
}

export function useExperimentList() {
  const { data: experiments, isLoading } = useQuery({
    queryKey: ['/api/experiments'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return { experiments: experiments || [], isLoading };
}

export function useExperimentMetrics(experimentId: string) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['/api/experiments/metrics', experimentId],
    enabled: !!experimentId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return { metrics, isLoading };
}