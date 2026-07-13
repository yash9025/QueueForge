import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { pool } from './db/config';
import { logger } from './utils/logger';

export function setupWebSocket(server: HTTPServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.info(`[WS] Client connected: ${socket.id}`);
    // Push current state immediately so the dashboard isn't blank on load
    broadcastMetrics(io);
    socket.on('disconnect', () => {
      logger.info(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  // Push a fresh snapshot every 3 seconds to all connected dashboards
  setInterval(() => broadcastMetrics(io), 3000);

  return io;
}

async function broadcastMetrics(io: SocketIOServer) {
  try {
    // One round-trip to the DB instead of four. We use a CTE (WITH clause) to
    // compute all four datasets in a single query, then JSON-aggregate them on
    // the Postgres side. This cuts network latency and DB overhead by ~75%.
    const result = await pool.query(`
      WITH
        -- 1. Jobs completed in the last 60 seconds
        throughput_cte AS (
          SELECT COUNT(*) AS val
          FROM   jobs
          WHERE  status = 'completed'
            AND  updated_at > NOW() - INTERVAL '60 seconds'
        ),

        -- 2. Count of jobs grouped by status
        distribution_cte AS (
          SELECT status, COUNT(*) AS cnt
          FROM   jobs
          GROUP  BY status
        ),

        -- 3. Workers that sent a heartbeat in the last 2 minutes
        workers_cte AS (
          SELECT id, status, current_job_id, last_heartbeat
          FROM   workers
          WHERE  status = 'online'
            AND  last_heartbeat > NOW() - INTERVAL '2 minutes'
        ),

        -- 4. Last 20 state-transition events for the live feed
        events_cte AS (
          SELECT job_id, to_status, created_at
          FROM   job_events
          ORDER  BY created_at DESC
          LIMIT  20
        )

      SELECT
        (SELECT val   FROM throughput_cte)                  AS throughput,
        (SELECT json_agg(distribution_cte) FROM distribution_cte)  AS distribution,
        (SELECT json_agg(workers_cte)      FROM workers_cte)        AS workers,
        (SELECT json_agg(events_cte)       FROM events_cte)         AS events
    `);

    const row = result.rows[0];

    // --- Throughput ---
    const throughput = parseInt(row.throughput, 10);

    // --- Status distribution ---
    const distribution: Record<string, number> = {
      pending: 0, running: 0, completed: 0, dead_letter: 0,
    };
    if (row.distribution) {
      for (const r of row.distribution) {
        distribution[r.status] = parseInt(r.cnt, 10);
      }
    }

    // --- Active workers ---
    const workers = (row.workers ?? []).map((w: any) => ({
      id:     w.id.substring(0, 8),
      status: w.status,
      job:    w.current_job_id ? w.current_job_id.substring(0, 8) : '—',
      hb:     Math.max(0, Math.floor((Date.now() - new Date(w.last_heartbeat).getTime()) / 1000)) + 's ago',
    }));

    // --- Live event feed ---
    const events = (row.events ?? []).map((e: any) => ({
      id:     e.job_id.substring(0, 8),
      status: e.to_status,
      time:   new Date(e.created_at).toLocaleTimeString('en-GB'),
    }));

    io.emit('metrics_update', { throughput, distribution, workers, events });

  } catch (error) {
    logger.error({ error }, '[WS] Error broadcasting metrics');
  }
}
