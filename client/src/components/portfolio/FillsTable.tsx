import { useFills } from '@/api/trading';
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
