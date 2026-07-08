import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { pool } from './db/config';

export function setupWebSocket(server: HTTPServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*', 
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);
    broadcastMetrics(io);
    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  setInterval(() => {
    broadcastMetrics(io);
  }, 3000);

  return io;
}

async function broadcastMetrics(io: SocketIOServer) {
  try {
    // 1. Throughput (jobs completed in the last 60 seconds)
    const tpRes = await pool.query(`
      SELECT COUNT(*) as val 
      FROM jobs 
      WHERE status = 'completed' AND updated_at > NOW() - INTERVAL '60 seconds'
    `);
    const throughput = parseInt(tpRes.rows[0].val, 10);

    // 2. Status Distribution Counts
    const distRes = await pool.query(`SELECT status, COUNT(*) as count FROM jobs GROUP BY status`);
    const distribution: Record<string, number> = { pending: 0, running: 0, completed: 0, dead_letter: 0 };
    distRes.rows.forEach(r => { 
      distribution[r.status] = parseInt(r.count, 10); 
    });

    // 3. Active Workers list
    const workersRes = await pool.query(`
      SELECT id, status, current_job_id, last_heartbeat 
      FROM workers 
      WHERE status = 'online' AND last_heartbeat > NOW() - INTERVAL '2 minutes'
    `);
    const workers = workersRes.rows.map(w => ({
      id: w.id.substring(0, 8),
      status: w.status,
      job: w.current_job_id ? w.current_job_id.substring(0, 8) : '—',
      hb: Math.max(0, Math.floor((Date.now() - new Date(w.last_heartbeat).getTime()) / 1000)) + 's ago'
    }));

    // 4. Live Event Feed (last 20 job events)
    const eventsRes = await pool.query(`
      SELECT job_id, to_status, created_at 
      FROM job_events 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    const events = eventsRes.rows.map(e => ({
      id: e.job_id.substring(0, 8),
      status: e.to_status,
      time: new Date(e.created_at).toLocaleTimeString('en-GB')
    }));

    io.emit('metrics_update', {
      throughput,
      distribution,
      workers,
      events
    });
  } catch (error) {
    console.error('[WS] Error broadcasting metrics:', error);
  }
}
