import { useState } from 'react';

const STORAGE_KEY = 'qf_guide_seen';

export function RecruiterGuide() {
  const [open, setOpen] = useState(() => !localStorage.getItem(STORAGE_KEY));

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  };

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'backdropIn 0.3s ease forwards',
      }}
    >
      {/* Modal — stop click propagation so only backdrop click dismisses */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(145deg, #faf9f6 0%, #f5f3eb 100%)',
          border: '1px solid #e9e4d5',
          borderRadius: '18px',
          padding: '36px',
          maxWidth: '420px',
          width: '90%',
          boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
          animation: 'modalIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #3e2612, #1c1008)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px',
          }}>⚙️</div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#2b1a0d' }}>QueueForge Live Demo</div>
            <div style={{ fontSize: '12px', color: '#8b5a2b', marginTop: '2px' }}>Distributed job queue system</div>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#5c381a', lineHeight: 1.7, margin: '16px 0 24px' }}>
          Watch a <strong>real distributed system</strong> process jobs across multiple workers with crash recovery, retries, and live WebSocket updates.
        </p>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
          <Step
            icon="🚀"
            title="Click ▶ Start Demo"
            desc="Auto-injects jobs every 2s — watch the entire system spring to life"
            accent="#d97706"
          />
          <Step
            icon="👆"
            title="Click + Inject Job"
            desc="Manually fire a single job and see workers pick it up in real time"
            accent="#65a30d"
          />
          <Step
            icon="📡"
            title="Watch the Live Feed"
            desc="Every job transition streams instantly via WebSocket — no refresh needed"
            accent="#0ea5e9"
          />
        </div>

        {/* CTA */}
        <button
          onClick={dismiss}
          style={{
            width: '100%', padding: '12px',
            background: 'linear-gradient(135deg, #3e2612, #1c1008)',
            color: '#fef3c7', border: 'none', borderRadius: '10px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            letterSpacing: '0.02em',
            transition: 'transform 0.15s, box-shadow 0.15s',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
            (e.target as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.target as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
          }}
        >
          Let me explore →
        </button>

        <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px', color: '#a8a29e' }}>
          Click anywhere outside to close
        </div>
      </div>
    </div>
  );
}

function Step({ icon, title, desc, accent }: { icon: string; title: string; desc: string; accent: string }) {
  return (
    <div style={{
      display: 'flex', gap: '12px', alignItems: 'flex-start',
      background: 'white', borderRadius: '10px', padding: '12px 14px',
      border: '1px solid #e9e4d5',
      boxShadow: '0 2px 8px rgba(92,56,26,0.06)',
    }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
        background: accent + '18', border: `1px solid ${accent}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#2b1a0d' }}>{title}</div>
        <div style={{ fontSize: '11px', color: '#724621', marginTop: '3px', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}
