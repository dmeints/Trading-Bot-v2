import { useSystemStore } from "@/state/systemStore";
import { useMemo } from "react";

export function SafetyBanner() {
  const { breakerActive, reason, since, details } = useSystemStore();
  const sinceText = useMemo(() => (since ? new Date(since).toLocaleTimeString() : ""), [since]);
  if (!breakerActive) return null;
  const label =
    reason === "stale_quotes" ? "Data feed is stale" :
    reason === "high_latency" ? "Latency too high" :
    reason === "slippage_breach" ? "Slippage too high" :
    reason === "manual_kill" ? "Kill-switch engaged" :
    "Trading paused";
  return (
    <div className="w-full bg-yellow-100 border-b border-yellow-300 text-yellow-900 px-3 py-2 text-sm">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="font-medium">⚠ {label}. Submissions are blocked.</div>
        <div className="opacity-75">{sinceText && <span>since {sinceText}</span>}{details && <span className="ml-2">{details}</span>}</div>
      </div>
    </div>
  );
}