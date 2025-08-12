
import { WebSocketServer } from 'ws';
import type { Server as HTTPServer } from 'http';

let wssSingleton: WebSocketServer | null = null;

export function createWSS(opts: { server: HTTPServer; path?: string }) {
  if (wssSingleton) {
    console.warn('[ws] Reusing existing WebSocketServer (double init avoided).');
    return wssSingleton;
  }
  
  const { server, path = '/ws' } = opts;
  const wss = new WebSocketServer({ server, path });

  wss.on('listening', () => {
    console.log(`[ws] WebSocket server attached at ${path}`);
  });

  wss.on('error', (err: any) => {
    console.error('[ws] WebSocket server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error('[ws] EADDRINUSE: A rogue WebSocket server is binding directly to the port.');
      console.error('[ws] Remove any WebSocketServer created with { port: ... } - use { server: httpServer } instead.');
    }
  });

  wss.on('connection', (ws, req) => {
    console.log(`[ws] New WebSocket connection from ${req.socket.remoteAddress}`);
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('[ws] Received message:', data);
        
        // Echo back for now - implement your WebSocket logic here
        ws.send(JSON.stringify({
          type: 'response',
          data: 'Message received',
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('[ws] Error parsing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      console.log('[ws] WebSocket connection closed');
    });

    ws.on('error', (error) => {
      console.error('[ws] WebSocket connection error:', error);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to Skippy AI Trading System',
      timestamp: new Date().toISOString()
    }));
  });

  wssSingleton = wss;
  return wss;
}

export function getWSS(): WebSocketServer | null {
  return wssSingleton;
}
