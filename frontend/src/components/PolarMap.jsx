import React from 'react';
import { Compass, MapPin } from 'lucide-react';

export default function PolarMap({ sites, selectedSiteId, onSelectSite }) {
  // Polar Stereographic Projection for South Pole:
  // lat in [-90, -80]
  // colat = 90 + lat
  // r_proj = radius * (colat / 10)  where 10 deg is max radius (80°S to 90°S)
  const size = 320;
  const center = size / 2;
  const maxRadius = center - 24;

  const project = (lat, lon) => {
    const colat = Math.max(0, 90 + lat); // 0 at South Pole, 10 at 80°S
    const r = (colat / 10.0) * maxRadius;
    const lonRad = (lon * Math.PI) / 180.0;
    // Basis: x = r * sin(lon), y = -r * cos(lon)
    const x = center + r * Math.sin(lonRad);
    const y = center - r * Math.cos(lonRad);
    return { x, y };
  };

  const polarSites = sites.filter(s => Math.abs(s.lat_deg) >= 80);

  return (
    <div className="telemetry-card p-4 flex flex-col items-center">
      <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-[#202533]">
        <div className="flex items-center space-x-1.5">
          <Compass className="w-3.5 h-3.5 text-[#E5A93C]" />
          <span className="text-xs font-semibold tracking-wide uppercase font-mono text-white">
            South Polar Map (80°S–90°S)
          </span>
        </div>
        <span className="text-[10px] text-[#8B93A7] font-mono">10 Curated Polar Sites</span>
      </div>

      <div className="relative">
        <svg width={size} height={size} className="block select-none">
          {/* Background disc */}
          <circle cx={center} cy={center} r={maxRadius} fill="#0E1117" stroke="#222836" strokeWidth="1.5" />

          {/* Latitude rings: 80°S, 85°S, 88°S */}
          <circle cx={center} cy={center} r={maxRadius * (5 / 10)} fill="none" stroke="#1D2330" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={center} cy={center} r={maxRadius * (2 / 10)} fill="none" stroke="#1D2330" strokeWidth="1" strokeDasharray="3 3" />

          {/* Latitude labels */}
          <text x={center + 4} y={center - maxRadius + 12} fill="#4B5563" fontSize="9" fontFamily="monospace">80°S</text>
          <text x={center + 4} y={center - maxRadius * 0.5 + 12} fill="#4B5563" fontSize="9" fontFamily="monospace">85°S</text>
          <text x={center + 4} y={center - maxRadius * 0.2 + 12} fill="#4B5563" fontSize="9" fontFamily="monospace">88°S</text>

          {/* Longitude axes */}
          <line x1={center} y1={center - maxRadius} x2={center} y2={center + maxRadius} stroke="#1A202C" strokeWidth="1" />
          <line x1={center - maxRadius} y1={center} x2={center + maxRadius} y2={center} stroke="#1A202C" strokeWidth="1" />

          <text x={center - 12} y={center - maxRadius - 6} fill="#64748B" fontSize="9" fontFamily="monospace">0°</text>
          <text x={center + maxRadius + 4} y={center + 3} fill="#64748B" fontSize="9" fontFamily="monospace">90°E</text>
          <text x={center - 16} y={center + maxRadius + 14} fill="#64748B" fontSize="9" fontFamily="monospace">180°</text>
          <text x={center - maxRadius - 28} y={center + 3} fill="#64748B" fontSize="9" fontFamily="monospace">270°W</text>

          {/* South Pole crosshair */}
          <circle cx={center} cy={center} r={2} fill="#E5A93C" />

          {/* Plot polar landing sites */}
          {polarSites.map(site => {
            const { x, y } = project(site.lat_deg, site.lon_deg);
            const isSelected = site.id === selectedSiteId;
            return (
              <g
                key={site.id}
                onClick={() => onSelectSite(site.id)}
                className="cursor-pointer group"
              >
                {isSelected && (
                  <circle cx={x} cy={y} r={10} fill="none" stroke="#E5A93C" strokeWidth="1.5" className="animate-ping opacity-50" />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 5 : 3.5}
                  fill={isSelected ? '#E5A93C' : '#3E7BFA'}
                  stroke="#FFFFFF"
                  strokeWidth={isSelected ? 1.5 : 0.8}
                  className="transition-transform group-hover:scale-125"
                />
                {/* Short label */}
                <text
                  x={x + 7}
                  y={y + 3}
                  fill={isSelected ? '#F5C35E' : '#94A3B8'}
                  fontSize={isSelected ? '10' : '8.5'}
                  fontFamily="monospace"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                >
                  {site.name.split('(')[0].replace('Ridge', 'Rdg').trim()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 text-[10px] text-[#64748B] text-center font-mono">
        Click any marker to inspect its local skyline & telemetry
      </div>
    </div>
  );
}
