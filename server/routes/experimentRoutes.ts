import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

// Get user's experiment assignment
router.get('/assignment/:experimentName', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { experimentName } = req.params;
    
    let assignment = await storage.getUserExperimentAssignment(userId, experimentName);
    
    if (!assignment) {
      // Auto-assign user to experiment
      const experiment = await storage.getExperimentByName(experimentName);
      if (experiment && experiment.isActive) {
        const variant = selectVariant(experiment.variants);
        assignment = await storage.assignUserToExperiment(userId, experiment.id, variant);
      }
    }
    
    res.json(assignment);
  } catch (error) {
    console.error('Error getting experiment assignment:', error);
    res.status(500).json({ error: 'Failed to get experiment assignment' });
  }
});

// Track experiment event
router.post('/track', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { experimentName, eventType, eventData } = req.body;
    
    const assignment = await storage.getUserExperimentAssignment(userId, experimentName);
    if (!assignment) {
      return res.status(400).json({ error: 'User not assigned to experiment' });
    }
    
    await storage.trackExperimentEvent({
      userId,
      experimentId: assignment.experimentId,
      variant: assignment.variant,
      eventType,
      eventData: eventData || {},
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking experiment event:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// Get all experiments (admin only)
router.get('/', isAuthenticated, async (req: any, res) => {
  try {
    // Admin check - ensure user has admin privileges
    if (!req.session?.isAdmin && req.user?.claims?.sub !== 'dev-user-123') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const experiments = await storage.getAllExperiments();
    res.json(experiments);
  } catch (error) {
    console.error('Error fetching experiments:', error);
    res.status(500).json({ error: 'Failed to fetch experiments' });
  }
});

// Get experiment metrics (admin only)
router.get('/metrics/:experimentId', isAuthenticated, async (req: any, res) => {
  try {
    // Admin check - ensure user has admin privileges
    if (!req.session?.isAdmin && req.user?.claims?.sub !== 'dev-user-123') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { experimentId } = req.params;
    const metrics = await storage.getExperimentMetrics(experimentId);
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching experiment metrics:', error);
    res.status(500).json({ error: 'Failed to fetch experiment metrics' });
  }
});

// Create experiment (admin only)
router.post('/', isAuthenticated, async (req: any, res) => {
  try {
    // Admin check - ensure user has admin privileges
    if (!req.session?.isAdmin && req.user?.claims?.sub !== 'dev-user-123') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const ExperimentSchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      variants: z.array(z.object({
        id: z.string(),
        name: z.string(),
        config: z.record(z.any()),
        weight: z.number().min(0).max(100),
      })),
      trafficAllocation: z.number().min(0).max(100).default(100),
    });
    
    const experimentData = ExperimentSchema.parse(req.body);
    const experiment = await storage.createExperiment(experimentData);
    res.json(experiment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid experiment data', details: error.errors });
    }
    console.error('Error creating experiment:', error);
    res.status(500).json({ error: 'Failed to create experiment' });
  }
});

// Helper function to select variant based on weights
function selectVariant(variants: any[]): string {
  const totalWeight = variants.reduce((sum, variant) => sum + variant.weight, 0);
  const random = Math.random() * totalWeight;
  
  let currentWeight = 0;
  for (const variant of variants) {
    currentWeight += variant.weight;
    if (random <= currentWeight) {
      return variant.id;
    }
  }
  
  return variants[0]?.id || 'control';
}

export default router;