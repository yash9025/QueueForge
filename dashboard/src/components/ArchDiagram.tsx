import React from 'react';

export function ArchDiagram() {
  return (
    <div className="bg-cream-100 rounded-xl p-6 border border-cream-200 shadow-inner flex flex-col items-center">
      <h3 className="text-sm font-mono font-bold text-mocha-800 mb-6 uppercase tracking-wider text-center">
        System Architecture
      </h3>
      <svg viewBox="0 0 800 300" className="w-full max-w-2xl h-auto" style={{ fontFamily: 'var(--font-mono)' }}>
        
        {/* Gradients */}
        <defs>
          <linearGradient id="clientGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>
          <linearGradient id="apiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
          <linearGradient id="dbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d9f99d" />
            <stop offset="100%" stopColor="#bef264" />
          </linearGradient>
          <linearGradient id="workerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="reaperGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fecaca" />
            <stop offset="100%" stopColor="#fca5a5" />
          </linearGradient>

          {/* Arrowhead */}
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#8a7362" />
          </marker>
        </defs>

        {/* Connections */}
        <g stroke="#8a7362" strokeWidth="2" strokeDasharray="4 4" fill="none" markerEnd="url(#arrowhead)">
          <path d="M 120 150 L 230 150" /> {/* Client -> API */}
          <path d="M 360 150 L 470 150" /> {/* API -> DB */}
          
          <path d="M 690 90 L 590 140" /> {/* Worker 1 -> DB */}
          <path d="M 690 150 L 590 150" /> {/* Worker 2 -> DB */}
          <path d="M 690 210 L 590 160" /> {/* Worker 3 -> DB */}
          
          <path d="M 530 250 L 530 200" /> {/* Reaper -> DB */}
        </g>

        <g fill="#5c381a" fontSize="10" fontWeight="bold">
          <text x="145" y="140">POST /jobs</text>
          <text x="385" y="140">INSERT</text>
          <text x="610" y="125">SKIP LOCKED</text>
          <text x="540" y="235">Clean Stuck Jobs</text>
        </g>

        {/* Nodes */}
        <g stroke="#a89587" strokeWidth="1">
          {/* Client */}
          <rect x="20" y="120" width="100" height="60" rx="8" fill="url(#clientGrad)" />
          <text x="70" y="150" textAnchor="middle" fill="#5c381a" fontSize="14" fontWeight="bold">Client</text>
          
          {/* API */}
          <rect x="240" y="120" width="120" height="60" rx="8" fill="url(#apiGrad)" />
          <text x="300" y="145" textAnchor="middle" fill="#0c4a6e" fontSize="14" fontWeight="bold">REST API</text>
          <text x="300" y="160" textAnchor="middle" fill="#0369a1" fontSize="10">Express + JWT</text>

          {/* Database */}
          <rect x="480" y="100" width="100" height="100" rx="50" fill="url(#dbGrad)" />
          <text x="530" y="145" textAnchor="middle" fill="#3f6212" fontSize="14" fontWeight="bold">Postgres</text>
          <text x="530" y="160" textAnchor="middle" fill="#4d7c0f" fontSize="10">Single Source</text>

          {/* Workers */}
          <rect x="700" y="60" width="80" height="40" rx="6" fill="url(#workerGrad)" />
          <text x="740" y="84" textAnchor="middle" fill="#334155" fontSize="12" fontWeight="bold">Worker 1</text>
          
          <rect x="700" y="130" width="80" height="40" rx="6" fill="url(#workerGrad)" />
          <text x="740" y="154" textAnchor="middle" fill="#334155" fontSize="12" fontWeight="bold">Worker 2</text>
          
          <rect x="700" y="200" width="80" height="40" rx="6" fill="url(#workerGrad)" />
          <text x="740" y="224" textAnchor="middle" fill="#334155" fontSize="12" fontWeight="bold">Worker 3</text>

          {/* Reaper */}
          <rect x="480" y="260" width="100" height="40" rx="6" fill="url(#reaperGrad)" />
          <text x="530" y="284" textAnchor="middle" fill="#7f1d1d" fontSize="12" fontWeight="bold">Reaper</text>
        </g>
      </svg>
    </div>
  );
}
