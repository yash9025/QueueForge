import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface Queue {
  name: string;
}

interface QueueSelectorProps {
  selectedQueue: string;
  onSelectQueue: (queue: string) => void;
  token: string;
}

export function QueueSelector({ selectedQueue, onSelectQueue, token }: QueueSelectorProps) {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newQueueName, setNewQueueName] = useState('');

  const fetchQueues = async () => {
    try {
      const res = await api.get('/api/v1/queues', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQueues(res.data);
      if (res.data.length > 0 && !selectedQueue) {
        onSelectQueue(res.data[0].name);
      }
    } catch (err) {
      console.error('Failed to fetch queues', err);
    }
  };

  useEffect(() => {
    fetchQueues();
    // Poll every 30s to catch newly created queues by other users
    const interval = setInterval(fetchQueues, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueName.trim()) return;
    try {
      await api.post('/api/v1/queues', 
        { name: newQueueName.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchQueues();
      onSelectQueue(newQueueName.trim());
      setNewQueueName('');
      setIsCreating(false);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to create queue');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative group shadow-sm">
        <select
          value={selectedQueue}
          onChange={(e) => onSelectQueue(e.target.value)}
          className="appearance-none bg-mocha-800/80 backdrop-blur-md border border-white/10 text-white text-sm font-semibold rounded-lg px-4 py-1.5 pr-10 hover:bg-mocha-700/80 transition-all focus:outline-none focus:border-lime-500 shadow-inner cursor-pointer min-w-[150px]"
        >
          <option value="" disabled className="text-mocha-800">Select Queue...</option>
          {queues.map((q) => (
            <option key={q.name} value={q.name} className="text-mocha-800 font-semibold py-1">
              {q.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white/50 group-hover:text-white/80 transition-colors">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
        </div>
      </div>

      {isCreating ? (
        <form onSubmit={handleCreateQueue} className="flex items-center gap-1 bg-mocha-800/50 p-1 rounded-lg border border-white/10 shadow-inner">
          <input
            type="text"
            value={newQueueName}
            onChange={(e) => setNewQueueName(e.target.value)}
            placeholder="queue-name"
            autoFocus
            className="w-28 px-3 py-1 text-sm font-semibold rounded bg-white/5 border border-transparent text-white placeholder-white/30 focus:outline-none focus:bg-white/10 focus:border-white/20 transition-all"
          />
          <button type="submit" className="px-2.5 py-1 bg-lime-500/20 text-lime-400 rounded text-sm font-bold hover:bg-lime-500/30 transition-colors">✓</button>
          <button type="button" onClick={() => setIsCreating(false)} className="px-2.5 py-1 bg-white/5 text-white/50 rounded text-sm font-bold hover:bg-white/10 hover:text-white/80 transition-colors">✕</button>
        </form>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border border-dashed border-white/30 text-white/50 hover:text-white hover:border-white/50 hover:bg-white/5 shadow-sm"
          title="Create New Queue"
        >
          + Queue
        </button>
      )}
    </div>
  );
}
