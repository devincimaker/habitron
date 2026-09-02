import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { generalRateLimiter } from './middleware/rateLimit.js';
import chatRouter from './routes/chat.js';
import instructRouter from './routes/instruct.js';
import memoriesRouter from './routes/memories.js';
import notificationsRouter from './routes/notifications.js';
import sessionsRouter from './routes/sessions.js';
import speakRouter from './routes/speak.js';
import transcribeRouter from './routes/transcribe.js';
import { instructQueue } from './services/instructQueue.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: true, // Allow all origins in development; configure for production
    credentials: true,
  })
);

// Body parsing
app.use(express.json());

// General rate limiting
app.use(generalRateLimiter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/chat', chatRouter);
app.use('/api/instruct', instructRouter);
app.use('/api/memories', memoriesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/speak', speakRouter);
app.use('/api/transcribe', transcribeRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

// Start server
app.listen(config.port, () => {
  console.log(`API server running on http://localhost:${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/health`);
});

// A turn that died with the last process resumes from `queued`.
instructQueue()
  .resume()
  .catch((error) => console.error('Instruct queue resume failed:', error));
