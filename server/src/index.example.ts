import express from 'express';
import trading from './routes/trading';
import health from './routes/health';

const app = express();
app.use(express.json());
app.use('/api/trading', trading);
app.use('/api/health', health);

// TODO: attach WS server at /ws and feed quotes.ts.mark() on messages
app.listen(3000, ()=> console.log('server on :3000'));
