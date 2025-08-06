/**
 * Admin Gate Component
 * 
 * Protects admin-only routes and components based on authentication status
 */

import { useQuery } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminGateProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface AuthStatus {
  authenticated: boolean;
  user?: any;
  isAdmin?: boolean;
}

export function AdminGate({ children, fallback }: AdminGateProps) {
  const { data: authStatus, isLoading, error } = useQuery<AuthStatus>({
    queryKey: ['/api/me'],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !authStatus?.authenticated) {
    return (
      fallback ?? (
        <Alert variant="destructive">
          <AlertDescription>
            Authentication required. Please log in to access this area.
          </AlertDescription>
        </Alert>
      )
    );
  }

  if (!authStatus.isAdmin) {
    return (
      fallback ?? (
        <Alert variant="destructive">
          <AlertDescription>
            Admin access required. You don't have permission to view this content.
          </AlertDescription>
        </Alert>
      )
    );
  }

  return <>{children}</>;
}