import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

type ExplainProps = {
  open: boolean; onOpenChange: (o:boolean)=>void;
  metric: "sharpe"|"sortino"|"winRate"|"profitFactor"|"maxDrawdown"|"returnPct";
  value?: number;
  inputs: { window:{ fromIso:string; toIso:string; timeframe:string; symbols:string[] }; feesBps:number; slipBps:number; rngSeed:number; };
  provenance: { datasetId?: string; runId?: string; commit: string; generatedAt: string };
};

const formulas: Record<ExplainProps["metric"], string> = {
  sharpe: "Sharpe = mean(excess returns) / std(excess returns) × √periods",
  sortino: "Sortino = mean(excess returns) / std(negative returns) × √periods",
  winRate: "Win Rate = winning trades / total trades",
  profitFactor: "Profit Factor = gross profit / gross loss",
  maxDrawdown: "Max DD = max(peak - trough) / peak / over equity curve",
  returnPct: "Return % = (final equity - initial equity) / initial equity × 100",
};

export function ExplainMetricDrawer({ open, onOpenChange, metric, value, inputs, provenance }: ExplainProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>About {metric}</DrawerTitle></DrawerHeader>
        <div className="p-4 space-y-3">
          <div><strong>Formula:</strong> {formulas[metric]}</div>
          <div><strong>Value:</strong> {value ?? "unknown"}</div>
          <div className="text-sm opacity-80">
            <div><strong>Window:</strong> {inputs.window.fromIso} → {inputs.window.toIso} ({inputs.window.timeframe})</div>
            <div><strong>Symbols:</strong> {inputs.window.symbols.join(", ")}</div>
            <div><strong>Fees/Slippage:</strong> {inputs.feesBps} / {inputs.slipBps} bps</div>
            <div><strong>RNG Seed:</strong> {inputs.rngSeed}</div>
          </div>
          <div className="text-sm">
            <strong>Provenance</strong>
            <div>datasetId: {provenance.datasetId ?? "none"}</div>
            <div>runId: {provenance.runId ?? "none"}</div>
            <div>commit: {provenance.commit}</div>
            <div>generatedAt: {provenance.generatedAt}</div>
          </div>
          <button className="btn btn-primary mt-2" onClick={() => { window.location.href = `/bench?rerun=${provenance.runId ?? ""}`; }}>
            Re-run identical test
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}