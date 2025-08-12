import { WebSocketServer } from 'ws';
import { logger } from './utils/logger';
import { priceStreamManager } from './services/priceStream';

let wss: WebSocketServer | null = null;

export function initWebSocketServer(server: any) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).substr(2, 9);
    logger.info(`WebSocket client connected: ${clientId}`);

    // Start default price streams when first client connects
    if (wss && wss.clients.size === 1) {
      logger.info('Starting default price streams');
      priceStreamManager.startStream('BTCUSDT');
      priceStreamManager.startStream('ETHUSDT');
    }

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        logger.info(`Message from ${clientId}:`, data);

        // Handle price stream subscriptions
        if (data.type === 'subscribe' && data.symbol) {
          logger.info(`Client ${clientId} subscribing to ${data.symbol}`);
          priceStreamManager.startStream(data.symbol);

          ws.send(JSON.stringify({
            type: 'subscription_confirmed',
            symbol: data.symbol,
            clientId
          }));
        }

        // Handle price stream unsubscriptions  
        else if (data.type === 'unsubscribe' && data.symbol) {
          logger.info(`Client ${clientId} unsubscribing from ${data.symbol}`);
          // Note: Don't stop stream immediately as other clients may be subscribed

          ws.send(JSON.stringify({
            type: 'unsubscription_confirmed',
            symbol: data.symbol,
            clientId
          }));
        }

        // Echo back other messages
        else {
          ws.send(JSON.stringify({
            type: 'echo',
            data: data,
            clientId
          }));
        }
      } catch (error) {
        logger.error(`Error processing message from ${clientId}:`, error);
      }
    });

    ws.on('close', () => {
      logger.info(`WebSocket client disconnected: ${clientId}`);

      // Stop all streams when no clients are connected
      if (wss && wss.clients.size === 0) {
        logger.info('No clients connected, stopping all price streams');
        priceStreamManager.stopAllStreams();
      }
    });
  });

  return wss;
}

export function getWSS() {
  return wss;
}