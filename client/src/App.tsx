import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { Suspense, lazy } from "react";
import { IntlProvider } from "@/providers/IntlProvider";
import { SkipLink } from "@/components/accessibility/SkipLink";
import { LiveRegion } from "@/components/accessibility/LiveRegion";

// Lazy load pages for better performance
const Landing = lazy(() => import("@/pages/landing"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Trading = lazy(() => import("@/pages/trading"));
const Portfolio = lazy(() => import("@/pages/portfolio"));
const Settings = lazy(() => import("@/pages/settings"));
const Analytics = lazy(() => import("@/pages/analytics"));
const AIInsights = lazy(() => import("@/pages/AIInsights"));
const AIChat = lazy(() => import("@/pages/AIChat"));
const AdvancedStrategies = lazy(() => import("@/pages/AdvancedStrategies"));
const MLOpsDashboard = lazy(() => import("@/pages/MLOpsDashboard"));
const RLTraining = lazy(() => import("@/pages/RLTraining"));
const PluginMarketplace = lazy(() => import("@/pages/PluginMarketplace"));
const StrategyBuilder = lazy(() => import("@/pages/StrategyBuilderPage"));
const LayoutCustomization = lazy(() => import("@/pages/LayoutCustomizationPage"));
const ServiceLevelPage = lazy(() => import("@/pages/ServiceLevelPage"));
const StevieHome = lazy(() => import("@/pages/StevieHome"));
const SimulationStudio = lazy(() => import("@/pages/SimulationStudio"));
const TradeJournal = lazy(() => import("@/pages/TradeJournal"));
const RevolutionaryDashboard = lazy(() => import("@/pages/RevolutionaryDashboard"));
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
            <Route path="/health" component={lazy(() => import("@/routes/Health"))} />
            <Route path="/portfolio" component={Portfolio} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/ai-insights" component={AIInsights} />
            <Route path="/ai-chat" component={AIChat} />
            <Route path="/advanced-strategies" component={AdvancedStrategies} />
            <Route path="/mlops" component={MLOpsDashboard} />
            <Route path="/rl-training" component={RLTraining} />
            <Route path="/plugins" component={PluginMarketplace} />
            <Route path="/strategy-builder" component={StrategyBuilder} />
            <Route path="/customization" component={LayoutCustomization} />
            <Route path="/service-level" component={ServiceLevelPage} />
            <Route path="/stevie" component={StevieHome} />
            <Route path="/simulation" component={SimulationStudio} />
            <Route path="/journal" component={TradeJournal} />
            <Route path="/revolutionary" component={RevolutionaryDashboard} />
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
        <IntlProvider>
          <SkipLink />
          <LiveRegion message="" />
          <Toaster />
          <Router />
        </IntlProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
