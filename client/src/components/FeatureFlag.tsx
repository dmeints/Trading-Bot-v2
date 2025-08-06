/**
 * Feature Flag Component
 * 
 * Conditionally renders content based on feature flags from the server
 */

import { useQuery } from '@tanstack/react-query';
import { ReactNode } from 'react';

interface FeatureFlagProps {
  feature: 'backtest' | 'trading' | 'aiServices';
  children: ReactNode;
  fallback?: ReactNode;
}

interface VersionInfo {
  name: string;
  version: string;
  nodeEnv: string;
  features: {
    backtest: boolean;
    trading: boolean;
    aiServices: boolean;
  };
}

export function FeatureFlag({ feature, children, fallback = null }: FeatureFlagProps) {
  const { data: versionInfo } = useQuery<VersionInfo>({
    queryKey: ['/api/version'],
    staleTime: 60000, // Cache for 1 minute
  });

  const isFeatureEnabled = versionInfo?.features[feature] ?? false;

  return isFeatureEnabled ? <>{children}</> : <>{fallback}</>;
}