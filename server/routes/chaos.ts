
import { Router } from 'express';
import { chaos } from '../services/Chaos';
import { z } from 'zod';

const router = Router();

const InjectRequestSchema = z.object({
  type: z.enum(['ws_flap', 'api_timeout', 'l2_gap', 'depth_spike', 'network_partition', 'memory_pressure']),
  duration: z.number().optional(),
  severity: z.number().min(0).max(1).optional()
});

router.post('/inject', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Chaos engineering disabled in production' });
    }

    const { type, duration, severity } = InjectRequestSchema.parse(req.body);
    const injectionId = await chaos.inject(type, { duration, severity });

    res.json({
      success: true,
      injectionId,
      type,
      message: `Chaos injection ${type} started`
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid request' });
  }
});

router.get('/status', (req, res) => {
  const activeInjections = chaos.getActiveInjections();
  const stats = chaos.getStats();
  
  res.json({
    enabled: chaos.isEnabled(),
    activeInjections,
    stats
  });
});

router.delete('/:injectionId', (req, res) => {
  const { injectionId } = req.params;
  const stopped = chaos.stopInjection(injectionId);
  
  res.json({
    success: stopped,
    message: stopped ? 'Injection stopped' : 'Injection not found'
  });
});

export default router;
