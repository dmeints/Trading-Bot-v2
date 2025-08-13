let lastErrors: any[] = [];
export function recordError(e: unknown){
  lastErrors.unshift({ ts: Date.now(), e: (e as any)?.message || String(e) });
  lastErrors = lastErrors.slice(0, 50);
}
export function getRecentErrors(){ return lastErrors; }
