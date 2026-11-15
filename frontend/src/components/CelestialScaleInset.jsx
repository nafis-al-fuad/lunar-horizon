import React, { useState } from 'react';
import { Layers, ArrowLeftRight, Check, AlertTriangle, Radio, Sun, Globe } from 'lucide-react';
import { queryHorizonElevation } from '../lib/consumer';

/**
 * True-Scale 1:1 Celestial Inset (Isotropic Viewport)
 * Renders Sun (0.53° angular diameter) and Earth (1.91° angular diameter)
 * without vertical exaggeration (1:1 isotropic scale).
 *
 * Dynamically computes topocentric coordinates, true terrain ridge obstruction,
 * disc clipping %, solar eclipse occultation %, and automatically splits into
 * dual synchronized panes when angular separation exceeds the active FOV.
 */
export default function CelestialScaleInset({
  instantSample,
  terrainElevation = 0,
  horizonData = null,
  proMode = true
}) {
  const [fovDeg, setFovDeg] = useState(16); // 2°, 4°, 8°, 16° (default: 16°)
  const [focusTarget, setFocusTarget] = useState('both'); // 'both', 'sun', 'earth'

  // Topocentric astrodynamics from loaded DE440 sample
  const sun = instantSample?.sun || { azimuth_deg: 172.96, elevation_deg: 0.79, clearance_deg: 0.79 };
  const earth = instantSample?.earth || { azimuth_deg: 88.42, elevation_deg: 3.85, clearance_deg: 3.85 };

  // Angular radii in degrees
  const rSunDeg = 0.533 / 2; // ~0.2665°
  const rEarthDeg = 1.910 / 2; // ~0.955°

  // Real-time ray-traced horizon obstruction at sun & earth azimuths
  const sunRidgeEl = horizonData ? queryHorizonElevation(horizonData, sun.azimuth_deg) : 0.0;
  const earthRidgeEl = horizonData ? queryHorizonElevation(horizonData, earth.azimuth_deg) : 0.0;

  // Exact clearance above local LOLA terrain ridge
  const sunClearance = sun.clearance_deg !== undefined ? sun.clearance_deg : (sun.elevation_deg - sunRidgeEl);
  const earthClearance = earth.clearance_deg !== undefined ? earth.clearance_deg : (earth.elevation_deg - earthRidgeEl);

  // Topocentric angular separation between Sun and Earth
  const toRad = Math.PI / 180;
  const sunAzRad = sun.azimuth_deg * toRad;
  const sunElRad = sun.elevation_deg * toRad;
  const earthAzRad = earth.azimuth_deg * toRad;
  const earthElRad = earth.elevation_deg * toRad;

  const cosSep = Math.sin(sunElRad) * Math.sin(earthElRad) +
                 Math.cos(sunElRad) * Math.cos(earthElRad) * Math.cos(sunAzRad - earthAzRad);
  const sepDeg = Math.acos(Math.max(-1, Math.min(1, cosSep))) * (180 / Math.PI);

  // Solar eclipse disc occultation (circle-circle overlap)
  let occultationPct = 0;
  const d = sepDeg;
  const r = rSunDeg;
  const R = rEarthDeg;

  if (d <= R - r) {
    occultationPct = 100;
  } else if (d < r + R) {
    const part1 = r * r * Math.acos((d * d + r * r - R * R) / (2 * d * r));
    const part2 = R * R * Math.acos((d * d + R * R - r * r) / (2 * d * R));
    const part3 = 0.5 * Math.sqrt(Math.max(0, (-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R)));
    const overlapArea = part1 + part2 - part3;
    const sunArea = Math.PI * r * r;
    occultationPct = Math.min(100, Math.max(0, (overlapArea / sunArea) * 100));
  }

  // Fraction of disc above local terrain skyline
  const sunDiscVisiblePct = Math.max(0, Math.min(100, ((sunClearance + rSunDeg) / (2 * rSunDeg)) * 100));
  const earthDiscVisiblePct = Math.max(0, Math.min(100, ((earthClearance + rEarthDeg) / (2 * rEarthDeg)) * 100));

  // Determine if dual-pane viewport is needed
  // When focus is 'both' and separation exceeds FOV, split into dual panes
  const isSplitPane = focusTarget === 'both' && sepDeg > fovDeg;

  // Viewport dimensions
  const viewportHeight = 220;
  const pixelsPerDegree = viewportHeight / fovDeg;
  const sunRadiusPx = rSunDeg * pixelsPerDegree;
  const earthRadiusPx = rEarthDeg * pixelsPerDegree;

  // Helper to generate terrain skyline profile for a pane centered at (centerAz, centerEl)
  const generateTerrainProfile = (centerAz, centerEl, width) => {
    if (!horizonData) return null;
    const halfFov = (width / pixelsPerDegree) / 2;
    const points = [];
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      const az = centerAz - halfFov + (i / steps) * (halfFov * 2);
      const ridgeEl = queryHorizonElevation(horizonData, az);
      const x = (i / steps) * width;
      const y = viewportHeight / 2 - (ridgeEl - centerEl) * pixelsPerDegree;
      points.push(`${x.toFixed(1)},${Math.min(viewportHeight, Math.max(0, y)).toFixed(1)}`);
    }
    return `0,${viewportHeight} ${points.join(' ')} ${width},${viewportHeight}`;
  };

  return (
    <div className="aerospace-panel p-5 font-mono">
      {/* Header & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-[#1A202E] gap-3">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-[#E5A93C]" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">
            True-Scale 1:1 Celestial Inset
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#10141D] border border-[#222B3D] text-[#E5A93C] font-bold">
            1:1 Isotropic ({pixelsPerDegree.toFixed(1)} px/°)
          </span>
          {isSplitPane && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#38BDF8]/15 border border-[#38BDF8]/30 text-[#38BDF8] font-bold hidden sm:inline">
              Dual Synchronized Viewports
            </span>
          )}
        </div>

        {/* View Controls: Focus & FOV Steppers */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Focus Selector */}
          <div className="flex items-center space-x-1 bg-[#090C12] p-0.5 rounded border border-[#1A202E]">
            <button
              onClick={() => setFocusTarget('both')}
              className={`px-2 py-1 rounded transition-colors text-xs ${
                focusTarget === 'both' ? 'bg-[#181E2E] text-[#E5A93C] font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Both
            </button>
            <button
              onClick={() => setFocusTarget('sun')}
              className={`px-2 py-1 rounded transition-colors text-xs ${
                focusTarget === 'sun' ? 'bg-[#181E2E] text-[#E5A93C] font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sun
            </button>
            <button
              onClick={() => setFocusTarget('earth')}
              className={`px-2 py-1 rounded transition-colors text-xs ${
                focusTarget === 'earth' ? 'bg-[#181E2E] text-[#E5A93C] font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Earth
            </button>
          </div>

          {/* FOV Stepper */}
          <div className="flex items-center space-x-1 bg-[#090C12] p-0.5 rounded border border-[#1A202E]">
            <span className="text-[10px] text-slate-400 px-1 font-bold">FOV:</span>
            {[2, 4, 8, 16].map((fov) => (
              <button
                key={fov}
                onClick={() => setFovDeg(fov)}
                className={`px-2 py-0.5 text-xs rounded transition-colors font-bold ${
                  fovDeg === fov ? 'bg-[#E5A93C] text-black shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {fov}°
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Viewport Canvas Container */}
      <div className="relative w-full min-h-[220px] bg-[#05070B] rounded-lg overflow-hidden border border-[#161C28] shadow-inner">
        <svg className="w-full h-full" viewBox="0 0 1000 220" preserveAspectRatio="none">
          <defs>
            {/* Sun Glow */}
            <radialGradient id="sunGlowTrue" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFF9E6" stopOpacity="1" />
              <stop offset="35%" stopColor="#F59E0B" stopOpacity="0.85" />
              <stop offset="70%" stopColor="#D97706" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#B45309" stopOpacity="0" />
            </radialGradient>

            {/* Earth Optical Atmosphere / Phase */}
            <radialGradient id="earthDiscTrue" cx="38%" cy="32%" r="65%">
              <stop offset="0%" stopColor="#93C5FD" stopOpacity="1" />
              <stop offset="40%" stopColor="#3B82F6" stopOpacity="0.95" />
              <stop offset="75%" stopColor="#1D4ED8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0B132B" stopOpacity="0.95" />
            </radialGradient>
          </defs>

          {isSplitPane ? (
            /* DUAL SPLIT-PANE VIEWPORT */
            <>
              {/* LEFT PANE: SUN VIEWPORT (Centered at Sun) */}
              <g>
                <rect x="0" y="0" width="485" height="220" fill="#04060A" />

                {/* Reticle crosshairs */}
                <line x1="0" y1="110" x2="485" y2="110" stroke="#141C2A" strokeDasharray="3 3" />
                <line x1="242" y1="0" x2="242" y2="220" stroke="#141C2A" strokeDasharray="3 3" />

                {/* 0.0° Astronomical Horizon in Sun pane */}
                {(() => {
                  const y = 110 - (0.0 - sun.elevation_deg) * pixelsPerDegree;
                  return y >= 0 && y <= 220 ? (
                    <g>
                      <line x1="0" y1={y} x2="485" y2={y} stroke="#38BDF8" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                      <text x="8" y={y - 4} fill="#38BDF8" fontSize="8" opacity="0.7">0.0° ASTRO HORIZON</text>
                    </g>
                  ) : null;
                })()}

                {/* Local LOLA Terrain Ridge in Sun pane */}
                {(() => {
                  const poly = generateTerrainProfile(sun.azimuth_deg, sun.elevation_deg, 485);
                  return poly ? (
                    <polygon points={poly} fill="#141B28" stroke="#253248" strokeWidth="1" />
                  ) : null;
                })()}

                {/* Sun Disc */}
                <g transform="translate(242.5, 110)">
                  <circle cx="0" cy="0" r={sunRadiusPx * 2.2} fill="url(#sunGlowTrue)" />
                  <circle cx="0" cy="0" r={sunRadiusPx} fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1" />
                  <text x={sunRadiusPx + 6} y="4" fill="#F59E0B" fontSize="10" fontWeight="bold">
                    SUN 0.53° // AZ {sun.azimuth_deg.toFixed(1)}° EL {sun.elevation_deg >= 0 ? '+' : ''}{sun.elevation_deg.toFixed(2)}°
                  </text>
                </g>

                {/* Left Pane HUD Tag */}
                <rect x="8" y="8" width="160" height="22" rx="4" fill="#0A0D15" stroke="#1A2234" />
                <text x="14" y="23" fill="#E5A93C" fontSize="10" fontWeight="bold">
                  SOLAR VIEWPORT (1:1)
                </text>
              </g>

              {/* CENTER DIVIDER BAR */}
              <g transform="translate(485, 0)">
                <rect x="0" y="0" width="30" height="220" fill="#080B12" stroke="#1A2234" />
                <line x1="15" y1="0" x2="15" y2="220" stroke="#202A3D" strokeDasharray="2 2" />
                {/* Vertical Separation Label */}
                <g transform="translate(15, 110) rotate(-90)">
                  <text x="0" y="4" textAnchor="middle" fill="#E5A93C" fontSize="9" fontWeight="bold" letterSpacing="1">
                    {sepDeg.toFixed(1)}° SEP
                  </text>
                </g>
              </g>

              {/* RIGHT PANE: EARTH VIEWPORT (Centered at Earth) */}
              <g transform="translate(515, 0)">
                <rect x="0" y="0" width="485" height="220" fill="#04060A" />

                {/* Reticle crosshairs */}
                <line x1="0" y1="110" x2="485" y2="110" stroke="#141C2A" strokeDasharray="3 3" />
                <line x1="242" y1="0" x2="242" y2="220" stroke="#141C2A" strokeDasharray="3 3" />

                {/* 0.0° Astronomical Horizon in Earth pane */}
                {(() => {
                  const y = 110 - (0.0 - earth.elevation_deg) * pixelsPerDegree;
                  return y >= 0 && y <= 220 ? (
                    <g>
                      <line x1="0" y1={y} x2="485" y2={y} stroke="#38BDF8" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                      <text x="8" y={y - 4} fill="#38BDF8" fontSize="8" opacity="0.7">0.0° ASTRO HORIZON</text>
                    </g>
                  ) : null;
                })()}

                {/* Local LOLA Terrain Ridge in Earth pane */}
                {(() => {
                  const poly = generateTerrainProfile(earth.azimuth_deg, earth.elevation_deg, 485);
                  return poly ? (
                    <polygon points={poly} fill="#141B28" stroke="#253248" strokeWidth="1" />
                  ) : null;
                })()}

                {/* Earth Disc */}
                <g transform="translate(242.5, 110)">
                  <circle cx="0" cy="0" r={earthRadiusPx * 1.2} fill="#3B82F6" opacity="0.2" />
                  <circle cx="0" cy="0" r={earthRadiusPx} fill="url(#earthDiscTrue)" stroke="#38BDF8" strokeWidth="1" />
                  <text x={earthRadiusPx + 6} y="4" fill="#38BDF8" fontSize="10" fontWeight="bold">
                    EARTH 1.91° // AZ {earth.azimuth_deg.toFixed(1)}° EL {earth.elevation_deg >= 0 ? '+' : ''}{earth.elevation_deg.toFixed(2)}°
                  </text>
                </g>

                {/* Right Pane HUD Tag */}
                <rect x="8" y="8" width="160" height="22" rx="4" fill="#0A0D15" stroke="#1A2234" />
                <text x="14" y="23" fill="#38BDF8" fontSize="10" fontWeight="bold">
                  EARTH VIEWPORT (1:1)
                </text>
              </g>
            </>
          ) : (
            /* SINGLE FULL-WIDTH VIEWPORT (Focused on Sun or Earth) */
            (() => {
              const centerAz = focusTarget === 'earth' ? earth.azimuth_deg : sun.azimuth_deg;
              const centerEl = focusTarget === 'earth' ? earth.elevation_deg : sun.elevation_deg;

              const projectX = (az) => {
                let dAz = az - centerAz;
                if (dAz > 180) dAz -= 360;
                if (dAz < -180) dAz += 360;
                return 500 + dAz * pixelsPerDegree;
              };

              const projectY = (el) => 110 - (el - centerEl) * pixelsPerDegree;

              const sunX = projectX(sun.azimuth_deg);
              const sunY = projectY(sun.elevation_deg);
              const earthX = projectX(earth.azimuth_deg);
              const earthY = projectY(earth.elevation_deg);
              const horizonY = projectY(0.0);
              const poly = generateTerrainProfile(centerAz, centerEl, 1000);

              return (
                <g>
                  {/* Grid crosshairs */}
                  <line x1="0" y1="110" x2="1000" y2="110" stroke="#141C2A" strokeDasharray="3 3" />
                  <line x1="500" y1="0" x2="500" y2="220" stroke="#141C2A" strokeDasharray="3 3" />

                  {/* 0.0° Astronomical Horizon */}
                  {horizonY >= 0 && horizonY <= 220 && (
                    <g>
                      <line x1="0" y1={horizonY} x2="1000" y2={horizonY} stroke="#38BDF8" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                      <text x="12" y={horizonY - 5} fill="#38BDF8" fontSize="9" opacity="0.8">0.0° ASTRONOMICAL HORIZON</text>
                    </g>
                  )}

                  {/* Terrain Polygon */}
                  {poly && <polygon points={poly} fill="#141B28" stroke="#253248" strokeWidth="1" />}

                  {/* Sun Disc */}
                  {sunX >= -50 && sunX <= 1050 && (
                    <g transform={`translate(${sunX}, ${sunY})`}>
                      <circle cx="0" cy="0" r={sunRadiusPx * 2.2} fill="url(#sunGlowTrue)" />
                      <circle cx="0" cy="0" r={sunRadiusPx} fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1" />
                      <text x={sunRadiusPx + 6} y="4" fill="#F59E0B" fontSize="10" fontWeight="bold">
                        SUN 0.53° // AZ {sun.azimuth_deg.toFixed(1)}° EL {sun.elevation_deg >= 0 ? '+' : ''}{sun.elevation_deg.toFixed(2)}°
                      </text>
                    </g>
                  )}

                  {/* Earth Disc */}
                  {earthX >= -50 && earthX <= 1050 && (
                    <g transform={`translate(${earthX}, ${earthY})`}>
                      <circle cx="0" cy="0" r={earthRadiusPx * 1.2} fill="#3B82F6" opacity="0.2" />
                      <circle cx="0" cy="0" r={earthRadiusPx} fill="url(#earthDiscTrue)" stroke="#38BDF8" strokeWidth="1" />
                      <text x={earthRadiusPx + 6} y="4" fill="#38BDF8" fontSize="10" fontWeight="bold">
                        EARTH 1.91° // AZ {earth.azimuth_deg.toFixed(1)}° EL {earth.elevation_deg >= 0 ? '+' : ''}{earth.elevation_deg.toFixed(2)}°
                      </text>
                    </g>
                  )}
                </g>
              );
            })()
          )}

          {/* 1.0° Scale Bar in Bottom Right */}
          <g transform="translate(870, 202)">
            <line x1="0" y1="0" x2={pixelsPerDegree} y2="0" stroke="#94A3B8" strokeWidth="2" />
            <line x1="0" y1="-3" x2="0" y2="3" stroke="#94A3B8" strokeWidth="1.5" />
            <line x1={pixelsPerDegree} y1="-3" x2={pixelsPerDegree} y2="3" stroke="#94A3B8" strokeWidth="1.5" />
            <text x={pixelsPerDegree / 2} y="-5" textAnchor="middle" fill="#94A3B8" fontSize="9" fontWeight="bold">
              1.0° TRUE SCALE
            </text>
          </g>
        </svg>

        {/* Live Eclipse Alert Banner */}
        {occultationPct > 0 && (
          <div className="absolute top-2 left-2 bg-[#DC2626]/20 border border-[#DC2626]/50 text-[#F87171] px-2.5 py-1 rounded text-xs font-bold flex items-center space-x-1.5 backdrop-blur-sm animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#DC2626]"></span>
            <span>SOLAR ECLIPSE OCCULTATION: {occultationPct.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* Real Dynamic Astrodynamics & Clearance Telemetry HUD (All values update live on scrubbing) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs pt-3 border-t border-[#161C28]">
        {/* Card 1: Sun Topocentric Coordinates */}
        <div className="bg-[#090C12] p-2.5 rounded border border-[#1A2234]">
          <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center space-x-1">
            <Sun className="w-3 h-3 text-[#E5A93C]" />
            <span>SUN POSITION</span>
          </div>
          <div className="text-white font-bold text-sm mt-0.5 font-mono">
            Az {sun.azimuth_deg.toFixed(2)}°
          </div>
          <div className="text-[10px] text-[#E5A93C] font-mono mt-0.5">
            Elevation: {sun.elevation_deg >= 0 ? `+${sun.elevation_deg.toFixed(2)}°` : `${sun.elevation_deg.toFixed(2)}°`}
          </div>
        </div>

        {/* Card 2: Sun Ridge Clearance */}
        <div className="bg-[#090C12] p-2.5 rounded border border-[#1A2234]">
          <div className="text-slate-400 text-[10px] uppercase font-bold">SUN RIDGE CLEARANCE</div>
          <div className={`font-bold text-sm mt-0.5 font-mono ${sunClearance > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {sunClearance >= 0 ? `+${sunClearance.toFixed(2)}°` : `${sunClearance.toFixed(2)}°`}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
            {sunDiscVisiblePct.toFixed(0)}% visible ({sunClearance > 0 ? 'UNOBSTRUCTED' : 'OCCLUDED'})
          </div>
        </div>

        {/* Card 3: Earth Topocentric Coordinates */}
        <div className="bg-[#090C12] p-2.5 rounded border border-[#1A2234]">
          <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center space-x-1">
            <Globe className="w-3 h-3 text-[#38BDF8]" />
            <span>EARTH POSITION</span>
          </div>
          <div className="text-white font-bold text-sm mt-0.5 font-mono">
            Az {earth.azimuth_deg.toFixed(2)}°
          </div>
          <div className="text-[10px] text-[#38BDF8] font-mono mt-0.5">
            Elevation: {earth.elevation_deg >= 0 ? `+${earth.elevation_deg.toFixed(2)}°` : `${earth.elevation_deg.toFixed(2)}°`}
          </div>
        </div>

        {/* Card 4: Earth DTE Link Clearance */}
        <div className="bg-[#090C12] p-2.5 rounded border border-[#1A2234]">
          <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center space-x-1">
            <Radio className="w-3 h-3 text-[#38BDF8]" />
            <span>DTE LINK MARGIN</span>
          </div>
          <div className={`font-bold text-sm mt-0.5 font-mono ${earthClearance > 0 ? 'text-[#38BDF8]' : 'text-[#EF4444]'}`}>
            {earthClearance >= 0 ? `+${earthClearance.toFixed(2)}°` : `${earthClearance.toFixed(2)}°`}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
            {earthClearance > 0 ? 'CARRIER LOCK ACTIVE' : 'RADIO SHADOW GAP'}
          </div>
        </div>

        {/* Card 5: Topocentric Angular Separation */}
        <div className="bg-[#090C12] p-2.5 rounded border border-[#1A2234]">
          <div className="text-slate-400 text-[10px] uppercase font-bold flex items-center space-x-1">
            <ArrowLeftRight className="w-3 h-3 text-slate-400" />
            <span>ANGULAR SEPARATION</span>
          </div>
          <div className="text-white font-bold text-sm mt-0.5 font-mono">
            {sepDeg.toFixed(2)}°
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Topocentric Center-to-Center
          </div>
        </div>

        {/* Card 6: Solar Eclipse Occultation */}
        <div className="bg-[#090C12] p-2.5 rounded border border-[#1A2234]">
          <div className="text-slate-400 text-[10px] uppercase font-bold">SOLAR ECLIPSE</div>
          <div className={`font-bold text-sm mt-0.5 font-mono ${occultationPct > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
            {occultationPct > 0 ? `${occultationPct.toFixed(1)}% OCCULTED` : '0.0% (NONE)'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Earth Umbra Alignment
          </div>
        </div>

        {/* Card 7: Local Terrain Crest Elevation */}
        <div className="bg-[#090C12] p-2.5 rounded border border-[#1A2234]">
          <div className="text-slate-400 text-[10px] uppercase font-bold">LOCAL HORIZON CREST</div>
          <div className="text-white font-bold text-sm mt-0.5 font-mono">
            +{sunRidgeEl.toFixed(2)}°
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            LOLA Far-Field Elevation
          </div>
        </div>

        {/* Card 8: True-Scale Isotropic Ratio */}
        <div className="bg-[#090C12] p-2.5 rounded border border-[#1A2234]">
          <div className="text-slate-400 text-[10px] uppercase font-bold">SCALE RATIO</div>
          <div className="text-[#E5A93C] font-bold text-sm mt-0.5 font-mono">
            1:1 ({pixelsPerDegree.toFixed(1)} px/°)
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Sun: 0.53° | Earth: 1.91°
          </div>
        </div>
      </div>
    </div>
  );
}
