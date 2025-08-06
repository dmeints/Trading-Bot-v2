import { Router } from 'express';
import { feedbackSubmissions } from '@shared/schema';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

const router = Router();

// Submit feedback
router.post('/api/feedback', async (req, res) => {
  try {
    const { rating, category, message, page } = req.body;
    const userId = 'dev-user-123'; // Development mode user
    
    if (!rating || !category || !message) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    
    const [feedback] = await db
      .insert(feedbackSubmissions)
      .values({
        userId,
        rating: parseInt(rating),
        category,
        message,
        page: page || '/',
        userAgent: req.headers['user-agent'] || 'Unknown',
      })
      .returning({ id: feedbackSubmissions.id });
    
    res.json({ success: true, id: feedback.id });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    res.status(500).json({ message: "Failed to submit feedback" });
  }
});

// Get feedback submissions (admin)
router.get('/api/admin/feedback', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const feedback = await db
      .select()
      .from(feedbackSubmissions)
      .orderBy(sql`${feedbackSubmissions.submittedAt} DESC`)
      .limit(limit);
    
    res.json(feedback);
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ message: "Failed to fetch feedback" });
  }
});

export { router as feedbackRoutes };