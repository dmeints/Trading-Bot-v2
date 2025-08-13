type Fn<T> = () => Promise<T>;

function sleep(ms: number){ return new Promise(r=>setTimeout(r,ms)); }
function jitter(base: number){ return base * (0.5 + Math.random()); }

export async function withRetry<T>(fn: Fn<T>, attempts = 3, baseMs = 200): Promise<T> {
  let last: any;
  for (let i=0;i<attempts;i++){
    try { return await fn(); } catch (e) { last = e; await sleep(jitter(baseMs * Math.pow(2, i))); }
  }
  throw last;
}

export async function withTimeout<T>(p: Promise<T>, ms = 5000): Promise<T> {
  let t: any;
  const timeout = new Promise<T>((_, rej) => { t = setTimeout(()=>rej(new Error(`Timeout after ${ms}ms`)), ms); });
  try { return await Promise.race([p, timeout]); } finally { clearTimeout(t); }
}

export class CircuitBreaker {
  private failures = 0;
  private state: "CLOSED"|"OPEN"|"HALF" = "CLOSED";
  private openedAt = 0;
  constructor(private thresh=5, private cooldownMs=10_000){}

  canPass(){ 
    if (this.state==="OPEN" && (Date.now()-this.openedAt)>this.cooldownMs){ this.state="HALF"; return true; }
    return this.state!=="OPEN";
  }
  record(ok: boolean){
    if (ok){ this.failures=0; this.state="CLOSED"; return; }
    this.failures++;
    if (this.failures>=this.thresh){ this.state="OPEN"; this.openedAt=Date.now(); }
  }
}

export async function safeFetch(url: string, init?: RequestInit, opts?: { timeoutMs?: number; attempts?: number; breaker?: CircuitBreaker }) {
  const doOnce = async () => {
    if (opts?.breaker && !opts.breaker.canPass()) throw new Error("Circuit open");
    try {
      const res = await withTimeout(fetch(url, init), opts?.timeoutMs ?? 5000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      opts?.breaker?.record(true);
      return res;
    } catch (e) {
      opts?.breaker?.record(false);
      throw e;
    }
  };
  return withRetry(doOnce, opts?.attempts ?? 3, 200);
}
