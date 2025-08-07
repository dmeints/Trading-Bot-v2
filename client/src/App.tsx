import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { Suspense, lazy } from "react";

// Lazy load pages for better performance
const Landing = lazy(() => import("@/pages/landing"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Trading = lazy(() => import("@/pages/trading"));
const Portfolio = lazy(() => import("@/pages/portfolio"));
const Settings = lazy(() => import("@/pages/settings"));
const Analytics = lazy(() => import("@/pages/analytics"));
const AIInsights = lazy(() => import("@/pages/AIInsights"));
const MLOpsDashboard = lazy(() => import("@/pages/MLOpsDashboard"));
const NotFound = lazy(() => import("@/pages/not-found"));

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    }>
      <Switch>
        {!isAuthenticated ? (
          <Route path="/" component={Landing} />
        ) : (
          <>
            <Route path="/" component={Dashboard} />
            <Route path="/trading" component={Trading} />
            <Route path="/portfolio" component={Portfolio} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/ai-insights" component={AIInsights} />
            <Route path="/mlops" component={MLOpsDashboard} />
            <Route path="/settings" component={Settings} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
