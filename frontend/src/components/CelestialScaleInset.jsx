import React, { useState } from 'react';
import { Eye, Disc, Maximize2, Layers } from 'lucide-react';

/**
 * True-Scale Celestial Inset (1:1 Isotropic Viewport)
 * Renders Sun (0.53° angular diameter) and Earth (1.91° angular diameter)
 * without vertical exaggeration. Accurately evaluates topocentric angular separation,
 * solar eclipse disc occultation %, and local terrain ridge clipping.
 */
export default function CelestialScaleInset({
  instantSample,
  terrainElevation = 0,
  proMode = false
}) {
  const [fovDeg, setFovDeg] = useState(4); // 2°, 4°, 8°, 16°
  const [focusTarget, setFocusTarget] = useState('both'); // 'both', 'sun', 'earth'

  const sun = instantSample?.sun || { azimuth_deg: 180, elevation_deg: 1.0, clearance_deg: 1.0 };
  const earth = instantSample?.earth || { azimuth_deg: 90, elevation_deg: 4.0, clearance_deg: 4.0 };

  // Angular radii in degrees
  const rSunDeg = 0.533 / 2; // ~0.2665°
  const rEarthDeg = 1.910 / 2; // ~0.955°

  // Topocentric angular separation between Sun and Earth
  const toRad = Math.PI / 180;
  const sunAzRad = sun.azimuth_deg * toRad;
  const sunElRad = sun.elevation_deg * toRad;
  const earthAzRad = earth.azimuth_deg * toRad;
  const earthElRad = earth.elevation_deg * toRad;

  const cosSep = Math.sin(sunElRad) * Math.sin(earthElRad) +
                 Math.cos(sunElRad) * Math.cos(earthElRad) * Math.cos(sunAzRad - earthAzRad);
  const sepDeg = Math.acos(Math.max(-1, Math.min(1, cosSep))) * (180 / Math.PI);

  // Exact Solar Eclipse disc occultation calculation
  let occultationPct = 0;
  const d = sepDeg;
  const r = rSunDeg;
  const R = rEarthDeg;

  if (d <= R - r) {
    // Sun is completely blocked by Earth's shadow / disc
    occultationPct = 100;
  } else if (d < r + R) {
    // Partial circle-circle overlap area
    const part1 = r * r * Math.acos((d * d + r * r - R * R) / (2 * d * r));
    const part2 = R * R * Math.acos((d * d + R * R - r * r) / (2 * d * R));
    const part3 = 0.5 * Math.sqrt(Math.max(0, (-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R)));
    const overlapArea = part1 + part2 - part3;
    const sunArea = Math.PI * r * r;
    occultationPct = Math.min(100, Math.max(0, (overlapArea / sunArea) * 100));
  }

  // Fraction of solar disc above local skyline
  const sunSkylineClearing = Math.max(0, Math.min(1, (sun.clearance_deg + rSunDeg) / (2 * rSunDeg))) * 100;
  const earthSkylineClearing = Math.max(0, Math.min(1, (earth.clearance_deg + rEarthDeg) / (2 * rEarthDeg))) * 100;

  // Viewport projection coordinates
  const viewportWidth = 460;
  const viewportHeight = 200;
  const pixelsPerDegree = viewportHeight / fovDeg;

  // Center coordinate determination based on focus
  let centerAz = (sun.azimuth_deg + earth.azimuth_deg) / 2;
  let centerEl = (sun.elevation_deg + earth.elevation_deg) / 2;

  // Handle azimuth wrap-around if separation is near 0/360
  if (Math.abs(sun.azimuth_deg - earth.azimuth_deg) > 180) {
    centerAz = ((sun.azimuth_deg + earth.azimuth_deg + 360) / 2) % 360;
  }

  if (focusTarget === 'sun') {
    centerAz = sun.azimuth_deg;
    centerEl = sun.elevation_deg;
  } else if (focusTarget === 'earth') {
    centerAz = earth.azimuth_deg;
    centerEl = earth.elevation_deg;
  }

  // Helper to project (az, el) to viewport SVG pixels
  const project = (az, el) => {
    let dAz = az - centerAz;
    if (dAz > 180) dAz -= 360;
    if (dAz < -180) dAz += 360;
    const x = viewportWidth / 2 + dAz * pixelsPerDegree;
    const y = viewportHeight / 2 - (el - centerEl) * pixelsPerDegree;
    return { x, y };
  };

  const sunPt = project(sun.azimuth_deg, sun.elevation_deg);
  const earthPt = project(earth.azimuth_deg, earth.elevation_deg);
  const sunRadiusPx = rSunDeg * pixelsPerDegree;
  const earthRadiusPx = rEarthDeg * pixelsPerDegree;

  // Geometric 0° horizon line Y position
  const horizonPt = project(centerAz, 0.0);

  return (
    <div className="aerospace-panel p-5 font-mono">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-[#1A202E] gap-2">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-[#E5A93C]" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">
            True-Scale 1:1 Celestial Inset
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#10141D] border border-[#222B3D] text-slate-300">
            Isotropic View (No Vert Exaggeration)
          </span>
        </div>

        {/* Focus & FOV Controls */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1 bg-[#090C12] p-0.5 rounded border border-[#1A202E]">
            <button
              onClick={() => setFocusTarget('both')}
              className={`px-2 py-1 rounded transition-colors ${
                focusTarget === 'both' ? 'bg-[#181E2E] text-[#E5A93C] font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Both
            </button>
            <button
              onClick={() => setFocusTarget('sun')}
              className={`px-2 py-1 rounded transition-colors ${
                focusTarget === 'sun' ? 'bg-[#181E2E] text-[#E5A93C] font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sun
            </button>
            <button
              onClick={() => setFocusTarget('earth')}
              className={`px-2 py-1 rounded transition-colors ${
                focusTarget === 'earth' ? 'bg-[#181E2E] text-[#E5A93C] font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Earth
            </button>
          </div>

          <div className="flex items-center space-x-1 bg-[#090C12] p-0.5 rounded border border-[#1A202E]">
            <span className="text-[10px] text-slate-400 px-1">FOV:</span>
            {[2, 4, 8, 16].map((fov) => (
              <button
                key={fov}
                onClick={() => setFovDeg(fov)}
                className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                  fovDeg === fov ? 'bg-[#E5A93C] text-black font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {fov}°
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 1:1 Canvas Viewport */}
      <div className="relative w-full h-[200px] bg-[#05070B] rounded-lg overflow-hidden border border-[#161C28] shadow-inner">
        <svg className="w-full h-full" viewBox={`0 0 ${viewportWidth} ${viewportHeight}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Sun Glow */}
            <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFF9E6" stopOpacity="1" />
              <stop offset="40%" stopColor="#F59E0B" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#D97706" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#B45309" stopOpacity="0" />
            </radialGradient>

            {/* Earth Optical Atmosphere / Phase */}
            <radialGradient id="earthDisc" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#60A5FA" stopOpacity="1" />
              <stop offset="45%" stopColor="#2563EB" stopOpacity="0.9" />
              <stop offset="85%" stopColor="#1E3A8A" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0B132B" stopOpacity="0.95" />
            </radialGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1={viewportHeight / 2} x2={viewportWidth} y2={viewportHeight / 2} stroke="#1A2234" strokeDasharray="3 3" />
          <line x1={viewportWidth / 2} y1="0" x2={viewportWidth / 2} y2={viewportHeight} stroke="#1A2234" strokeDasharray="3 3" />

          {/* Astronomical 0° Horizon Line */}
          {horizonPt.y >= 0 && horizonPt.y <= viewportHeight && (
            <g>
              <line x1="0" y1={horizonPt.y} x2={viewportWidth} y2={horizonPt.y} stroke="#3B82F6" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
              <text x="8" y={horizonPt.y - 4} fill="#60A5FA" fontSize="9" opacity="0.8">0.0° Astronomical Horizon</text>
            </g>
          )}

          {/* Sun Disc */}
          <g transform={`translate(${sunPt.x}, ${sunPt.y})`}>
            {/* Corona halo */}
            <circle cx="0" cy="0" r={sunRadiusPx * 2.2} fill="url(#sunGlow)" />
            {/* Core Photosphere */}
            <circle cx="0" cy="0" r={sunRadiusPx} fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1" />
            <text x={sunRadiusPx + 4} y="3" fill="#F59E0B" fontSize="9" fontWeight="bold">
              Sun (0.53°)
            </text>
          </g>

          {/* Earth Disc */}
          <g transform={`translate(${earthPt.x}, ${earthPt.y})`}>
            <circle cx="0" cy="0" r={earthRadiusPx * 1.15} fill="#3B82F6" opacity="0.2" />
            <circle cx="0" cy="0" r={earthRadiusPx} fill="url(#earthDisc)" stroke="#38BDF8" strokeWidth="1" />
            <text x={earthRadiusPx + 4} y="3" fill="#38BDF8" fontSize="9" fontWeight="bold">
              Earth (1.91°)
            </text>
          </g>

          {/* Scale Bar in Bottom Right */}
          <g transform={`translate(${viewportWidth - 110}, ${viewportHeight - 20})`}>
            <line x1="0" y1="0" x2={pixelsPerDegree} y2="0" stroke="#94A3B8" strokeWidth="2" />
            <line x1="0" y1="-3" x2="0" y2="3" stroke="#94A3B8" strokeWidth="1.5" />
            <line x1={pixelsPerDegree} y1="-3" x2={pixelsPerDegree} y2="3" stroke="#94A3B8" strokeWidth="1.5" />
            <text x={pixelsPerDegree / 2} y="-5" textAnchor="middle" fill="#94A3B8" fontSize="9">
              1.0° Scale
            </text>
          </g>
        </svg>

        {/* Live Eclipse Warning Banner */}
        {occultationPct > 0 && (
          <div className="absolute top-2 left-2 bg-[#DC2626]/20 border border-[#DC2626]/50 text-[#F87171] px-2.5 py-1 rounded text-xs font-bold flex items-center space-x-1.5 backdrop-blur-sm animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#DC2626]"></span>
            <span>SOLAR ECLIPSE OCCULTATION: {occultationPct.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* Physics Readouts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs pt-3 border-t border-[#161C28]">
        <div className="bg-[#090C12] p-2.5 rounded border border-[#1A2234]">
          <div className="text-slate-400 text-[10px]">ANGULAR SEPARATION</div>
          <div className="text-white font-bold text-sm mt-0.5">{sepDeg.toFixed(2)}°</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Topocentric center-to-center</div>
        </div>

        <div className="bg-[#090C12] p-2.5 rounded border border-[#1A2234]">
          <div className="text-slate-400 text-[10px]">SOLAR DISC OCCULTED</div>
          <div className={`font-bold text-sm mt-0.5 ${occultationPct > 0 ? 'text-[#F87171]' : 'text-[#10B981]'}`}>
            {occultationPct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Earth shadow cross-section</div>
        </div>

        <div className="bg-[#090C12] p-2.5 rounded border border-[#1A2234]">
          <div className="text-slate-400 text-[10px]">SUN DISC ABOVE SKYLINE</div>
          <div className={`font-bold text-sm mt-0.5 ${sunSkylineClearing >= 100 ? 'text-[#10B981]' : sunSkylineClearing > 0 ? 'text-[#E5A93C]' : 'text-slate-400'}`}>
            {sunSkylineClearing.toFixed(0)}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Clearance: {sun.clearance_deg >= 0 ? `+${sun.clearance_deg.toFixed(2)}°` : `${sun.clearance_deg.toFixed(2)}°`}</div>
        </div>

        <div className="bg-[#090C12] p-2.5 rounded border border-[#1A2234]">
          <div className="text-slate-400 text-[10px]">EARTH DISC VISIBLE</div>
          <div className={`font-bold text-sm mt-0.5 ${earthSkylineClearing >= 100 ? 'text-[#10B981]' : earthSkylineClearing > 0 ? 'text-[#E5A93C]' : 'text-slate-400'}`}>
            {earthSkylineClearing.toFixed(0)}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Clearance: {earth.clearance_deg >= 0 ? `+${earth.clearance_deg.toFixed(2)}°` : `${earth.clearance_deg.toFixed(2)}°`}</div>
        </div>
      </div>
    </div>
  );
}
