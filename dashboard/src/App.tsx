import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMetrics } from './hooks/useMetrics';
import { RecruiterGuide } from './components/RecruiterGuide';
import { ArchDiagram } from './components/ArchDiagram';
import axios from 'axios';

// ─── Animated counter ───────────────────────────────────────────────
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (value !== prev.current) {
      setFlash(true);
      setTimeout(() => setFlash(false), 500);
      prev.current = value;
    }
    setDisplay(value);
  }, [value]);

  return <span className={flash ? 'num-flash inline-block' : 'inline-block'}>{display}</span>;
}

// ─── Sparkline with gradient fill ───────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  const W = 640, H = 120, n = data.length;
  const max = Math.max(...data, 1);
  const step = n > 1 ? W / (n - 1) : 0;
  const pts = data.map((v, i) => `${i * step},${H - (v / max) * (H - 8) - 4}`);
  const polyline = pts.join(' ');
  const area = `${pts[0]} ${pts.join(' ')} ${(n - 1) * step},${H} 0,${H}`;

  return (
    <svg viewBox="0 0 640 120" className="w-full h-32 overflow-visible">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d97706" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Gradient fill area */}
      <polygon points={area} fill="url(#sparkGrad)" />
      {/* Line */}
      <polyline points={polyline} fill="none" stroke="#d97706" strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" />
      {/* Live dot */}
      {n > 0 && (
        <>
          <circle cx={(n - 1) * step} cy={H - (data[n - 1] / max) * (H - 8) - 4} r="5" fill="#65a30d" opacity="0.3">
            <animate attributeName="r" values="5;9;5" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx={(n - 1) * step} cy={H - (data[n - 1] / max) * (H - 8) - 4} r="4" fill="#65a30d" />
        </>
      )}
    </svg>
  );
}

