
import express from 'express';
import cors from 'cors';
import http from 'http';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';

// Import all route modules
import healthRoutes from './routes/health';
import tradingRoutes from './routes/trading';
import portfolioRoutes from './routes/portfolio';
import errorRoutes from './routes/errors';
import chartDataRoutes from './routes/chart-data';
import aiChatRoutes from './routes/aiChat';
import backtestRoutes from './routes/backtestRoutes';
import advancedFeaturesRoutes from './routes/advancedFeatures';
import strategiesRoutes from './routes/strategies';
import complianceRoutes from './routes/compliance';
import socialTradingRoutes from './routes/socialTrading';
import performanceAttributionRoutes from './routes/performanceAttribution';
import executionRoutes from './routes/execution';
import realBenchmarkRoutes from './routes/realBenchmarkRoutes';
import revolutionaryRoutes from './routes/revolutionary';
import monitoringRoutes from './routes/monitoring';
import conformalTuningRouter from './routes/conformalTuning';

// Services
import { MarketDataService } from './services/marketData';
import { TradingEngineService } from './services/tradingEngineService';
import { PerformanceService } from './services/performanceService';
import { RiskManagementService } from './services/riskManagement';
import { DataIngestionService } from './services/dataIngestion';
import { AlertingService } from './services/alertingService';
import { FeatureFlagsService } from './services/featureFlags';
import { AIAgentsService } from './services/aiAgents';
import { PaperTradingEngine } from './services/paperTradingEngine';
import { StevieDecisionEngine } from './services/stevieDecisionEngine';
import { AIChatService } from './services/aiChatService';
import { RiskAlertService } from './services/riskAlertService';
import { ModelZoo } from './services/modelZoo';
import { FeatureEngineeringService } from './services/featureEngineering';
import { MLOpsService } from './services/mlopsService';

// Middleware
import { requestIdMiddleware } from './middleware/requestId';
import { createWSS } from './ws';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

function onError(err: NodeJS.ErrnoException) {
  if (err.code === 'EADDRINUSE') {
    console.error(`[boot] Port ${PORT} in use. Did another dev server or a rogue WS bind steal it?`);
    console.error(`[boot] Check for any WebSocketServer created with { port: ${PORT} } instead of { server: httpServer }`);
  } else if (err.code === 'EACCES') {
    console.error(`[boot] No permission to bind port ${PORT}. Try a higher port.`);
  } else {
    console.error('[boot] Listen error:', err);
  }
  process.exit(1);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP',
});
app.use('/api', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestIdMiddleware);

// Initialize services
console.log('[boot] Initializing services...');
const marketDataService = MarketDataService.getInstance();
const tradingEngine = TradingEngineService.getInstance();
const performanceService = PerformanceService.getInstance();
const riskManagement = RiskManagementService.getInstance();
const dataIngestion = DataIngestionService.getInstance();
const alertingService = AlertingService.getInstance();
const featureFlags = FeatureFlagsService.getInstance();
const aiAgents = AIAgentsService.getInstance();
const paperTradingEngine = PaperTradingEngine.getInstance();
const stevieDecisionEngine = StevieDecisionEngine.getInstance();
const aiChatService = AIChatService.getInstance();
const riskAlertService = RiskAlertService.getInstance();
const modelZoo = ModelZoo.getInstance();
const featureEngineering = FeatureEngineeringService.getInstance();
const mlopsService = MLOpsService.getInstance();

// Register routes
app.use('/api/health', healthRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/errors', errorRoutes);
app.use('/api/chart-data', chartDataRoutes);
app.use('/api/ai', aiChatRoutes);
app.use('/api/backtest', backtestRoutes);
app.use('/api/advanced', advancedFeaturesRoutes);
app.use('/api/strategies', strategiesRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/social', socialTradingRoutes);
app.use('/api/performance', performanceAttributionRoutes);
app.use('/api/execution', executionRoutes);
app.use('/api/benchmark', realBenchmarkRoutes);
app.use('/api/revolutionary', revolutionaryRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/conformal-tuning', conformalTuningRouter);

// Create single HTTP server
console.log(`[boot] Trying to listen on port ${PORT}`);
const httpServer = http.createServer(app);

// Attach WebSocket to existing HTTP server (no separate port binding)
createWSS({ server: httpServer, path: '/ws' });

httpServer.on('error', onError);
httpServer.on('listening', () => {
  const addr = httpServer.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : PORT;
  console.log(`[boot] Serving on port ${actualPort}`);
});

// Start market data updates
marketDataService.startRealTimeUpdates();

// Initialize MLOps cron jobs only in production
if (process.env.NODE_ENV === 'production') {
  mlopsService.initializeCronJobs();
  console.log('[boot] MLOps cron jobs initialized');
} else {
  console.log('[boot] MLOps cron jobs disabled in development mode');
}

httpServer.listen(PORT, '0.0.0.0');

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[boot] SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('[boot] Process terminated');
  });
});

console.log('[boot] Server started successfully - AI services will initialize on first request');
