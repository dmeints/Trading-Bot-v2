import { useEffect, useRef, useState } from 'react';

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
