
import { Router } from 'express';
import { bookMaintainer } from '../services/l2/BookMaintainer.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/l2/:venue/:symbol - Get order book snapshot
router.get('/:venue/:symbol', (req, res) => {
  try {
    const { venue, symbol } = req.params;
    
    if (!venue || !symbol) {
      return res.status(400).json({ error: 'Venue and symbol required' });
    }

    const book = bookMaintainer.getBook(venue, symbol.toUpperCase());
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json(book);
  } catch (error) {
    logger.error('L2 book error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/l2/:venue/:symbol/aggregates - Get book aggregates
router.get('/:venue/:symbol/aggregates', (req, res) => {
  try {
    const { venue, symbol } = req.params;
    
    const aggregates = bookMaintainer.getAggregates(venue, symbol.toUpperCase());
    
    if (!aggregates) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json(aggregates);
  } catch (error) {
    logger.error('L2 aggregates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
