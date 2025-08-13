
import express from 'express';
import { OrderBook } from '../services/l2/OrderBook.js';

const router = express.Router();
const orderBook = new OrderBook();

// GET /api/l2/:venue/:symbol
router.get('/:venue/:symbol', async (req, res) => {
  try {
    const { venue, symbol } = req.params;
    const book = await orderBook.getBook(venue, symbol);
    res.json(book);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
