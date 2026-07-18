import { useEffect, useState } from 'react';
import { Shield, Battery, Navigation, Radio } from 'lucide-react';

export function TelemetryMap({ assets = [], selectedAssetId, onSelectAsset }) {
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(p => !p);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Standard locations for Ahmedabad/Gujarat seed data mockup
  const locations = [
    { id: '1', label: 'Ahmedabad Hub (HQ)', x: 150, y: 120, type: 'HUB' },
    { id: '2', label: 'Asset SN-DSLR-01 (Bob)', x: 280, y: 220, type: 'RENTAL', battery: 84 },
    { id: '3', label: 'Asset SN-DRILL-01 (Alice)', x: 110, y: 310, type: 'RENTAL', battery: 92 },
    { id: '4', label: 'Asset SN-PROJECTOR-01', x: 390, y: 140, type: 'MAINTENANCE', battery: 45 },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Radio className={`size-4 text-primary ${pulse ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-semibold tracking-wide uppercase">IoT Live Telemetry & Dispatch Grid</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="size-3.5 text-primary" />
          <span>Real-time GPS Encrypted Link</span>
        </div>
      </div>

      <div className="relative h-[320px] bg-slate-950/90 dark:bg-black">
        {/* Map grid lines */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/40 via-transparent to-transparent" />
        <div 
          className="absolute inset-0 opacity-[0.07]" 
          style={{
            backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />

        <svg className="absolute inset-0 h-full w-full">
          {/* TSP Route Paths */}
          <path
            d="M 150 120 L 280 220 L 390 140 L 110 310 Z"
            fill="none"
            stroke="rgba(16, 185, 129, 0.2)"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="animate-[dash_20s_linear_infinite]"
          />
          
          {/* Locations markers */}
          {locations.map(loc => {
            const isSelected = selectedAssetId === loc.id;
            return (
              <g 
                key={loc.id} 
                className="cursor-pointer group"
                onClick={() => onSelectAsset?.(loc.id)}
              >
                {/* Glow ring */}
                <circle
                  cx={loc.x}
                  cy={loc.y}
                  r={isSelected ? 16 : 8}
                  fill={loc.type === 'HUB' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)'}
                  className="transition-all duration-300"
                />
                
                {/* Core dot */}
                <circle
                  cx={loc.x}
                  cy={loc.y}
                  r={loc.type === 'HUB' ? 6 : 4}
                  fill={loc.type === 'HUB' ? '#3b82f6' : '#10b981'}
                  className="transition-all duration-300"
                />

                {/* Tooltip on hover */}
                <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <rect
                    x={loc.x - 70}
                    y={loc.y - 45}
                    width="140"
                    height="32"
                    rx="4"
                    fill="rgba(15, 23, 42, 0.95)"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="1"
                  />
                  <text
                    x={loc.x}
                    y={loc.y - 25}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="10"
                    fontFamily="sans-serif"
                    fontWeight="medium"
                  >
                    {loc.label}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Selected asset floating panel */}
        {selectedAssetId && (
          <div className="absolute bottom-3 left-3 max-w-[240px] rounded-lg border border-border bg-slate-900/90 p-3 text-xs text-white backdrop-blur-md">
            <h4 className="font-semibold text-primary">
              {locations.find(l => l.id === selectedAssetId)?.label || 'Selected Location'}
            </h4>
            <div className="mt-1.5 flex items-center justify-between gap-4 text-slate-400">
              <span className="flex items-center gap-1">
                <Navigation className="size-3 text-sky-400" /> 23.02° N, 72.57° E
              </span>
              {locations.find(l => l.id === selectedAssetId)?.battery && (
                <span className="flex items-center gap-1">
                  <Battery className="size-3 text-emerald-400" /> 
                  {locations.find(l => l.id === selectedAssetId)?.battery}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
