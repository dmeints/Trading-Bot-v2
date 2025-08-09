import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";

export default function Health() {
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await fetch("/api/health")).json(),
    refetchInterval: 30_000,
  });
  if (!data) return <div className="p-4">Loading health…</div>;
  const { slo } = data;
  const Row = ({ k, v }:{k:string; v:string|number}) => (
    <div className="flex items-center justify-between py-1"><span className="text-sm opacity-80">{k}</span><span className="font-mono">{v}</span></div>
  );
  return (
    <div className="grid gap-4 p-4 md:grid-cols-2">
      <Card className="p-4"><h3 className="font-semibold mb-2">Submit→ACK (ms)</h3>
        <Row k="p50" v={slo.submitAckMs.p50} /><Row k="p95" v={slo.submitAckMs.p95} /><Row k="p99" v={slo.submitAckMs.p99} />
      </Card>
      <Card className="p-4"><h3 className="font-semibold mb-2">WS Staleness (ms)</h3>
        <Row k="p50" v={slo.wsStalenessMs.p50} /><Row k="p95" v={slo.wsStalenessMs.p95} /><Row k="p99" v={slo.wsStalenessMs.p99} />
      </Card>
      <Card className="p-4"><h3 className="font-semibold mb-2">Backtests</h3>
        <Row k="Success rate" v={(slo.backtestSuccessRate*100).toFixed(1)+"%"} />
        <Row k="Error budget (24h)" v={(slo.errorBudgetBurn24h*100).toFixed(1)+"%"} />
      </Card>
      <Card className="p-4"><h3 className="font-semibold mb-2">API Quotas</h3>
        <Row k="X" v={`${slo.apiQuota.x.used}/${slo.apiQuota.x.limit}`} />
        <Row k="CoinGecko" v={`${slo.apiQuota.coingecko.used}/${slo.apiQuota.coingecko.limit}`} />
      </Card>
    </div>
  );
}