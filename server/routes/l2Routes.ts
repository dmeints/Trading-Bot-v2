
/**
 * L2 Routes - Order book depth endpoints
 */

import { Router } from 'express';
import { binanceMaintainer } from '../services/l2/BookMaintainer';
import { logger } from '../utils/logger';

const router = Router();

// Get order book snapshot for venue/symbol
router.get('/:venue/:symbol', (req, res) => {
  try {
    const { venue, symbol } = req.params;
    const { k } = req.query;
    
    if (venue !== 'binance') {
      return res.status(404).json({ error: 'Venue not supported' });
    }
    
    const book = binanceMaintainer.getBook(symbol.toUpperCase());
    if (!book) {
      return res.status(404).json({ error: 'Symbol not found' });
    }
    
    const topK = parseInt(k as string) || 10;
    const snapshot = book.getSnapshot();
    
    res.json({
      symbol: snapshot.symbol,
      venue: snapshot.venue,
      bids: snapshot.bids.slice(0, topK),
      asks: snapshot.asks.slice(0, topK),
      seq: snapshot.sequence,
      timestamp: snapshot.timestamp,
      spread: book.getSpread(),
      midPrice: book.getMidPrice(),
      imbalance: book.getImbalance()
    });
  } catch (error) {
    logger.error('[L2Routes] Failed to get order book:', error);
    res.status(500).json({ error: 'Failed to get order book' });
  }
});

// Get all available books
router.get('/books', (req, res) => {
  try {
    const books = binanceMaintainer.getAllBooks();
    const summary = books.map(book => ({
      symbol: book.symbol,
      venue: book.venue,
      sequence: book.getSequence(),
      lastUpdate: book.getLastUpdate(),
      midPrice: book.getMidPrice(),
      spread: book.getSpread()
    }));
    
    res.json(summary);
  } catch (error) {
    logger.error('[L2Routes] Failed to get books:', error);
    res.status(500).json({ error: 'Failed to get books' });
  }
});

// Health check
router.get('/health', (req, res) => {
  try {
    const healthy = binanceMaintainer.isHealthy();
    const books = binanceMaintainer.getAllBooks();
    
    res.json({
      healthy,
      bookCount: books.length,
      symbols: books.map(b => b.symbol)
    });
  } catch (error) {
    logger.error('[L2Routes] Health check failed:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

export { router as l2Routes };
