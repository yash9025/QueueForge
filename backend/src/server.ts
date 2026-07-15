import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import apiRoutes from './routes/api';
import dotenv from 'dotenv';
import { pool } from './db/config';
import http from 'http';
import { setupWebSocket } from './websocket';
import { logger } from './utils/logger';
import pinoHttp from 'pino-http';

dotenv.config();

const app = express();
app.set('trust proxy', 1); // Trust Render's reverse proxy for rate limiting

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: false })); // Exclude noisy auto-logs, or set to true for everything

// Apply routes
app.use('/api/v1', apiRoutes);

// Root endpoint for simple browser checks
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'QueueForge API',
    status: 'online',
    version: '1.0.0',
    message: 'Welcome to QueueForge! The API is fully operational.'
  });
});

// Health check endpoint (Readiness)
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err }, '[SERVER ERROR]');
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred'
    }
  });
});

// Start server
const server = http.createServer(app);
setupWebSocket(server);

server.listen(PORT, () => {
  logger.info(`QueueForge API Server running on port ${PORT}`);
});

// Graceful Shutdown
const shutdown = async (signal: string) => {
  logger.info(`\n[${signal}] Shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    await pool.end();
    logger.info('Database pool closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
