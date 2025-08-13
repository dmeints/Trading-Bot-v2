export function mountClientErrorReporter(endpoint = "/api/client-errors"){
  if (typeof window === "undefined") return;
  const send = (payload: any) => fetch(endpoint, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) }).catch(()=>{});
  window.addEventListener("error", (e: any) => send({ type:"error", message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno, stack: (e.error && e.error.stack) || null }));
  window.addEventListener("unhandledrejection", (e: any) => send({ type:"unhandledrejection", reason: e?.reason?.message || String(e?.reason), stack: e?.reason?.stack || null }));
}
export function mountClientErrorReporter() {
  // Global error handler for unhandled errors
  window.addEventListener('error', (event) => {
    reportError({
      type: 'javascript_error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  });

  // Global handler for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    reportError({
      type: 'unhandled_promise_rejection',
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  });

  // React error boundary fallback
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const errorMessage = args.join(' ');
    if (errorMessage.includes('React') || errorMessage.includes('component')) {
      reportError({
        type: 'react_error',
        message: errorMessage,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      });
    }
    originalConsoleError.apply(console, args);
  };
}

async function reportError(errorData: any) {
  try {
    await fetch('/api/client-errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorData)
    });
  } catch (err) {
    // Silently fail - don't want error reporting to cause more errors
    console.warn('Failed to report error:', err);
  }
}
