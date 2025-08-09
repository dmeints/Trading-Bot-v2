import { useState } from 'react';
import { Link } from 'wouter';
import QuotePanel from '@/components/trade/QuotePanel';
import OrderTicket from '@/components/trade/OrderTicket';
import PositionsTable from '@/components/portfolio/PositionsTable';
import FillsTable from '@/components/portfolio/FillsTable';
import EquitySpark from '@/components/portfolio/EquitySpark';
import RiskControls from '@/components/risk/RiskControls';

export default function Trading() {
  const [tab, setTab] = useState<'trade'|'portfolio'|'risk'>('trade');
  return (
    <div className=p-4 max-w-6xl mx-auto space-y-4>
      <div className=flex items-center justify-between>
        <h1 className=text-2xl font-semibold>SKIPPY Trading</h1>
        <Link href=/health className=underline>Health</Link>
      </div>
      <div className=inline-flex rounded-2xl shadow overflow-hidden>
        {['trade','portfolio','risk'].map(k => (
          <button key={k} onClick={() => setTab(k as any)} className={}>{k}</button>
        ))}
      </div>
      {tab === 'trade' && (
        <div className=grid md:grid-cols-2 gap-4>
          <QuotePanel />
          <OrderTicket />
        </div>
      )}
      {tab === 'portfolio' && (
        <div className=grid gap-4>
          <div className=grid md:grid-cols-2 gap-4>
            <PositionsTable />
            <FillsTable />
          </div>
          <EquitySpark />
        </div>
      )}
      {tab === 'risk' && <RiskControls />}
    </div>
  );
}
