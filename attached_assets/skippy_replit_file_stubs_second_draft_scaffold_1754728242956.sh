#!/usr/bin/env bash
# skippy_scaffold.sh — Non-destructive scaffold for Trading UI, Health dashboard, and server routes/services.
# Usage: bash skippy_scaffold.sh
# Notes:
#  - Creates missing files only (won't overwrite existing ones).
#  - Assumes monorepo dirs: ./client and ./server. Adjust BASE_* if different.
#  - All TODOs are marked clearly.

set -euo pipefail

BASE_CLIENT="client"
BASE_SERVER="server"

# --- Helpers ---------------------------------------------------------------
mkfile() {
  local path="$1"; shift
  local content="$*"
  if [ -f "$path" ]; then
    echo "skip  $path (exists)"
  else
    mkdir -p "$(dirname "$path")"
    printf "%s" "$content" > "$path"
    echo "create $path"
  fi
}

# --- Frontend --------------------------------------------------------------
# Routes & components per Second Draft

mkfile "$BASE_CLIENT/src/routes/Trading.tsx" "import { useState } from 'react';
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
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">SKIPPY Trading</h1>
        <Link href="/health" className="underline">Health</Link>
      </div>
      <div className="inline-flex rounded-2xl shadow overflow-hidden">
        {['trade','portfolio','risk'].map(k => (
          <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 text-sm ${tab===k? 'bg-black text-white':'bg-white'}`}>{k}</button>
        ))}
      </div>
      {tab === 'trade' && (
        <div className="grid md:grid-cols-2 gap-4">
          <QuotePanel />
          <OrderTicket />
        </div>
      )}
      {tab === 'portfolio' && (
        <div className="grid gap-4">
          <div className="grid md:grid-cols-2 gap-4">
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
"

mkfile "$BASE_CLIENT/src/routes/Health.tsx" "import { useHealth } from '@/api/health';

export default function Health() {
  const { data, isLoading, refetch } = useHealth();
  if (isLoading) return <div className='p-4'>Loading health…</div>;
  if (!data) return <div className='p-4'>No health data.</div>;
  const c = data.components;
  const m = data.metrics;
  return (
    <div className='p-4 max-w-6xl mx-auto space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold'>System Health</h1>
        <button onClick={() => refetch()} className='px-3 py-1 rounded bg-black text-white'>Refresh</button>
      </div>
      <div className='grid md:grid-cols-3 gap-4'>
        <Card title='DB' value={c?.db} />
        <Card title='WebSocket' value={c?.websocket?.status} sub={`age ${c?.websocket?.lastMessageAgoMs}ms`} />
        <Card title='Jobs' value={`${c?.jobs?.running} running`} sub={`${c?.jobs?.queued} queued`} />
      </div>
      <section>
        <h2 className='text-lg font-medium mb-2'>Latency & Quality</h2>
        <pre className='bg-gray-100 p-3 rounded overflow-auto text-xs'>
{JSON.stringify(m, null, 2)}
        </pre>
      </section>
    </div>
  );
}
function Card({title, value, sub}:{title:string; value:any; sub?:string}){
  return (
    <div className='rounded-2xl border p-4 shadow-sm'>
      <div className='text-sm text-gray-500'>{title}</div>
      <div className='text-xl font-semibold'>{String(value)}</div>
      {sub && <div className='text-xs text-gray-500 mt-1'>{sub}</div>}
    </div>
  );
}
"

# Trade components
mkfile "$BASE_CLIENT/src/components/trade/QuotePanel.tsx" "import { useEffect, useState } from 'react';
import { useQuotes } from '@/lib/ws';

export default function QuotePanel(){
  const [symbol, setSymbol] = useState('BTCUSDT');
  const quote = useQuotes(symbol);
  return (
    <div className='rounded-2xl border p-4 space-y-3'>
      <div className='flex items-center justify-between'>
        <h2 className='font-semibold'>Quotes</h2>
        <select value={symbol} onChange={e=>setSymbol(e.target.value)} className='border rounded px-2 py-1'>
          {['BTCUSDT','ETHUSDT','SOLUSDT'].map(s=> <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className='grid grid-cols-3 gap-2 text-center'>
        <KV label='Bid' value={fmt(quote?.bid)} />
        <KV label='Ask' value={fmt(quote?.ask)} />
        <KV label='Last' value={fmt(quote?.last)} />
      </div>
      <div className='text-xs text-gray-500'>WS age: {quote? (Date.now()-quote.ts)+'ms' : '—'}</div>
    </div>
  );
}
function KV({label,value}:{label:string;value:any}){
  return <div className='rounded-xl border p-3'><div className='text-xs text-gray-500'>{label}</div><div className='text-lg font-semibold'>{value ?? '—'}</div></div>
}
function fmt(n?:number){ return n!=null? n.toLocaleString(): undefined }
"

mkfile "$BASE_CLIENT/src/components/trade/OrderTicket.tsx" "import { useMutation } from '@tanstack/react-query';
import { placeOrder } from '@/api/trading';
import { useState } from 'react';

export default function OrderTicket(){
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [side, setSide] = useState<'buy'|'sell'>('buy');
  const [type, setType] = useState<'market'|'limit'|'limit_maker'|'ioc'|'fok'>('market');
  const [qty, setQty] = useState(0.001);
  const [price, setPrice] = useState<number|''>('');
  const [tp, setTp] = useState<number|''>('');
  const [sl, setSl] = useState<number|''>('');
  const m = useMutation({ mutationFn: placeOrder });

  const submit = (e:React.FormEvent)=>{
    e.preventDefault();
    m.mutate({ symbol, side, type, quantity: Number(qty), price: price===''? undefined : Number(price), bracket: { takeProfitPct: tp===''? undefined : Number(tp), stopLossPct: sl===''? undefined : Number(sl), reduceOnly: true } });
  };

  return (
    <form onSubmit={submit} className='rounded-2xl border p-4 space-y-3'>
      <h2 className='font-semibold'>Order Ticket</h2>
      <Row label='Symbol'>
        <select value={symbol} onChange={e=>setSymbol(e.target.value)} className='border rounded px-2 py-1'>
          {['BTCUSDT','ETHUSDT','SOLUSDT'].map(s=> <option key={s} value={s}>{s}</option>)}
        </select>
      </Row>
      <Row label='Side'>
        <div className='inline-flex rounded-xl overflow-hidden border'>
          {(['buy','sell'] as const).map(v=> (
            <button key={v} type='button' onClick={()=>setSide(v)} className={`px-4 py-1 ${side===v?'bg-black text-white':''}`}>{v}</button>
          ))}
        </div>
      </Row>
      <Row label='Type'>
        <select value={type} onChange={e=>setType(e.target.value as any)} className='border rounded px-2 py-1'>
          <option value='market'>Market</option>
          <option value='limit'>Limit</option>
          <option value='limit_maker'>Post Only</option>
          <option value='ioc'>IOC</option>
          <option value='fok'>FOK</option>
        </select>
      </Row>
      <Row label='Quantity'>
        <input value={qty} onChange={e=>setQty(Number(e.target.value))} type='number' step='any' className='border rounded px-2 py-1 w-full' />
      </Row>
      {(type==='limit' || type==='limit_maker') && (
        <Row label='Limit Price'>
          <input value={price} onChange={e=>setPrice(e.target.value===''?'':Number(e.target.value))} type='number' step='any' className='border rounded px-2 py-1 w-full' />
        </Row>
      )}
      <div className='grid grid-cols-2 gap-3'>
        <Row label='TP %'>
          <input value={tp} onChange={e=>setTp(e.target.value===''?'':Number(e.target.value))} type='number' step='any' className='border rounded px-2 py-1 w-full' />
        </Row>
        <Row label='SL %'>
          <input value={sl} onChange={e=>setSl(e.target.value===''?'':Number(e.target.value))} type='number' step='any' className='border rounded px-2 py-1 w-full' />
        </Row>
      </div>
      <button disabled={m.isPending} className='w-full rounded-xl py-2 bg-black text-white'>
        {m.isPending? 'Placing…' : 'Submit'}
      </button>
      {m.error && <div className='text-sm text-red-600'>{(m.error as any)?.message ?? 'Order failed'}</div>}
      {m.data && <div className='text-sm text-green-700'>Order {m.data.orderId} {m.data.status}</div>}
    </form>
  );
}
function Row({label, children}:{label:string; children:React.ReactNode}){
  return <label className='grid gap-1 text-sm'>
    <span className='text-gray-500'>{label}</span>
    {children}
  </label>;
}
"

# Portfolio components
mkfile "$BASE_CLIENT/src/components/portfolio/PositionsTable.tsx" "import { usePositions } from '@/api/trading';
export default function PositionsTable(){
  const { data } = usePositions();
  return (
    <div className='rounded-2xl border p-4'>
      <h2 className='font-semibold mb-2'>Positions</h2>
      <table className='w-full text-sm'>
        <thead><tr className='text-left'><th>Symbol</th><th>Qty</th><th>Avg</th><th>U-PnL</th><th>R-PnL</th></tr></thead>
        <tbody>
          {(data??[]).map((p:any)=> (
            <tr key={p.symbol} className='border-t'>
              <td>{p.symbol}</td><td>{p.quantity}</td><td>{p.avgPrice}</td><td>{p.unrealizedPnl}</td><td>{p.realizedPnl}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
"

mkfile "$BASE_CLIENT/src/components/portfolio/FillsTable.tsx" "import { useFills } from '@/api/trading';
export default function FillsTable(){
  const { data } = useFills();
  return (
    <div className='rounded-2xl border p-4'>
      <h2 className='font-semibold mb-2'>Recent Fills</h2>
      <table className='w-full text-sm'>
        <thead><tr className='text-left'><th>Time</th><th>Symbol</th><th>Side</th><th>Price</th><th>Qty</th></tr></thead>
        <tbody>
          {(data??[]).map((f:any)=> (
            <tr key={f.id} className='border-t'>
              <td>{new Date(f.timestamp).toLocaleString()}</td><td>{f.symbol}</td><td>{f.side}</td><td>{f.price}</td><td>{f.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
"

mkfile "$BASE_CLIENT/src/components/portfolio/EquitySpark.tsx" "import { useAccount } from '@/api/trading';
export default function EquitySpark(){
  const { data } = useAccount();
  return (
    <div className='rounded-2xl border p-4'>
      <h2 className='font-semibold mb-2'>Equity</h2>
      <div className='text-2xl'>{data?.equity?.toLocaleString?.() ?? '—'}</div>
      <div className='text-xs text-gray-500'>Balance: {data?.cash?.toLocaleString?.() ?? '—'}</div>
      {/* TODO: replace with real sparkline */}
      <div className='mt-3 text-xs text-gray-500'>Sparkline placeholder</div>
    </div>
  );
}
"

# Risk
mkfile "$BASE_CLIENT/src/components/risk/RiskControls.tsx" "import { saveRisk, useRisk } from '@/api/trading';
import { useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

export default function RiskControls(){
  const { data } = useRisk();
  const [form, setForm] = useState({ maxPositionSizePct: 25, maxDailyLoss: 5, defaultStopPct: 0.25, defaultTakeProfitPct: 0.5, killSwitch: false });
  const m = useMutation({ mutationFn: saveRisk });
  useEffect(()=>{ if (data) setForm(prev=>({ ...prev, ...data })); }, [data]);
  const up = (k:keyof typeof form, v:any)=> setForm(s=>({ ...s, [k]: v }));
  return (
    <div className='rounded-2xl border p-4 space-y-3'>
      <h2 className='font-semibold'>Risk Controls</h2>
      {Object.entries(form).map(([k,v])=> (
        <label key={k} className='grid gap-1 text-sm'>
          <span className='text-gray-500'>{k}</span>
          {typeof v === 'boolean' ? (
            <input type='checkbox' checked={v} onChange={e=>up(k as any, e.target.checked)} />
          ) : (
            <input type='number' step='any' value={v as any} onChange={e=>up(k as any, Number(e.target.value))} className='border rounded px-2 py-1 w-full' />
          )}
        </label>
      ))}
      <button onClick={()=>m.mutate(form)} className='rounded-xl bg-black text-white px-4 py-2' disabled={m.isPending}>Save</button>
      {m.data && <div className='text-sm text-green-700'>Saved.</div>}
    </div>
  );
}
"

# State & API helpers
mkfile "$BASE_CLIENT/src/state/tradingStore.ts" "import create from 'zustand';

type TradingState = { symbol: string; setSymbol: (s:string)=>void };
export const useTradingStore = create<TradingState>((set)=>({ symbol: 'BTCUSDT', setSymbol: (s)=>set({symbol:s}) }));
"

mkfile "$BASE_CLIENT/src/api/trading.ts" "import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const usePositions = ()=> useQuery({ queryKey:['positions'], queryFn: async()=> fetch('/api/trading/positions').then(r=>r.json()), refetchInterval: 5000 });
export const useFills = ()=> useQuery({ queryKey:['fills'], queryFn: async()=> fetch('/api/trading/fills?limit=100').then(r=>r.json()), refetchInterval: 5000 });
export const useAccount = ()=> useQuery({ queryKey:['account'], queryFn: async()=> fetch('/api/trading/account').then(r=>r.json()), refetchInterval: 5000 });
export const useRisk = ()=> useQuery({ queryKey:['risk'], queryFn: async()=> fetch('/api/trading/risk').then(r=>r.json()) });

export async function placeOrder(body: any){
  const r = await fetch('/api/trading/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export async function saveRisk(body:any){
  const r = await fetch('/api/trading/risk', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
"

mkfile "$BASE_CLIENT/src/api/health.ts" "import { useQuery } from '@tanstack/react-query';
export const useHealth = ()=> useQuery({ queryKey:['health'], queryFn: async()=> fetch('/api/health').then(r=>r.json()), refetchInterval: 30000 });
"

mkfile "$BASE_CLIENT/src/lib/ws.ts" "import { useEffect, useRef, useState } from 'react';

type Quote = { type:'quote'; symbol:string; bid:number; ask:number; last:number; ts:number };

export function useQuotes(symbol:string){
  const [quote, setQuote] = useState<Quote|undefined>();
  const wsRef = useRef<WebSocket|null>(null);
  useEffect(()=>{
    let cancelled = false;
    function connect(){
      const ws = new WebSocket((location.protocol==='https:'?'wss':'ws')+'://'+location.host+'/ws');
      wsRef.current = ws;
      ws.onopen = ()=> ws.send(JSON.stringify({ type:'subscribe', symbols:[symbol] }));
      ws.onmessage = (ev)=>{
        const msg = JSON.parse(ev.data);
        if (msg.type==='quote' && msg.symbol===symbol) setQuote(msg);
      };
      ws.onclose = ()=>{ if (!cancelled) setTimeout(connect, 1000 + Math.random()*1000); };
    }
    connect();
    return ()=>{ cancelled = true; wsRef.current?.close(); };
  }, [symbol]);
  return quote;
}
"

# --- Backend ---------------------------------------------------------------
mkfile "$BASE_SERVER/src/types/trading.ts" "export type Side = 'buy'|'sell';
export type OrderType = 'market'|'limit'|'limit_maker'|'ioc'|'fok';
export interface OrderRequest { symbol:string; side:Side; type:OrderType; quantity:number; price?:number; tif?: 'GTC'|'IOC'|'FOK'; clientId?:string; bracket?: { takeProfitPct?:number; stopLossPct?:number; reduceOnly?:boolean }; }
export interface OrderAck { orderId:string; status:'accepted'|'rejected'; reason?:string }
export interface Position { symbol:string; quantity:number; avgPrice:number; unrealizedPnl:number; realizedPnl:number }
export interface Fill { id:string; symbol:string; side:Side; price:number; quantity:number; timestamp:string }
export interface Account { equity:number; cash:number; maintenanceMargin:number }
export interface RiskSettings { maxPositionSizePct?:number; maxDailyLoss?:number; defaultStopPct?:number; defaultTakeProfitPct?:number; killSwitch?:boolean; symbolTiers?: Record<string, { maxSizePct:number }>; }
"

mkfile "$BASE_SERVER/src/routes/trading.ts" "import { Router } from 'express';
import type { OrderRequest, OrderAck, Position, Fill, Account, RiskSettings } from '../types/trading';
import * as execution from '../services/execution';
import * as risk from '../services/risk';

const r = Router();

r.post('/orders', async (req, res) => {
  try {
    const ack: OrderAck = await execution.placeOrder(req.body as OrderRequest);
    res.json(ack);
  } catch (e:any) {
    res.status(400).send(e?.message ?? 'order rejected');
  }
});

r.delete('/orders/:orderId', async (req, res) => {
  const ok = await execution.cancelOrder(req.params.orderId);
  res.json({ orderId: req.params.orderId, status: ok? 'canceled':'not_found' });
});

r.get('/positions', async (_req, res) => {
  const rows: Position[] = await execution.getPositions();
  res.json(rows);
});

r.get('/fills', async (req, res) => {
  const limit = Number(req.query.limit ?? 100);
  const rows: Fill[] = await execution.getFills(limit);
  res.json(rows);
});

r.get('/account', async (_req, res) => {
  const acct: Account = await execution.getAccount();
  res.json(acct);
});

r.get('/risk', async (_req, res)=>{ res.json(await risk.getRisk()); });

r.post('/risk', async (req, res)=>{ await risk.setRisk(req.body as RiskSettings); res.json({ saved: true }); });

export default r;
"

mkfile "$BASE_SERVER/src/routes/health.ts" "import { Router } from 'express';
import * as metrics from '../services/metrics';
import * as quotes from '../services/quotes';

const r = Router();

r.get('/', async (_req, res)=>{
  // TODO: wire actual checks (DB ping, queues, quotas)
  const status = 'ok' as const;
  const websocket = { status: quotes.isHealthy()? 'ok':'degraded', lastMessageAgoMs: quotes.lastAgeMs() };
  res.json({
    status,
    components: {
      db: 'ok',
      websocket,
      marketData: { binance: 'ok', coingecko: 'ok' },
      apiQuotas: { x:{used:0,limit:100}, reddit:{used:0,limit:800}, etherscan:{used:0,limit:50000}, cryptopanic:{used:0,limit:800} },
      jobs: { queued: 0, running: 0, lastRunIso: new Date().toISOString() }
    },
    metrics: metrics.snapshot()
  });
});

export default r;
"

mkfile "$BASE_SERVER/src/services/execution.ts" "import type { OrderRequest, OrderAck, Position, Fill, Account } from '../types/trading';

// TODO: integrate with existing paper engine. This is a minimal placeholder layer.
export async function placeOrder(req: OrderRequest): Promise<OrderAck>{
  // TODO: pre-validate (stepSize, tickSize, minNotional), risk checks, queue-nudge, self-trade prevention
  return { orderId: 'sim-'+Date.now(), status: 'accepted' };
}
export async function cancelOrder(orderId: string): Promise<boolean>{
  // TODO: route to engine
  return true;
}
export async function getPositions(): Promise<Position[]>{
  return [];
}
export async function getFills(limit:number): Promise<Fill[]>{
  return [];
}
export async function getAccount(): Promise<Account>{
  return { equity: 100000, cash: 100000, maintenanceMargin: 0 };
}
"

mkfile "$BASE_SERVER/src/services/risk.ts" "import type { RiskSettings } from '../types/trading';
let current: RiskSettings = { maxPositionSizePct: 25, maxDailyLoss: 5, defaultStopPct: 0.25, defaultTakeProfitPct: 0.5, killSwitch: false };
export async function getRisk(){ return current; }
export async function setRisk(next: RiskSettings){ current = { ...current, ...next }; }
"

mkfile "$BASE_SERVER/src/services/metrics.ts" "// Simple in-memory snapshot for p50/p95/p99 style placeholders.
// TODO: replace with existing Prometheus-compatible metrics if available.

type Dist = { p50:number; p95:number; p99:number };
const now = ()=> Date.now();

export function snapshot(){
  const lat = (v:number):Dist => ({ p50:v, p95:v*2, p99:v*3 });
  return {
    latencyMs: {
      submitAck: lat(20),
      ackFill: lat(40),
      cancel: lat(15)
    },
    wsStalenessMs: lat(200),
    slippageBps: lat(1),
    makerTaker: { makerPct: 60, takerPct: 40 },
    rejectsByReason: { }
  };
}
"

mkfile "$BASE_SERVER/src/services/quotes.ts" "let lastMsgTs = 0;
export function mark(){ lastMsgTs = Date.now(); }
export function lastAgeMs(){ return lastMsgTs? (Date.now()-lastMsgTs) : Number.MAX_SAFE_INTEGER; }
export function isHealthy(){ return lastAgeMs() < 5_000; }
"

# (Optional) Wire routers in server index if not present
mkfile "$BASE_SERVER/src/index.example.ts" "import express from 'express';
import trading from './routes/trading';
import health from './routes/health';

const app = express();
app.use(express.json());
app.use('/api/trading', trading);
app.use('/api/health', health);

// TODO: attach WS server at /ws and feed quotes.ts.mark() on messages
app.listen(3000, ()=> console.log('server on :3000'));
"

# README note
mkfile "README.SKIPPY-SCAFFOLD.md" "# SKIPPY Scaffold (Second Draft)

Run: \`bash skippy_scaffold.sh\` from repo root. Files are created only if missing.

Next steps:
1) Replace placeholders in server/services/* with real engine calls.
2) Mount routes in your actual server entry if different.
3) Point the WebSocket client to your real `/ws` and call \`quotes.mark()\` on inbound messages.
4) Swap Health \"snapshots\" with your Prometheus metrics.
"

echo "\nDone. Review TODOs and integrate with existing engine/security/limits."
