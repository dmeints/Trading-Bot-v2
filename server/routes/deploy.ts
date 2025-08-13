
import { Router } from 'express';
import { BlueGreen } from '../services/BlueGreen';

const router = Router();
const blueGreen = new BlueGreen();

router.get('/status', async (req, res) => {
  try {
    const status = blueGreen.getStatus();
    const history = blueGreen.getMetricsHistory();
    
    res.json({
      deployment: status,
      metricsHistory: history,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get deployment status' });
  }
});

router.post('/deploy/:version', async (req, res) => {
  try {
    const { version } = req.params;
    await blueGreen.deployCandidate(version);
    
    res.json({
      success: true,
      message: `Deployment of version ${version} initiated`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to initiate deployment' });
  }
});

export default router;
