import { AlertTriangle, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SafetyBannerProps {
  breakers?: {
    apiQuotaExceeded?: boolean;
    wsStale?: boolean;
    backtestFailRate?: boolean;
    submitLatency?: boolean;
  };
}

export function SafetyBanner({ breakers = {} }: SafetyBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const hasIssues = Object.values(breakers).some(Boolean);

  useEffect(() => {
    if (hasIssues) setDismissed(false);
  }, [hasIssues]);

  if (!hasIssues || dismissed) return null;

  const messages = [];
  if (breakers.apiQuotaExceeded) messages.push("API quota exceeded");
  if (breakers.wsStale) messages.push("WebSocket connection stale");
  if (breakers.backtestFailRate) messages.push("High backtest failure rate");
  if (breakers.submitLatency) messages.push("High submit latency");

  return (
    <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950" data-testid="safety-banner">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-orange-800 dark:text-orange-200">
          System issues detected: {messages.join(", ")}
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="text-orange-600 hover:text-orange-800"
          data-testid="button-dismiss-banner"
        >
          <X className="h-4 w-4" />
        </button>
      </AlertDescription>
    </Alert>
  );
}