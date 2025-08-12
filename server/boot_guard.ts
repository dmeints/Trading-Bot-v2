
import { Server as HTTPServer } from 'http';

export function assertServerState(server: HTTPServer) {
  const s: any = server;
  if (s.listening !== true) {
    console.warn('[boot_guard] httpServer not listening yet when creating WSS. Ensure listen() order is correct.');
  }
  
  const address = server.address();
  if (address && typeof address === 'object') {
    console.log(`[boot_guard] HTTP server confirmed listening on port ${address.port}`);
  }
}

export function validateNoPortConflicts() {
  // Check environment variables for potential conflicts
  const wsPort = process.env.WS_PORT;
  const viteWs = process.env.VITE_WS;
  const replitWs = process.env.REPLIT_WS;
  
  if (wsPort || viteWs || replitWs) {
    console.warn('[boot_guard] Found WS-related environment variables:');
    if (wsPort) console.warn(`[boot_guard] WS_PORT=${wsPort}`);
    if (viteWs) console.warn(`[boot_guard] VITE_WS=${viteWs}`);
    if (replitWs) console.warn(`[boot_guard] REPLIT_WS=${replitWs}`);
    console.warn('[boot_guard] Ensure these are not conflicting with your app port.');
  }
}
