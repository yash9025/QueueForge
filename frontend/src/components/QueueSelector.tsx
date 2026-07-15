import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface Queue {
  name: string;
}

interface QueueSelectorProps {
  selectedQueue: string;
  onSelectQueue: (queue: string) => void;
}

export function QueueSelector({ selectedQueue, onSelectQueue }: QueueSelectorProps) {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newQueueName, setNewQueueName] = useState('');

  const fetchQueues = async () => {
    try {
      const res = await api.get('/api/v1/queues');
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
      await api.post('/api/v1/queues', { name: newQueueName.trim() });
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
      <div className="relative group">
        <select
          value={selectedQueue}
          onChange={(e) => onSelectQueue(e.target.value)}
          className="appearance-none bg-white/10 border border-white/20 text-white/90 text-xs font-mono font-semibold rounded-lg px-3 py-1.5 pr-8 hover:bg-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-lime-500/50 cursor-pointer min-w-[120px]"
        >
          <option value="" disabled className="text-black">Select Queue...</option>
          {queues.map((q) => (
            <option key={q.name} value={q.name} className="text-black">
              {q.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/50 group-hover:text-white/80">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
        </div>
      </div>

      {isCreating ? (
        <form onSubmit={handleCreateQueue} className="flex items-center gap-1">
          <input
            type="text"
            value={newQueueName}
            onChange={(e) => setNewQueueName(e.target.value)}
            placeholder="queue-name"
            autoFocus
            className="w-24 px-2 py-1.5 text-xs font-mono rounded bg-white/10 border border-white/30 text-white focus:outline-none focus:border-lime-500"
          />
          <button type="submit" className="px-2 py-1.5 bg-lime-500/20 text-lime-300 border border-lime-500/50 rounded text-xs font-bold hover:bg-lime-500/30">✓</button>
          <button type="button" onClick={() => setIsCreating(false)} className="px-2 py-1.5 bg-white/10 text-white/60 border border-white/20 rounded text-xs font-bold hover:bg-white/20">✕</button>
        </form>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="px-2 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all border bg-white/10 border-white/20 text-white/60 hover:text-white/90 hover:bg-white/20"
          title="Create New Queue"
        >
          + Queue
        </button>
      )}
    </div>
  );
}
