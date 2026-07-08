import React from 'react';

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
  delay?: number;
}

export function MetricCard({ title, value, icon, trend, color = 'var(--accent-primary)', delay = 0 }: MetricCardProps) {
  return (
    <div 
      className="glass-panel animate-in" 
      style={{ 
        padding: '1.5rem', 
        borderLeft: `4px solid ${color}`,
        animationDelay: `${delay}s`
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>{title}</h3>
        <div style={{ color }}>{icon}</div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {value}
        </div>
        {trend && (
          <div style={{ fontSize: '0.85rem', color: trend.startsWith('+') ? 'var(--status-completed)' : 'var(--text-secondary)' }}>
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}
