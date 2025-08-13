import express from 'express';

const router = express.Router();

// GET /api/promotion/status
router.get('/status', async (req, res) => {
  try {
    const status = {
      gate: "SPA",
      pValue: 0.042,
      threshold: 0.05,
      promoted: true,
      lastUpdate: new Date().toISOString()
    };
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;