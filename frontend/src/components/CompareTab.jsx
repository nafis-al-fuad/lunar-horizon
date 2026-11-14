import React, { useState } from 'react';
import { Plus, Check, X, AlertTriangle, Copy, Trash2, Folder, ExternalLink, RefreshCw, Calendar, ShieldAlert, ArrowRight, Settings2 } from 'lucide-react';

// Mini Horizon Skyline Component matching reference image
function MiniSkyline({ maxEl, skylineType = 'normal' }) {
  const isOccluded = skylineType === 'occluded';
  const isWarning = skylineType === 'warning';

  const terrainPoints = isOccluded
    ? "0,36 35,32 75,18 115,10 155,14 195,26 235,30 270,33 300,35"
    : isWarning
    ? "0,32 45,28 95,20 140,15 180,22 225,28 265,24 300,32"
    : "0,34 50,29 90,22 135,14 175,18 220,26 265,30 300,34";

  return (
    <div className="relative h-28 bg-[#06080E] border border-[#161C2A] rounded-lg overflow-hidden my-3 shadow-inner">
      {/* Top Header Label & Tag */}
      <div className="absolute top-2 left-3 right-3 flex justify-between items-center text-xs font-mono tracking-wider z-10">
        <span className="text-[#8B93A7] uppercase font-bold text-[11px]">HORIZON SKYLINE & SUN PATH</span>
        <span className={`font-bold text-xs ${
          isOccluded ? 'text-[#EF4444]' : isWarning ? 'text-[#E5A93C]' : 'text-[#10B981]'
        }`}>
          {isOccluded ? 'DEEP SHADOW OCCLUSION' : isWarning ? 'MODERATE CREST' : `MAX EL ${maxEl}`}
        </span>
      </div>

      <svg className="w-full h-full pt-5" viewBox="0 0 300 48" preserveAspectRatio="none">
        {/* Dotted Sun Path Trajectory */}
        <path
          d={
            isOccluded
              ? "M 0 28 Q 120 20 300 30"
              : isWarning
              ? "M 0 24 Q 150 7 300 24"
              : "M 0 22 Q 150 5 300 22"
          }
          fill="none"
          stroke={isOccluded ? "rgba(239, 68, 68, 0.4)" : "rgba(229, 169, 60, 0.5)"}
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />

        {/* Sun Dot (drawn before mountain so mountain naturally occludes when below ridge) */}
        <circle
          cx={isOccluded ? "120" : isWarning ? "170" : "135"}
          cy={isOccluded ? "20" : isWarning ? "9" : "8"}
          r="4.5"
          fill={isOccluded ? "#EF4444" : "#E5A93C"}
          className="shadow-md"
        />

        {/* Mountain Terrain Polygon */}
        <polygon
          points={`0,48 ${terrainPoints} 300,48`}
          fill={isOccluded ? '#1E2638' : '#2A344A'}
          stroke="#414F6D"
          strokeWidth="1"
        />

        {/* If occluded, dashed indicator showing occluded position behind ridge */}
        {isOccluded && (
          <circle
            cx="120"
            cy="20"
            r="5"
            fill="none"
            stroke="#EF4444"
            strokeWidth="1.2"
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {/* Azimuth Base Ticks */}
      <div className="absolute bottom-1.5 left-3 right-3 flex justify-between text-[10px] font-mono font-medium text-[#64748B]">
        <span>AZ 0°</span>
        <span>AZ 180° (SOUTH)</span>
        <span>AZ 360°</span>
      </div>
    </div>
  );
}

// Preset database of scenarios that users can customize
const SCENARIO_PRESETS = [
  {
    id: 'shackleton-peak-b',
    name: 'Shackleton Rim (Peak B)',
    siteId: 'shackleton-connecting-ridge',
    coords: '89.73°S, 124.50°E',
    date: '2027-03-01',
    durationDays: 30,
    status: 'pass',
    statusText: 'Passes all operational limits',
    category: 'NOMINAL REF',
    badge: 'VIABLE',
    maxEl: '+1.8°',
    skylineType: 'normal',
    sunlitPct: 62.0,
    sunlitHours: 446.4,
    longestNight: 96,
    longestNightTag: 'BEST',
    longestNightColor: 'bg-[#10B981]/20 text-[#10B981]',
    dteCoverage: 71.0,
    slope: 7.5,
    slopeTag: 'SAFE',
    slopeColor: 'bg-[#10B981]/20 text-[#10B981]',
    avgPower: 48,
    avgPowerW: 480,
    dteMaxGap: 14.0,
  },
  {
    id: 'malapert-massif',
    name: 'Malapert Massif',
    siteId: 'malapert-massif',
    coords: '85.99°S, 02.93°E',
    date: '2027-03-01',
    durationDays: 30,
    status: 'fail',
    statusTitle: 'FAIL // HARD LIMIT EXCEEDED',
    statusSub: 'Longest night (134 h) exceeds operational limit (120 h)',
    category: 'REJECTED',
    badge: 'UNVIABLE',
    maxEl: '-0.8°',
    skylineType: 'occluded',
    sunlitPct: 48.0,
    sunlitHours: 345.6,
    longestNight: 134,
    longestNightTag: 'OVER LIMIT',
    longestNightColor: 'bg-[#EF4444]/20 text-[#EF4444]',
    dteCoverage: 64.0,
    slope: 9.1,
    slopeTag: 'PASS',
    slopeColor: 'bg-[#10B981]/20 text-[#10B981]',
    avgPower: 35,
    avgPowerW: 350,
    dteMaxGap: 21.5,
  },
  {
    id: 'haworth-rim',
    name: 'Haworth Crater Rim',
    siteId: 'haworth-rim',
    coords: '87.41°S, 355.10°E',
    date: '2027-03-01',
    durationDays: 30,
    status: 'warning',
    statusText: 'Viable with threshold proximity alerts',
    category: 'CANDIDATE',
    badge: 'VIABLE',
    maxEl: '+1.4°',
    skylineType: 'warning',
    sunlitPct: 57.0,
    sunlitHours: 410.4,
    longestNight: 118,
    longestNightTag: 'NEAR LIMIT',
    longestNightColor: 'bg-[#E5A93C]/20 text-[#E5A93C]',
    dteCoverage: 69.0,
    slope: 11.2,
    slopeTag: 'WARNING',
    slopeColor: 'bg-[#E5A93C]/20 text-[#E5A93C]',
    avgPower: 41,
    avgPowerW: 410,
    dteMaxGap: 18.0,
  },
  {
    id: 'amundsen-rim',
    name: 'Amundsen Rim Crest',
    siteId: 'amundsen-rim',
    coords: '85.30°S, 95.00°E',
    date: '2027-03-01',
    durationDays: 30,
    status: 'pass',
    statusText: 'Passes all operational limits',
    category: 'BENCHMARK',
    badge: 'VIABLE',
    maxEl: '+2.4°',
    skylineType: 'normal',
    sunlitPct: 52.4,
    sunlitHours: 377.2,
    longestNight: 108,
    longestNightTag: 'SAFE',
    longestNightColor: 'bg-[#10B981]/20 text-[#10B981]',
    dteCoverage: 68.5,
    slope: 8.4,
    slopeTag: 'PASS',
    slopeColor: 'bg-[#10B981]/20 text-[#10B981]',
    avgPower: 39,
    avgPowerW: 390,
    dteMaxGap: 16.5,
  },
  {
    id: 'nobile-rim',
    name: 'Nobile Crater Rim',
    siteId: 'nobile-rim-1',
    coords: '85.25°S, 53.52°E',
    date: '2027-03-01',
    durationDays: 30,
    status: 'pass',
    statusText: 'Passes all operational limits',
    category: 'VIPER SITE',
    badge: 'VIABLE',
    maxEl: '+1.9°',
    skylineType: 'normal',
    sunlitPct: 54.2,
    sunlitHours: 390.2,
    longestNight: 112,
    longestNightTag: 'SAFE',
    longestNightColor: 'bg-[#10B981]/20 text-[#10B981]',
    dteCoverage: 62.0,
    slope: 7.8,
    slopeTag: 'PASS',
    slopeColor: 'bg-[#10B981]/20 text-[#10B981]',
    avgPower: 44,
    avgPowerW: 440,
    dteMaxGap: 24.0,
  },
  {
    id: 'de-gerlache-rim',
    name: 'de Gerlache Crater Rim',
    siteId: 'de-gerlache-rim',
    coords: '88.35°S, 271.80°E',
    date: '2027-03-01',
    durationDays: 30,
    status: 'warning',
    statusText: 'Moderate ridge shadow risk',
    category: 'CANDIDATE',
    badge: 'VIABLE',
    maxEl: '+1.3°',
    skylineType: 'warning',
    sunlitPct: 58.5,
    sunlitHours: 421.2,
    longestNight: 115,
    longestNightTag: 'NEAR LIMIT',
    longestNightColor: 'bg-[#E5A93C]/20 text-[#E5A93C]',
    dteCoverage: 67.2,
    slope: 10.5,
    slopeTag: 'WARNING',
    slopeColor: 'bg-[#E5A93C]/20 text-[#E5A93C]',
    avgPower: 42,
    avgPowerW: 420,
    dteMaxGap: 19.5,
  }
];

export default function CompareTab({ sites = [], onSelectSite }) {
  // 4 dynamic scenario slots: A, B, C, D
  const [slotScenarios, setSlotScenarios] = useState({
    A: { ...SCENARIO_PRESETS[0] },
    B: { ...SCENARIO_PRESETS[1] },
    C: { ...SCENARIO_PRESETS[2] },
    D: null // Slot D starts empty as requested in reference image
  });

  // Modal states for user interaction
  const [targetSlotModal, setTargetSlotModal] = useState(null); // 'A', 'B', 'C', 'D'
  const [inspectModalData, setInspectModalData] = useState(null);
  const [slipModalSlot, setSlipModalSlot] = useState(null);

  // Delete scenario from slot
  const handleDeleteSlot = (slotKey) => {
    setSlotScenarios(prev => ({
      ...prev,
      [slotKey]: null
    }));
  };

  // Clone scenario into empty slot or Slot D
  const handleCloneToSlot = (sourceSlotKey) => {
    const source = slotScenarios[sourceSlotKey];
    if (!source) return;
    
    // Find first empty slot or fallback to D
    const targetKey = ['D', 'C', 'B', 'A'].find(k => !slotScenarios[k]) || 'D';
    setSlotScenarios(prev => ({
      ...prev,
      [targetKey]: {
        ...source,
        id: `${source.id}-clone-${Date.now()}`,
        name: `${source.name} (Copy)`,
        category: `CLONE OF ${sourceSlotKey}`
      }
    }));
  };

  // Slip Mission Epoch: cycles through Southern Summer, Southern Winter Slip, and Equinox Slip
  const handleSlipEpoch = (slotKey) => {
    setSlotScenarios(prev => {
      const cur = prev[slotKey];
      if (!cur) return prev;

      const isWinter = cur.date.includes('06-10');
      const isSlipped = cur.date.includes('04-15');

      if (!isWinter && !isSlipped) {
        // Slip to Southern Winter (fails due to polar darkness)
        return {
          ...prev,
          [slotKey]: {
            ...cur,
            date: '2027-06-10',
            status: 'fail',
            statusTitle: 'FAIL // HARD LIMIT EXCEEDED',
            statusSub: 'Longest night (336 h) exceeds operational limit (120 h)',
            badge: 'UNVIABLE',
            maxEl: '-1.4°',
            skylineType: 'occluded',
            sunlitPct: 0.0,
            sunlitHours: 0.0,
            longestNight: 336,
            longestNightTag: 'OVER LIMIT',
            longestNightColor: 'bg-[#EF4444]/20 text-[#EF4444]',
            avgPower: 0,
            avgPowerW: 0,
            dteCoverage: 32.0,
            dteMaxGap: 336.0,
          }
        };
      } else if (isWinter) {
        // Slip to Autumn Equinox (moderate light)
        return {
          ...prev,
          [slotKey]: {
            ...cur,
            date: '2027-04-15',
            status: 'warning',
            statusText: 'Viable with threshold proximity alerts',
            badge: 'VIABLE',
            maxEl: '+0.9°',
            skylineType: 'warning',
            sunlitPct: 42.0,
            sunlitHours: 302.4,
            longestNight: 119,
            longestNightTag: 'NEAR LIMIT',
            longestNightColor: 'bg-[#E5A93C]/20 text-[#E5A93C]',
            avgPower: 31,
            avgPowerW: 310,
            dteCoverage: 58.0,
            dteMaxGap: 28.0,
          }
        };
      } else {
        // Return to nominal March summer window
        return {
          ...prev,
          [slotKey]: {
            ...cur,
            date: '2027-03-01',
            status: 'pass',
            statusText: 'Passes all operational limits',
            badge: 'VIABLE',
            maxEl: '+1.8°',
            skylineType: 'normal',
            sunlitPct: 62.0,
            sunlitHours: 446.4,
            longestNight: 96,
            longestNightTag: 'BEST',
            longestNightColor: 'bg-[#10B981]/20 text-[#10B981]',
            avgPower: 48,
            avgPowerW: 480,
            dteCoverage: 71.0,
            dteMaxGap: 14.0,
          }
        };
      }
    });
  };

  // Assign preset to slot
  const handleAssignScenario = (slotKey, preset) => {
    setSlotScenarios(prev => ({
      ...prev,
      [slotKey]: { ...preset }
    }));
    setTargetSlotModal(null);
  };

  const slotKeys = ['A', 'B', 'C', 'D'];

  return (
    <div className="space-y-6">
      {/* Compare Header Bar with Instructions */}
      <div className="aerospace-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white font-mono uppercase tracking-wider flex items-center space-x-2">
            <span>4-Scenario Trajectory & Site Evaluation Matrix</span>
          </h2>
          <p className="text-sm text-[#8B93A7] font-mono mt-1">
            Analyze, compare, slip, and clone up to 4 landing site scenarios simultaneously across solar elevation, terrain occlusion, and DTE links.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <button
            onClick={() => setSlotScenarios({
              A: { ...SCENARIO_PRESETS[0] },
              B: { ...SCENARIO_PRESETS[1] },
              C: { ...SCENARIO_PRESETS[2] },
              D: { ...SCENARIO_PRESETS[3] }
            })}
            className="px-3 py-2 rounded bg-[#141824] hover:bg-[#1E2436] text-[#E5A93C] border border-[#252D3F] flex items-center space-x-1.5 btn-aerospace font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Load 4-Site Benchmark</span>
          </button>
        </div>
      </div>

      {/* 4-Scenario Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {slotKeys.map(key => {
          const sc = slotScenarios[key];

          // If Slot is empty, render the Add Slot Card (like Slot D in reference image)
          if (!sc) {
            return (
              <div
                key={key}
                className="aerospace-panel p-8 border-dashed border-[#22283A] flex flex-col items-center justify-center text-center space-y-4 min-h-[480px]"
              >
                <div className="w-14 h-14 rounded-full bg-[#131722] border border-[#232B3C] flex items-center justify-center text-[#E5A93C] shadow-lg">
                  <Plus className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white font-mono uppercase tracking-wider">
                    Scenario Slot {key}
                  </h4>
                  <p className="text-sm text-[#8B93A7] font-mono mt-1.5 max-w-[320px]">
                    Attach another candidate location, mission slip epoch, or attitude model.
                  </p>
                </div>
                <div className="space-y-3 w-full max-w-[240px] pt-3 font-mono">
                  <button
                    onClick={() => setTargetSlotModal(key)}
                    className="w-full py-2.5 px-4 rounded-md bg-[#161B26] hover:bg-[#202738] text-white text-xs font-bold font-mono border border-[#252D3F] flex items-center justify-center space-x-2 btn-aerospace shadow-sm"
                  >
                    <Folder className="w-4 h-4 text-[#E5A93C]" />
                    <span>Select Saved Target</span>
                  </button>
                  <button
                    onClick={() => handleCloneToSlot('A')}
                    className="w-full py-2.5 px-4 rounded-md bg-[#161B26] hover:bg-[#202738] text-white text-xs font-bold font-mono border border-[#252D3F] flex items-center justify-center space-x-2 btn-aerospace shadow-sm"
                  >
                    <Copy className="w-4 h-4 text-[#8B93A7]" />
                    <span>Clone Scenario A</span>
                  </button>
                </div>
              </div>
            );
          }

          // Populated Slot Card
          const isPass = sc.status === 'pass';
          const isFail = sc.status === 'fail';
          const isWarn = sc.status === 'warning';

          return (
            <div key={key} className="aerospace-panel p-5 flex flex-col justify-between shadow-xl">
              <div>
                {/* Header Category & Viability Badge */}
                <div className="flex items-center justify-between pb-1.5 text-xs font-mono">
                  <span className={`font-bold tracking-wider text-sm ${
                    isFail ? 'text-[#EF4444]' : isWarn ? 'text-[#E5A93C]' : 'text-[#10B981]'
                  }`}>
                    SCENARIO {key} // {sc.category}
                  </span>
                  <span className={`px-2.5 py-1 rounded border text-xs font-bold ${
                    isFail
                      ? 'text-[#EF4444] bg-[#EF4444]/15 border-[#EF4444]/30'
                      : 'text-[#10B981] bg-[#10B981]/15 border-[#10B981]/30'
                  }`}>
                    ■ {sc.badge}
                  </span>
                </div>

                {/* Scenario Title & Coordinates */}
                <div className="flex items-start justify-between mt-1">
                  <div>
                    <h3 className="text-lg font-bold text-white font-mono tracking-tight">
                      {sc.name}
                    </h3>
                    <p className="text-xs text-[#8B93A7] font-mono mt-0.5">
                      {sc.coords} // {sc.date} ({sc.durationDays}d)
                    </p>
                  </div>
                  <button
                    onClick={() => setTargetSlotModal(key)}
                    title="Change Site Target"
                    className="p-1.5 rounded bg-[#131722] hover:bg-[#1E2536] text-[#8B93A7] hover:text-white border border-[#22293A] btn-aerospace text-xs flex items-center space-x-1"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-mono">Change</span>
                  </button>
                </div>

                {/* Status Alert Banner */}
                <div className="mt-3">
                  {isPass && (
                    <div className="text-xs text-[#10B981] font-mono flex items-center space-x-2 py-1.5 px-2 rounded bg-[#10B981]/10 border border-[#10B981]/20">
                      <Check className="w-4 h-4 flex-shrink-0" />
                      <span className="font-semibold">{sc.statusText}</span>
                    </div>
                  )}
                  {isFail && (
                    <div className="bg-[#EF4444]/15 border border-[#EF4444]/30 rounded-md p-2.5 text-xs text-[#EF4444] font-mono">
                      <div className="font-bold flex items-center space-x-1.5">
                        <X className="w-4 h-4 flex-shrink-0" />
                        <span>{sc.statusTitle}</span>
                      </div>
                      <div className="text-xs pl-5 text-[#EF4444]/90 mt-0.5">{sc.statusSub}</div>
                    </div>
                  )}
                  {isWarn && (
                    <div className="text-xs text-[#E5A93C] font-mono flex items-center space-x-2 py-1.5 px-2 rounded bg-[#E5A93C]/10 border border-[#E5A93C]/20">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span className="font-semibold">{sc.statusText}</span>
                    </div>
                  )}
                </div>

                {/* Mini Skyline & Sun Path Canvas */}
                <MiniSkyline maxEl={sc.maxEl} skylineType={sc.skylineType} />

                {/* Metrics Table with Large Monospace Typography */}
                <div className="space-y-2 pt-1 text-sm font-mono">
                  <div className="flex items-center justify-between py-1 border-b border-[#141824]">
                    <span className="text-[#8B93A7]">Sunlit Duration</span>
                    <span className="font-bold text-white text-sm">{sc.sunlitPct.toFixed(1)}% ({sc.sunlitHours.toFixed(1)} h)</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#141824]">
                    <span className="text-[#8B93A7]">Longest Night</span>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm">{sc.longestNight} h</span>
                      {sc.longestNightTag && (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${sc.longestNightColor}`}>
                          {sc.longestNightTag}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#141824]">
                    <span className="text-[#8B93A7]">Earth DTE Coverage</span>
                    <span className="font-bold text-white text-sm">{sc.dteCoverage.toFixed(1)}%</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#141824]">
                    <span className="text-[#8B93A7]">Max Ground Slope</span>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm">{sc.slope.toFixed(1)}°</span>
                      {sc.slopeTag && (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${sc.slopeColor}`}>
                          {sc.slopeTag}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#141824]">
                    <span className="text-[#8B93A7]">Average Power</span>
                    <span className="font-bold text-white text-sm">{sc.avgPower}% ({sc.avgPowerW} W)</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#141824]">
                    <span className="text-[#8B93A7]">DTE Max Gap</span>
                    <span className="font-bold text-white text-sm">{sc.dteMaxGap.toFixed(1)} h</span>
                  </div>
                </div>
              </div>

              {/* Bottom Tactile Action Buttons */}
              <div className="flex items-center space-x-2 pt-4 mt-3 border-t border-[#181D2A] text-xs font-mono">
                {isFail ? (
                  <button
                    onClick={() => setInspectModalData(sc)}
                    className="flex-1 py-2 px-3 rounded-md font-bold text-center bg-[#1A202C] hover:bg-[#252E3E] text-white border border-[#283244] btn-aerospace text-xs shadow-sm"
                  >
                    Inspect Failure
                  </button>
                ) : (
                  <button
                    onClick={() => onSelectSite && onSelectSite(sc.siteId)}
                    className="flex-1 py-2 px-3 rounded-md font-bold text-center bg-[#E5A93C] text-[#0A0D12] hover:bg-[#F5C35E] btn-aerospace text-xs shadow-sm"
                  >
                    Open in Navigator
                  </button>
                )}

                <button
                  onClick={() => handleSlipEpoch(key)}
                  title="Cycle Mission Slip Date (+30d / Southern Winter)"
                  className="px-3.5 py-2 bg-[#131722] hover:bg-[#1E2536] rounded-md text-[#E5A93C] hover:text-white border border-[#22293A] btn-aerospace font-bold flex items-center space-x-1"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Slip</span>
                </button>

                <button
                  onClick={() => handleCloneToSlot(key)}
                  title="Clone this scenario into another slot"
                  className="p-2 bg-[#131722] hover:bg-[#1E2536] rounded-md text-[#8B93A7] hover:text-white border border-[#22293A] btn-aerospace"
                >
                  <Copy className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDeleteSlot(key)}
                  title="Delete scenario from slot"
                  className="p-2 bg-[#131722] hover:bg-[#EF4444]/20 hover:text-[#EF4444] rounded-md text-[#8B93A7] border border-[#22293A] btn-aerospace"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Target Site Selector Modal for Slot Customization */}
      {targetSlotModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0C0F17] border border-[#252D3F] rounded-lg max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl font-mono text-xs">
            <div className="p-4 border-b border-[#1A202E] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">
                  Select Target for Scenario Slot {targetSlotModal}
                </h3>
                <p className="text-xs text-[#8B93A7] mt-0.5">
                  Choose a candidate location or benchmark to simulate in this slot
                </p>
              </div>
              <button
                onClick={() => setTargetSlotModal(null)}
                className="p-1 rounded text-[#8B93A7] hover:text-white hover:bg-[#1A202E]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {SCENARIO_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => handleAssignScenario(targetSlotModal, preset)}
                  className="p-3 rounded-lg cursor-pointer bg-[#111520] hover:bg-[#181E2E] border border-[#1E2536] hover:border-[#E5A93C]/40 transition-all flex items-center justify-between btn-aerospace"
                >
                  <div>
                    <div className="font-bold text-sm text-white flex items-center space-x-2">
                      <span>{preset.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        preset.status === 'fail'
                          ? 'bg-[#EF4444]/20 text-[#EF4444]'
                          : preset.status === 'warning'
                          ? 'bg-[#E5A93C]/20 text-[#E5A93C]'
                          : 'bg-[#10B981]/20 text-[#10B981]'
                      }`}>
                        {preset.badge}
                      </span>
                    </div>
                    <div className="text-xs text-[#8B93A7] mt-1">
                      {preset.coords} • Night: {preset.longestNight}h • Sun: {preset.sunlitPct}%
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#E5A93C]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Failure & Constraint Inspector Modal */}
      {inspectModalData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0C0F17] border border-[#EF4444]/40 rounded-lg max-w-lg w-full p-5 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#24161B]">
              <div className="flex items-center space-x-2 text-[#EF4444]">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  Operational Constraint Violation Report
                </h3>
              </div>
              <button
                onClick={() => setInspectModalData(null)}
                className="p-1 rounded text-[#8B93A7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-sm text-[#CBD5E1]">
              <div className="bg-[#181014] border border-[#EF4444]/30 rounded p-3">
                <div className="font-bold text-[#EF4444] text-xs uppercase">Violated Rule: Thermal Battery Cold Soak Limit</div>
                <div className="text-xs mt-1 text-[#E2E4E9]">
                  Longest continuous darkness period at <strong className="text-white">{inspectModalData.name}</strong> is <strong className="text-[#EF4444]">{inspectModalData.longestNight} hours</strong>, which strictly breaches the maximum operational thermal keep-alive limit of <strong className="text-white">120 hours</strong>.
                </div>
              </div>

              <div className="text-xs text-[#8B93A7] space-y-1">
                <div>• Solar Elevation Peak: <strong className="text-white">{inspectModalData.maxEl}</strong> (terrain occluded)</div>
                <div>• Total Sunlit Fraction: <strong className="text-white">{inspectModalData.sunlitPct}%</strong></div>
                <div>• Longest DTE Blackout Gap: <strong className="text-white">{inspectModalData.dteMaxGap} hours</strong></div>
              </div>

              <div className="text-xs bg-[#10141D] p-3 rounded border border-[#1E2536] text-[#8B93A7]">
                <strong className="text-[#E5A93C]">Astrodynamic Mitigation:</strong> Use the <span className="text-white font-bold">"Slip"</span> button to advance the launch window epoch towards southern summer or increase lander mast height.
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#1C2232] space-x-2">
              <button
                onClick={() => {
                  const s = inspectModalData;
                  setInspectModalData(null);
                  onSelectSite && onSelectSite(s.siteId);
                }}
                className="px-4 py-2 rounded bg-[#E5A93C] text-black font-bold text-xs btn-aerospace"
              >
                Inspect in 360° Navigator
              </button>
              <button
                onClick={() => setInspectModalData(null)}
                className="px-4 py-2 rounded bg-[#161B26] text-white border border-[#252D3F] text-xs btn-aerospace"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}