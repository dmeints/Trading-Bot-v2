import { Router } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../replitAuth';
import { z } from 'zod';

const router = Router();

// User preferences schema
const updatePreferencesSchema = z.object({
  language: z.string().optional(),
  theme: z.string().optional(),
  accessibility_settings: z.record(z.any()).optional(),
});

// Get user preferences
router.get('/', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const preferences = await storage.getUserPreferences(userId);
    res.json(preferences || { language: 'en', theme: 'dark', accessibility_settings: {} });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ message: 'Failed to fetch preferences' });
  }
});

// Update user preferences
router.patch('/', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const updates = updatePreferencesSchema.parse(req.body);
    
    const preferences = await storage.updateUserPreferences(userId, updates);
    res.json(preferences);
  } catch (error) {
    console.error('Error updating preferences:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update preferences' });
  }
});

export default router;