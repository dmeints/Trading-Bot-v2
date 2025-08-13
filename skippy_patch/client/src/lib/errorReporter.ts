export function mountClientErrorReporter(endpoint = "/api/client-errors"){
  if (typeof window === "undefined") return;
  const send = (payload: any) => fetch(endpoint, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) }).catch(()=>{});
  window.addEventListener("error", (e: any) => send({ type:"error", message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno, stack: (e.error && e.error.stack) || null }));
  window.addEventListener("unhandledrejection", (e: any) => send({ type:"unhandledrejection", reason: e?.reason?.message || String(e?.reason), stack: e?.reason?.stack || null }));
}
