import { useMutation } from '@tanstack/react-query';
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
            <button key={v} type='button' onClick={()=>setSide(v)} className={}>{v}</button>
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
