import { useEffect, useState } from 'react';
import axios from 'axios';
import { RotateCw } from 'lucide-react';

interface Job {
  id: string;
  type: string;
  status: string;
  attempts: number;
  priority: number;
  created_at: string;
}

// Adding token fetcher function directly for MVP simplicity
const getAuthToken = () => localStorage.getItem('qf_token');

export function JobTable() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const fetchJobs = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const url = `/api/v1/queues/emails/jobs${filter ? `?status=${filter}` : ''}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobs(res.data.data);
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // Poll every 5s for table updates (since we didn't push full job lists via WS)
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  const handleRetry = async (id: string) => {
    try {
      const token = getAuthToken();
      await axios.post(`/api/v1/jobs/${id}/retry`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchJobs();
    } catch (err) {
      alert('Failed to retry job');
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Recent Jobs (emails)</h2>
        
        <select 
          value={filter} 
          onChange={(e) => setFilter(e.target.value)}
          style={{ background: 'var(--bg-tertiary)', color: 'white', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '6px' }}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="dead_letter">Dead Letter</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '1rem 0', fontWeight: 500 }}>ID</th>
              <th style={{ padding: '1rem 0', fontWeight: 500 }}>Type</th>
              <th style={{ padding: '1rem 0', fontWeight: 500 }}>Status</th>
              <th style={{ padding: '1rem 0', fontWeight: 500 }}>Attempts</th>
              <th style={{ padding: '1rem 0', fontWeight: 500, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && jobs.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '2rem 0', textAlign: 'center' }}>Loading...</td></tr>
            ) : jobs.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>No jobs found in this queue.</td></tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 0', fontFamily: 'monospace', fontSize: '0.85rem' }}>{job.id.substring(0, 8)}</td>
                  <td style={{ padding: '1rem 0' }}>{job.type}</td>
                  <td style={{ padding: '1rem 0' }}>
                    <span className={`badge ${job.status}`}>{job.status}</span>
                  </td>
                  <td style={{ padding: '1rem 0' }}>{job.attempts}</td>
                  <td style={{ padding: '1rem 0', textAlign: 'right' }}>
                    {(job.status === 'dead_letter' || job.status === 'failed') && (
                      <button className="btn-primary btn-small" onClick={() => handleRetry(job.id)}>
                        <RotateCw size={14} /> Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
