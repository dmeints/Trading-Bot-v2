import { saveRisk, useRisk } from '@/api/trading';
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
      <button onClick={()=>m.mutate(form)} className='rounded-xl bg-black text-white px-4 py-2' disabled={m.isPending} data-testid="save-risk-controls">Save</button>
      {m.data && <div className='text-sm text-green-700'>Saved.</div>}
    </div>
  );
}
