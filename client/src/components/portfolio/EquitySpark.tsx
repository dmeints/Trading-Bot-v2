import { useAccount } from '@/api/trading';
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
