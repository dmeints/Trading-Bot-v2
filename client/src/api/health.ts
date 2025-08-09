import { useQuery } from '@tanstack/react-query';
export const useHealth = ()=> useQuery({ queryKey:['health'], queryFn: async()=> fetch('/api/health').then(r=>r.json()), refetchInterval: 30000 });