// ─── Toast notification ──────────────────────────────────────────────
interface Toast { id: number; text: string; color: string; }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`toast-enter px-4 py-2.5 rounded-lg shadow-xl text-sm font-mono flex items-center gap-2.5 backdrop-blur-sm border ${t.color}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current live-dot shrink-0" />
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────
function StatCard({ label, value, accent, icon, loading }: { label: string; value: number; accent: string; icon: string; loading?: boolean }) {
  return (
    <div className={`card-hover relative overflow-hidden bg-white rounded-xl border border-cream-200 px-5 py-4 shadow-sm`}>
      <div className={`absolute top-0 left-0 h-1 w-full ${accent}`} />
      <div className="text-[11px] uppercase tracking-widest text-mocha-400 font-mono mb-2">{label}</div>
      <div className="flex items-end justify-between">
        {loading ? (
          <div className="h-9 w-20 bg-cream-200 animate-pulse rounded" />
        ) : (
          <div className="text-3xl font-mono font-bold text-mocha-800">
            <AnimatedNumber value={value} />
          </div>
        )}
        <div className="text-2xl opacity-20 select-none">{icon}</div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────
function App() {
  const { metrics, isConnected, sparkline } = useMetrics();
  const [token, setToken] = useState<string | null>(localStorage.getItem('qf_token'));
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('secret123');
  const [time, setTime] = useState('--:--:--');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const demoInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastId = useRef(0);
  const prevEventCount = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('en-GB')), 1000);
    return () => clearInterval(t);
  }, []);

  // Demo mode: auto-inject jobs every 2 seconds
  useEffect(() => {
    if (demoMode && token) {
      demoInterval.current = setInterval(() => {
        axios.post('/api/v1/queues/emails/jobs',
          { type: ['welcome_email', 'password_reset', 'weekly_digest'][Math.floor(Math.random() * 3)], payload: { demo: true } },
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {});
      }, 2000);
      pushToast('🚀 Demo mode ON — jobs injecting every 2s', 'bg-amber-50 border-amber-200 text-amber-800');
    } else {
      if (demoInterval.current) clearInterval(demoInterval.current);
    }
    return () => { if (demoInterval.current) clearInterval(demoInterval.current); };
  }, [demoMode, token]);

  // Toast when new events arrive
  useEffect(() => {
    if (metrics.events.length > prevEventCount.current && prevEventCount.current > 0) {
      const newest = metrics.events[0];
      if (newest) {
        const id = ++toastId.current;
        const isGood = newest.status === 'completed';
        const isDead = newest.status === 'dead_letter' || newest.status === 'failed';
        const color = isGood
          ? 'bg-lime-50 border-lime-200 text-lime-800'
          : isDead
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-amber-50 border-amber-200 text-amber-800';
        const text = `job ${newest.id} → ${newest.status.toUpperCase()}`;
        setToasts(prev => [...prev.slice(-3), { id, text, color }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
      }
    }
    prevEventCount.current = metrics.events.length;
  }, [metrics.events]);

  const pushToast = useCallback((text: string, color: string) => {
    const id = ++toastId.current;
    setToasts(prev => [...prev.slice(-3), { id, text, color }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/v1/auth/login', { username, password });
      localStorage.setItem('qf_token', res.data.token);
      setToken(res.data.token);
    } catch {
      alert('Login failed. Check backend is running.');
    }
  };

  const submitTestJob = async () => {
    try {
      await axios.post('/api/v1/queues/emails/jobs',
        { type: 'welcome_email', payload: { test: true } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      pushToast('Job injected into queue ✓', 'bg-amber-50 border-amber-200 text-amber-800');
    } catch {
      pushToast('Failed to inject job', 'bg-red-50 border-red-200 text-red-700');
    }
  };

  // ─── Login Screen ─────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #1c1008 0%, #3e2612 50%, #5c381a 100%)' }}>
        <div className="animate-fade-up bg-white/95 backdrop-blur p-8 rounded-2xl shadow-2xl border border-cream-200 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-mocha-800 flex items-center justify-center text-white text-sm font-bold">Q</div>
            <span className="font-mono font-semibold text-mocha-800">QueueForge Operator</span>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-mocha-400 mb-1.5">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 bg-cream-50 border border-cream-200 rounded-lg text-sm focus:outline-none focus:border-mocha-400 focus:ring-2 focus:ring-mocha-100 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-mocha-400 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-cream-50 border border-cream-200 rounded-lg text-sm focus:outline-none focus:border-mocha-400 focus:ring-2 focus:ring-mocha-100 transition-all" />
            </div>
            <button type="submit"
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-95"
              style={{ background: 'linear-gradient(135deg, #5c381a, #3e2612)' }}>
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  const dist = metrics.distribution;
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const statusBars = [
    { key: 'pending',     label: 'pending',     bg: 'bg-stone-400',  text: 'text-stone-600' },
    { key: 'running',     label: 'running',     bg: 'bg-amber-500',  text: 'text-amber-700' },
    { key: 'completed',   label: 'completed',   bg: 'bg-lime-600',   text: 'text-lime-700'  },
    { key: 'dead_letter', label: 'dead_letter', bg: 'bg-red-500',    text: 'text-red-600'   },
  ];

  const eventColor = (status: string) => {
    if (status === 'completed')   return 'text-lime-700';
    if (status === 'running')     return 'text-amber-600';
    if (status === 'failed' || status === 'dead_letter') return 'text-red-600';
    return 'text-mocha-500';
  };

  return (
    <div className="min-h-screen bg-cream-50">
      {/* ── Dark Chocolate Header ──────────────────────────── */}
      <header style={{ background: 'linear-gradient(135deg, #1c1008 0%, #3e2612 100%)' }}
        className="sticky top-0 z-20 shadow-xl">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-white/10 border border-white/20 flex items-center justify-center text-white text-xs font-bold font-mono">Q</div>
            <span className="font-mono text-sm font-semibold text-white/90">queueforge</span>
            <span className="text-white/30 text-sm">/</span>
            <span className="text-sm text-white/50">operator dashboard</span>
            <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-lime-500/20 border border-lime-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-400 live-dot" />
              <span className="text-[10px] font-mono text-lime-400">{isConnected ? 'live' : 'offline'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Demo Mode Toggle */}
            <div className="relative">
              <button
                id="btn-demo"
                onClick={() => setDemoMode(d => !d)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all active:scale-95 border ${
                  demoMode
                    ? 'bg-lime-500/20 border-lime-500/50 text-lime-300'
                    : 'bg-white/10 border-white/20 text-white/60 hover:text-white/90'
                }`}>
                {demoMode && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-lime-400 live-dot" />}
                {demoMode ? '⏹ Stop Demo' : '▶ Start Demo'}
              </button>
            </div>

            {/* Inject Job button */}
            <div className="relative">
              <button
                id="btn-inject"
                onClick={submitTestJob}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all active:scale-95 hover:shadow-md"
                style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff' }}>
                + Inject Job
              </button>
            </div>
            <span className="text-xs font-mono text-white/40">{time}</span>
            <button onClick={() => { localStorage.removeItem('qf_token'); setToken(null); }}
              className="text-xs font-mono text-white/30 hover:text-white/60 transition-colors">logout</button>
          </div>
        </div>
      </header>

      {/* ── Scrolling Ticker ──────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #2e1c0e, #3e2612)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
      }}>
        <div className="ticker-track">
          {[0, 1].map(i => (
            <div key={i} className="ticker-content">
              {[
                { icon: '⚙️', text: 'Production-grade distributed job queue built on PostgreSQL' },
                { icon: '🔒', text: 'FOR UPDATE SKIP LOCKED — atomic, race-condition-free job claiming' },
                { icon: '🔁', text: 'Exponential backoff retry with configurable max_attempts' },
                { icon: '☠️', text: 'Dead letter queue for permanently failed jobs' },
                { icon: '🩺', text: 'Reaper process auto-recovers stuck jobs from crashed workers' },
                { icon: '📡', text: 'Live WebSocket metrics streaming every 3 seconds' },
                { icon: '🐋', text: 'Fully containerised — 6 Docker services orchestrated by Compose' },
                { icon: '🔐', text: 'JWT-secured REST API with rate limiting middleware' },
                { icon: '⚡', text: 'Multi-worker concurrency tested at 3+ parallel processes' },
              ].map((item, j) => (
                <span key={j} className="ticker-item">
                  <span style={{ marginRight: '6px' }}>{item.icon}</span>
                  {item.text}
                  <span className="ticker-sep">◆</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

        {/* ── Stat Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Throughput/min"  value={metrics.throughput}          accent="bg-lime-500"   icon="⚡" loading={!isConnected && total === 1} />
          <StatCard label="Pending"         value={dist.pending ?? 0}           accent="bg-stone-400"  icon="⏳" loading={!isConnected && total === 1} />
          <StatCard label="Running"         value={dist.running ?? 0}           accent="bg-amber-500"  icon="⚙️" loading={!isConnected && total === 1} />
          <StatCard label="Dead Letter"     value={dist.dead_letter ?? 0}       accent="bg-red-500"    icon="☠️" loading={!isConnected && total === 1} />
          <StatCard label="Workers Online"  value={metrics.workers.length}      accent="bg-sky-400"    icon="🖥" loading={!isConnected && total === 1} />
        </div>

        {/* ── Charts Row ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Sparkline */}
          <div className="lg:col-span-2 card-hover bg-white rounded-xl border border-cream-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-mocha-800">Throughput — last 2 min</h2>
              <span className="text-[11px] font-mono text-mocha-300 bg-cream-100 px-2 py-0.5 rounded-full">jobs completed / 60s window</span>
            </div>
            <Sparkline data={sparkline} />
          </div>

          {/* Status Distribution */}
          <div className="card-hover bg-white rounded-xl border border-cream-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-mocha-800 mb-5">Status distribution</h2>
            <div className="space-y-4">
              {statusBars.map(s => {
                const val = dist[s.key] ?? 0;
                const pct = Math.round((val / total) * 100);
                return (
                  <div key={s.key}>
                    <div className="flex justify-between mb-1.5">
                      <span className={`text-[11px] font-mono ${s.text}`}>{s.label}</span>
                      <span className="text-[11px] font-mono text-mocha-400">{val}</span>
                    </div>
                    <div className="h-2 rounded-full bg-cream-100 overflow-hidden">
                      <div className={`h-full ${s.bg} rounded-full bar-transition`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Bottom Row ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Workers */}
          <div className="card-hover bg-white rounded-xl border border-cream-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-cream-200 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #2e1c0e, #3e2612)' }}>
              <h2 className="text-sm font-semibold text-white/90">Workers</h2>
              <span className="text-[11px] font-mono text-white/40">{metrics.workers.length} online</span>
            </div>
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-mocha-400 border-b border-cream-200 bg-cream-50">
                  <th className="text-left font-normal px-5 py-2.5">id</th>
                  <th className="text-left font-normal px-5 py-2.5">status</th>
                  <th className="text-left font-normal px-5 py-2.5">job</th>
                  <th className="text-left font-normal px-5 py-2.5">heartbeat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {metrics.workers.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-6 text-center text-mocha-300">No active workers</td></tr>
                ) : (
                  metrics.workers.map(w => (
                    <tr key={w.id} className="hover:bg-cream-50 transition-colors">
                      <td className="px-5 py-2.5 text-mocha-700">{w.id}</td>
                      <td className="px-5 py-2.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${w.status === 'online' ? 'bg-lime-500 glow-green' : 'bg-stone-300'}`} />
                          <span className={w.status === 'online' ? 'text-lime-700' : 'text-mocha-400'}>{w.status}</span>
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-mocha-400">{w.job}</td>
                      <td className="px-5 py-2.5 text-mocha-400">{w.hb}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Live Event Feed */}
          <div className="lg:col-span-2 card-hover bg-white rounded-xl border border-cream-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-cream-200 flex items-center justify-between flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #2e1c0e, #3e2612)' }}>
              <h2 className="text-sm font-semibold text-white/90">Live event feed</h2>
              <span className="text-[11px] font-mono text-white/40">job_events · tail -f</span>
            </div>
            <div className="font-mono text-xs divide-y divide-cream-100 max-h-72 overflow-y-auto flex-1">
              {metrics.events.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-mocha-300">
                  <div className="text-4xl mb-3 opacity-20">📭</div>
                  <p>No jobs processed yet.</p>
                  <p className="text-[10px] mt-1 opacity-70">Inject a job or start the demo to see events.</p>
                </div>
              ) : (
                metrics.events.map((ev, idx) => (
                  <div key={`${ev.id}-${idx}`} className="animate-row-enter px-5 py-2.5 flex items-center gap-4 hover:bg-cream-50 transition-colors">
                    <span className="text-mocha-300 whitespace-nowrap tabular-nums">{ev.time}</span>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-current opacity-60"
                      style={{ color: ev.status === 'completed' ? '#65a30d' : ev.status === 'failed' || ev.status === 'dead_letter' ? '#dc2626' : '#d97706' }} />
                    <span className={`${eventColor(ev.status)} font-medium`}>
                      job <span className="text-mocha-600">{ev.id}</span> transitioned to{' '}
                      <span className="font-bold">{ev.status.toUpperCase()}</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── About Architecture ───────────────────────────── */}
        <div className="card-hover bg-white rounded-xl border border-cream-200 shadow-sm overflow-hidden p-6">
          <ArchDiagram />
        </div>

      </main>

      {/* ── Toast Notifications */}
      <ToastContainer toasts={toasts} />

      {/* ── Recruiter Guide Modal */}
      <RecruiterGuide />
    </div>
  );
}

export default App;
