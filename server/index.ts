
/**
 * Main server entry point with all integrations
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { logger } from './utils/logger.js';
import { errorHandler } from './utils/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { recordApiUsage } from './middleware/apiGuardrails.js';

// Route imports
import { healthRoutes } from './routes/health.js';
import { tradingRoutes } from './routes/trading.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { marketRoutes } from './routes/marketRoutes.js';
import { aiChatRoutes } from './routes/aiChat.js';
import { executionRoutes } from './routes/execution.js';
import { paperTradeBridgeRoutes } from './routes/paperTradeBridge.js';

// Service imports
import { marketData } from './services/marketData.js';
import { paperTradeBridge } from './services/paperTradeBridge.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-production-domain.com'] 
    : true,
  credentials: true
}));

app.use(compression());

// Request middleware
app.use(requestId);
app.use(rateLimiter);
app.use(recordApiUsage);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('API Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      requestId: (req as any).requestId
    });
  });
  
  next();
});

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/ai', aiChatRoutes);
app.use('/api/execution', executionRoutes);
app.use('/api/paper-trade-bridge', paperTradeBridgeRoutes);

// Static file serving for client
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const clientDistPath = join(__dirname, '../client/dist');

app.use(express.static(clientDistPath));

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(join(clientDistPath, 'index.html'));
});

// Error handling
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  logger.info(`New WebSocket connection from ${clientIp}`);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'subscribe') {
        // Handle subscription to real-time data
        ws.send(JSON.stringify({
          type: 'subscribed',
          channel: message.channel,
          status: 'success'
        }));
      }
    } catch (error) {
      logger.warn('Invalid WebSocket message:', error);
    }
  });

  ws.on('close', (code, reason) => {
    logger.info(`WebSocket connection closed: ${code} - ${reason}`);
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });

  // Send initial connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to Skippy AI Trading System',
    timestamp: new Date().toISOString()
  }));
});

// Broadcast market data updates
function broadcastMarketData(data: any) {
  const message = JSON.stringify({
    type: 'market_update',
    data,
    timestamp: new Date().toISOString()
  });

  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}

// Initialize services
async function initializeServices() {
  try {
    logger.info('Initializing Skippy Trading Platform services...');
    
    // Initialize market data service
    await marketData.initialize();
    logger.info('✅ Market data service initialized');

    // Initialize paper trade bridge
    await paperTradeBridge.initialize();
    logger.info('✅ Paper trade bridge initialized');

    // Set up market data broadcasting
    marketData.on('priceUpdate', broadcastMarketData);
    
    logger.info('🚀 All services initialized successfully');
    
  } catch (error) {
    logger.error('❌ Service initialization failed:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    await initializeServices();
    
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Skippy Trading Platform running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
      logger.info(`🔥 Paper Trade Burn-In: http://localhost:${PORT}/api/paper-trade-bridge`);
      logger.info(`🌐 WebSocket: ws://localhost:${PORT}/ws`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  // Cleanup paper trade bridge
  await paperTradeBridge.cleanup();
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  
  // Cleanup paper trade bridge
  await paperTradeBridge.cleanup();
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

startServer();
