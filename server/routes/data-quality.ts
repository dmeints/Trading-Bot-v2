
import { Router } from 'express';
import { dataQuality } from '../services/DataQuality';

const router = Router();

router.get('/stats', (req, res) => {
  const stats = dataQuality.getStats();
  res.json(stats);
});

router.get('/quarantine/:dataType', (req, res) => {
  const { dataType } = req.params;
  const limit = parseInt(req.query.limit as string) || 10;
  
  const quarantineData = dataQuality.getQuarantineData(dataType, limit);
  
  res.json({
    dataType,
    quarantineData,
    count: quarantineData.length
  });
});

router.get('/anomalies', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const anomalies = dataQuality.getAnomalies(limit);
  
  res.json({
    anomalies,
    count: anomalies.length,
    timestamp: Date.now()
  });
});

router.delete('/quarantine/:dataType', (req, res) => {
  const { dataType } = req.params;
  dataQuality.clearQuarantine(dataType);
  
  res.json({
    success: true,
    message: `Quarantine cleared for ${dataType}`
  });
});

router.get('/health', (req, res) => {
  const isHealthy = dataQuality.isHealthy();
  
  res.json({
    healthy: isHealthy,
    timestamp: Date.now(),
    status: isHealthy ? 'ok' : 'degraded'
  });
});

export default router;
