import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { api } from '../api';

interface HistoricalMetric {
  time: string;
  completed: number;
  dead_letter: number;
}

interface AnalyticsChartsProps {
  selectedQueue: string;
}

export function AnalyticsCharts({ selectedQueue }: AnalyticsChartsProps) {
  const [data, setData] = useState<HistoricalMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'30' | '1440' | 'all'>('30');

  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedQueue) return;
      try {
        const res = await api.get(`/api/v1/metrics/history?timeframe=${timeframe}&queue=${selectedQueue}`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch historical metrics', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
    // Poll every 10 seconds for updated history
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, [selectedQueue, timeframe]);

  if (loading && data.length === 0) {
    return (
      <div className="card-hover bg-white border border-cream-200 rounded-xl p-6 h-64 flex items-center justify-center animate-pulse mb-1">
        <span className="text-mocha-400 font-mono text-sm">Loading historical data...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="card-hover bg-white border border-cream-200 shadow-sm rounded-xl p-6 h-64 flex items-center justify-center mb-1">
        <span className="text-mocha-400 font-mono text-sm">No historical data in the last 30 minutes.</span>
      </div>
    );
  }

  return (
    <div className="mb-8">
      {/* Timeframe Toggle */}
      <div className="flex justify-end mb-3">
        <div className="inline-flex bg-cream-100 rounded-lg p-1 border border-cream-200">
          <button 
            onClick={() => setTimeframe('30')}
            className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-md transition-all ${timeframe === '30' ? 'bg-white shadow-sm text-mocha-800' : 'text-mocha-400 hover:text-mocha-600'}`}
          >
            30 Min
          </button>
          <button 
            onClick={() => setTimeframe('1440')}
            className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-md transition-all ${timeframe === '1440' ? 'bg-white shadow-sm text-mocha-800' : 'text-mocha-400 hover:text-mocha-600'}`}
          >
            24 Hours
          </button>
          <button 
            onClick={() => setTimeframe('all')}
            className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-md transition-all ${timeframe === 'all' ? 'bg-white shadow-sm text-mocha-800' : 'text-mocha-400 hover:text-mocha-600'}`}
          >
            All Time
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-1">
        {/* Throughput Area Chart */}
      <div className="card-hover bg-white rounded-xl border border-cream-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-mocha-800 mb-4">Throughput History (Last 30 Min)</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#65a30d" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#65a30d" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
              <XAxis dataKey="time" stroke="#a8a29e" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis stroke="#a8a29e" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e5e5', borderRadius: '0.5rem', fontSize: '12px', color: '#44403c' }}
                itemStyle={{ color: '#44403c' }}
              />
              <Area type="monotone" dataKey="completed" stroke="#65a30d" strokeWidth={2} fillOpacity={1} fill="url(#colorCompleted)" name="Completed Jobs" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Failure Bar Chart */}
      <div className="card-hover bg-white rounded-xl border border-cream-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-mocha-800 mb-4">Failure History (Last 30 Min)</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
              <XAxis dataKey="time" stroke="#a8a29e" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis stroke="#a8a29e" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e5e5', borderRadius: '0.5rem', fontSize: '12px', color: '#44403c' }}
                itemStyle={{ color: '#44403c' }}
              />
              <Bar dataKey="dead_letter" fill="#ef4444" name="Failed Jobs (DLQ)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      </div>
    </div>
  );
}
