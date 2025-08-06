import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { aiCopilot } from '../services/aiCopilot';
import { insightEngine } from '../services/insightEngine';

const router = Router();

// Ask AI Copilot a question
router.post('/ask', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { question, context } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const response = await aiCopilot.askQuestion(userId, question, context);
    res.json(response);
  } catch (error) {
    console.error('[Copilot] Error processing question:', error);
    res.status(500).json({ error: 'Failed to process question' });
  }
});

// Explain a specific trade
router.get('/explain-trade/:tradeId', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { tradeId } = req.params;

    const explanation = await aiCopilot.explainTrade(tradeId, userId);
    res.json(explanation);
  } catch (error) {
    console.error('[Copilot] Error explaining trade:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to explain trade' });
    }
  }
});

// Get parameter recommendations for a strategy
router.get('/recommendations/:strategy', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { strategy } = req.params;

    const recommendations = await aiCopilot.provideParameterRecommendations(userId, strategy);
    res.json(recommendations);
  } catch (error) {
    console.error('[Copilot] Error generating recommendations:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// Get unified insights dashboard data
router.get('/insights', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const insights = await insightEngine.generateUnifiedInsights(userId);
    res.json(insights);
  } catch (error) {
    console.error('[Copilot] Error generating insights:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// Get experience replay data
router.get('/experience-replay', isAuthenticated, async (req: any, res) => {
  try {
    const replay = insightEngine.getExperienceReplay();
    res.json(replay);
  } catch (error) {
    console.error('[Copilot] Error getting experience replay:', error);
    res.status(500).json({ error: 'Failed to get experience replay' });
  }
});

// Replay a specific experience with corrections
router.post('/experience-replay/:experienceId', isAuthenticated, async (req: any, res) => {
  try {
    const { experienceId } = req.params;
    const { corrections } = req.body;

    const replayResult = await insightEngine.replayExperience(experienceId, corrections);
    res.json(replayResult);
  } catch (error) {
    console.error('[Copilot] Error replaying experience:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to replay experience' });
    }
  }
});

// Record a new experience for learning
router.post('/experience', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const experience = {
      ...req.body,
      userId
    };

    await insightEngine.recordExperience(experience);
    res.json({ success: true, message: 'Experience recorded' });
  } catch (error) {
    console.error('[Copilot] Error recording experience:', error);
    res.status(500).json({ error: 'Failed to record experience' });
  }
});

// Generate adaptive RL feedback
router.post('/adaptive-feedback/:modelId', isAuthenticated, async (req: any, res) => {
  try {
    const { modelId } = req.params;
    const feedback = await insightEngine.generateAdaptiveRLFeedback(modelId);
    res.json(feedback);
  } catch (error) {
    console.error('[Copilot] Error generating adaptive feedback:', error);
    res.status(500).json({ error: 'Failed to generate adaptive feedback' });
  }
});

// Generate live trade commentary
router.post('/live-commentary', isAuthenticated, async (req: any, res) => {
  try {
    const { tradeSignal } = req.body;
    const commentary = await aiCopilot.generateLiveTradeCommentary(tradeSignal);
    res.json({ commentary });
  } catch (error) {
    console.error('[Copilot] Error generating commentary:', error);
    res.status(500).json({ error: 'Failed to generate commentary' });
  }
});

export default router;