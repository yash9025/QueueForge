import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import apiRoutes from './routes/api';
import dotenv from 'dotenv';
import { pool } from './db/config';
import http from 'http';
import { setupWebSocket } from './websocket';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Apply routes
app.use('/api/v1', apiRoutes);

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
  console.error('[SERVER ERROR]', err);
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
  console.log(`QueueForge API Server running on port ${PORT}`);
});

// Graceful Shutdown
const shutdown = async (signal: string) => {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    await pool.end();
    console.log('Database pool closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
