import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
