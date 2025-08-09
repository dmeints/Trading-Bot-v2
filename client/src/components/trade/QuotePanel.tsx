import { useEffect, useState } from 'react';
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
