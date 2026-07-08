import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

export interface WorkerData {
  id: string;
  status: string;
  job: string;
  hb: string;
}

export interface EventData {
  id: string;
  status: string;
  time: string;
}

export interface MetricsPayload {
  throughput: number;
  distribution: Record<string, number>;
  workers: WorkerData[];
  events: EventData[];
}

export function useMetrics() {
  const [metrics, setMetrics] = useState<MetricsPayload>({
    throughput: 0,
    distribution: { pending: 0, running: 0, completed: 0, dead_letter: 0 },
    workers: [],
    events: []
  });
  
  const [isConnected, setIsConnected] = useState(false);
  const [sparkline, setSparkline] = useState<number[]>(Array.from({ length: 40 }, () => 0));

  useEffect(() => {
    const socket = io('/', { path: '/socket.io' });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('metrics_update', (data: MetricsPayload) => {
      setMetrics(data);
      // Push new throughput into the sparkline history array
      setSparkline(prev => {
        const next = [...prev.slice(1), data.throughput];
        return next;
      });
    });

    return () => { socket.disconnect(); };
  }, []);

  return { metrics, isConnected, sparkline };
}
