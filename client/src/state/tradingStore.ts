import create from 'zustand';

type TradingState = { symbol: string; setSymbol: (s:string)=>void };
export const useTradingStore = create<TradingState>((set)=>({ symbol: 'BTCUSDT', setSymbol: (s)=>set({symbol:s}) }));
