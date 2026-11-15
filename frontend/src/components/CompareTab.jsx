import React, { useState } from 'react';
import { Plus, Check, X, AlertTriangle, Copy, Trash2, Folder, ExternalLink, RefreshCw, Calendar, ShieldAlert, ArrowRight, Settings2 } from 'lucide-react';

// Mini Horizon Skyline Component matching reference image 2
function MiniSkyline({ maxEl, skylineType = 'normal' }) {
  const isOccluded = skylineType === 'occluded';
  const isWarning = skylineType === 'warning';

  // Accurate SVG polygon coordinates for lunar crater rims
  const terrainPoints = isOccluded
    ? "0,36 35,32 75,18 115,10 155,14 195,26 235,30 270,33 300,35"
    : isWarning
    ? "0,32 45,28 95,20 140,15 180,22 225,28 265,24 300,32"
    : "0,34 50,29 90,22 135,14 175,18 220,26 265,30 300,34";

  return (
    <div className="relative h-24 bg-[#080B11] border border-[#141A26] rounded overflow-hidden my-3">
      {/* Top Header Label & Tag */}
      <div className="absolute top-2 left-3 right-3 flex justify-between items-center text-[10px] font-mono tracking-wider z-10">
        <span className="text-[#8B93A7] uppercase font-bold tracking-wider">HORIZON SKYLINE & SUN PATH</span>
        <span className={`font-bold text-[11px] ${
          isOccluded ? 'text-[#EF4444]' : isWarning ? 'text-[#E5A93C]' : 'text-[#10B981]'
        }`}>
          {isOccluded ? 'DEEP SHADOW OCCLUSION' : isWarning ? 'MODERATE CREST' : `MAX EL ${maxEl}`}
        </span>
      </div>

      <svg className="w-full h-full pt-4" viewBox="0 0 300 48" preserveAspectRatio="none">
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

        {/* Sun Dot (drawn before mountain so mountain occludes when below ridge) */}
        <circle
          cx={isOccluded ? "120" : isWarning ? "170" : "135"}
          cy={isOccluded ? "20" : isWarning ? "9" : "8"}
          r="4.5"
          fill={isOccluded ? "#EF4444" : "#E5A93C"}
        />

        {/* Mountain Terrain Silhouette */}
        <polygon
          points={`0,48 ${terrainPoints} 300,48`}
          fill={isOccluded ? '#1E2638' : '#2D3B52'}
          stroke="#475569"
          strokeWidth="1"
        />

        {/* If occluded, dashed circle indicator showing occluded position behind ridge */}
        {isOccluded && (
          <circle
            cx="120"
            cy="20"
            r="4.5"
            fill="none"
            stroke="#EF4444"
            strokeWidth="1.2"
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {/* Azimuth Base Ticks */}
      <div className="absolute bottom-1 left-3 right-3 flex justify-between text-[9px] font-mono font-medium text-[#64748B]">
        <span>AZ 0°</span>
        <span>AZ 180° (SOUTH)</span>
        <span>AZ 360°</span>
      </div>
    </div>
  );
}

// Preset database of scenarios matching reference image 2
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
    longestNightColor: 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30',
    dteCoverage: 71.0,
    slope: 7.5,
    slopeTag: 'SAFE',
    slopeColor: 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30',
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
    longestNightColor: 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30',
    dteCoverage: 64.0,
    slope: 9.1,
    slopeTag: 'PASS',
    slopeColor: 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30',
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
    longestNightColor: 'bg-[#E5A93C]/15 text-[#E5A93C] border border-[#E5A93C]/30',
    dteCoverage: 69.0,
    slope: 11.2,
    slopeTag: 'WARNING',
    slopeColor: 'bg-[#E5A93C]/15 text-[#E5A93C] border border-[#E5A93C]/30',
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
    longestNightColor: 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30',
    dteCoverage: 68.5,
    slope: 8.4,
    slopeTag: 'PASS',
    slopeColor: 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30',
    avgPower: 39,
    avgPowerW: 390,
    dteMaxGap: 16.5,
  }
];

export default function CompareTab({ sites = [], onSelectSite }) {
  // 4 dynamic scenario slots: A, B, C, D (Slot D starts empty matching reference)
  const [slotScenarios, setSlotScenarios] = useState({
    A: { ...SCENARIO_PRESETS[0] },
    B: { ...SCENARIO_PRESETS[1] },
    C: { ...SCENARIO_PRESETS[2] },
    D: null
  });

  const [targetSlotModal, setTargetSlotModal] = useState(null); // 'A', 'B', 'C', 'D'
  const [inspectModalData, setInspectModalData] = useState(null);

  // Delete scenario from slot
  const handleDeleteSlot = (slotKey) => {
    setSlotScenarios(prev => ({
      ...prev,
      [slotKey]: null
    }));
  };

  // Clone scenario into slot D or first empty slot
  const handleCloneToSlot = (sourceSlotKey) => {
    const source = slotScenarios[sourceSlotKey];
    if (!source) return;
    
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

  // Slip Mission Epoch
  const handleSlipEpoch = (slotKey) => {
    setSlotScenarios(prev => {
      const cur = prev[slotKey];
      if (!cur) return prev;

      const isWinter = cur.date.includes('06-10');
      const isSlipped = cur.date.includes('04-15');

      if (!isWinter && !isSlipped) {
        // Slip to Southern Winter
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
            longestNightColor: 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30',
            avgPower: 0,
            avgPowerW: 0,
            dteCoverage: 32.0,
            dteMaxGap: 336.0,
          }
        };
      } else if (isWinter) {
        // Slip to Autumn Equinox
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
            longestNightColor: 'bg-[#E5A93C]/15 text-[#E5A93C] border border-[#E5A93C]/30',
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
            longestNightColor: 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30',
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
    <div className="space-y-4">
      {/* 4-Scenario Grid (2x2 layout matching reference image) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {slotKeys.map(key => {
          const sc = slotScenarios[key];

          // Empty Slot (matching Slot D in reference image)
          if (!sc) {
            return (
              <div
                key={key}
                className="bg-[#0A0D15] border border-[#161D2B] rounded-lg p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[440px]"
              >
                <div className="w-12 h-12 rounded-full bg-[#10141F] border border-[#1E2738] flex items-center justify-center text-[#E5A93C]">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white font-mono tracking-tight">
                    Scenario Slot {key}
                  </h4>
                  <p className="text-xs text-[#8B93A7] font-mono mt-1.5 max-w-[280px]">
                    Attach another candidate location, mission slip epoch, or attitude model.
                  </p>
                </div>
                <div className="space-y-2 w-full max-w-[220px] pt-2 font-mono">
                  <button
                    onClick={() => setTargetSlotModal(key)}
                    className="w-full py-2 px-3 rounded bg-[#121622] hover:bg-[#1A2234] text-white text-xs font-bold font-mono border border-[#1E2738] flex items-center justify-center space-x-2 btn-aerospace"
                  >
                    <Folder className="w-3.5 h-3.5 text-[#E5A93C]" />
                    <span>Select Saved Target</span>
                  </button>
                  <button
                    onClick={() => handleCloneToSlot('A')}
                    className="w-full py-2 px-3 rounded bg-[#121622] hover:bg-[#1A2234] text-slate-300 text-xs font-bold font-mono border border-[#1E2738] flex items-center justify-center space-x-2 btn-aerospace"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#8B93A7]" />
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
            <div key={key} className="bg-[#0A0D15] border border-[#161D2B] rounded-lg p-4 flex flex-col justify-between shadow-lg">
              <div>
                {/* Header Category & Viability Badge */}
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className={`font-bold tracking-wider text-[11px] uppercase ${
                    isFail ? 'text-[#EF4444]' : isWarn ? 'text-[#34D399]' : 'text-[#34D399]'
                  }`}>
                    SCENARIO {key} // {sc.category}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    isFail
                      ? 'text-[#EF4444] bg-[#EF4444]/15 border border-[#EF4444]/30'
                      : 'text-[#10B981] bg-[#10B981]/15 border border-[#10B981]/30'
                  }`}>
                    &#9632; {sc.badge}
                  </span>
                </div>

                {/* Scenario Title & Coordinates */}
                <div className="mt-1">
                  <h3 className="text-base font-bold text-white font-mono tracking-tight">
                    {sc.name}
                  </h3>
                  <p className="text-[11px] text-[#8B93A7] font-mono mt-0.5">
                    {sc.coords} // {sc.date} ({sc.durationDays}d)
                  </p>
                </div>

                {/* Status Alert Banner */}
                <div className="mt-2.5">
                  {isPass && (
                    <div className="text-[11px] text-[#34D399] font-mono flex items-center space-x-1.5 py-1 px-2 rounded bg-[#10B981]/10 border border-[#10B981]/20">
                      <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{sc.statusText}</span>
                    </div>
                  )}
                  {isFail && (
                    <div className="bg-[#EF4444]/15 border border-[#EF4444]/30 rounded p-2 text-xs text-[#EF4444] font-mono">
                      <div className="font-bold flex items-center space-x-1.5 text-[11px]">
                        <X className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{sc.statusTitle}</span>
                      </div>
                      <div className="text-[10px] pl-5 text-[#EF4444]/90 mt-0.5">{sc.statusSub}</div>
                    </div>
                  )}
                  {isWarn && (
                    <div className="text-[11px] text-[#E5A93C] font-mono flex items-center space-x-1.5 py-1 px-2 rounded bg-[#E5A93C]/10 border border-[#E5A93C]/20">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{sc.statusText}</span>
                    </div>
                  )}
                </div>

                {/* Mini Skyline & Sun Path Canvas */}
                <MiniSkyline maxEl={sc.maxEl} skylineType={sc.skylineType} />

                {/* Metrics Table */}
                <div className="space-y-1.5 pt-1 text-xs font-mono">
                  <div className="flex items-center justify-between py-1 border-b border-[#141A26]">
                    <span className="text-[#8B93A7]">Sunlit Duration</span>
                    <span className="font-bold text-white">{sc.sunlitPct.toFixed(1)}% ({sc.sunlitHours.toFixed(1)} h)</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#141A26]">
                    <span className="text-[#8B93A7]">Longest Night</span>
                    <div className="flex items-center space-x-2">
                      <span className={`font-bold ${isFail ? 'text-[#EF4444]' : 'text-white'}`}>
                        {sc.longestNight} h
                      </span>
                      {sc.longestNightTag && (
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${sc.longestNightColor}`}>
                          {sc.longestNightTag}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#141A26]">
                    <span className="text-[#8B93A7]">Earth DTE Coverage</span>
                    <span className="font-bold text-white">{sc.dteCoverage.toFixed(1)}%</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#141A26]">
                    <span className="text-[#8B93A7]">Max Ground Slope</span>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">{sc.slope.toFixed(1)}°</span>
                      {sc.slopeTag && (
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${sc.slopeColor}`}>
                          {sc.slopeTag}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#141A26]">
                    <span className="text-[#8B93A7]">Average Power</span>
                    <span className="font-bold text-white">{sc.avgPower}% ({sc.avgPowerW} W)</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#141A26]">
                    <span className="text-[#8B93A7]">DTE Max Gap</span>
                    <span className="font-bold text-white">{sc.dteMaxGap.toFixed(1)} h</span>
                  </div>
                </div>
              </div>

              {/* Bottom Card Actions (matching reference image) */}
              <div className="flex items-center space-x-2 pt-3 mt-2 border-t border-[#141A26] text-xs font-mono">
                {isFail ? (
                  <button
                    onClick={() => setInspectModalData(sc)}
                    className="flex-1 py-1.5 px-3 rounded font-bold text-center bg-[#151B27] hover:bg-[#1E2738] text-white border border-[#232D42] btn-aerospace text-xs shadow-sm"
                  >
                    Inspect Failure
                  </button>
                ) : (
                  <button
                    onClick={() => onSelectSite && onSelectSite(sc.siteId)}
                    className="flex-1 py-1.5 px-3 rounded font-bold text-center bg-[#F6C38A] text-[#121620] hover:bg-[#FCD8A9] btn-aerospace text-xs shadow-sm"
                  >
                    Open in Navigator
                  </button>
                )}

                <button
                  onClick={() => handleSlipEpoch(key)}
                  title="Cycle Mission Slip Date"
                  className="px-3 py-1.5 bg-[#10141F] hover:bg-[#1A2234] rounded text-slate-300 hover:text-white border border-[#1E2638] btn-aerospace font-bold"
                >
                  Slip
                </button>

                <button
                  onClick={() => handleCloneToSlot(key)}
                  title="Clone this scenario"
                  className="p-1.5 bg-[#10141F] hover:bg-[#1A2234] rounded text-[#8B93A7] hover:text-white border border-[#1E2638] btn-aerospace"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDeleteSlot(key)}
                  title="Delete scenario from slot"
                  className="p-1.5 bg-[#10141F] hover:bg-[#EF4444]/20 hover:text-[#EF4444] rounded text-[#8B93A7] border border-[#1E2638] btn-aerospace"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Target Site Selector Modal */}
      {targetSlotModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0D15] border border-[#1E2738] rounded-lg max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl font-mono text-xs">
            <div className="p-4 border-b border-[#161D2B] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Select Target for Scenario Slot {targetSlotModal}
                </h3>
                <p className="text-[11px] text-[#8B93A7] mt-0.5">
                  Choose a candidate location or benchmark to simulate in this slot
                </p>
              </div>
              <button
                onClick={() => setTargetSlotModal(null)}
                className="p-1 rounded text-[#8B93A7] hover:text-white hover:bg-[#161D2B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {SCENARIO_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => handleAssignScenario(targetSlotModal, preset)}
                  className="p-3 rounded cursor-pointer bg-[#10141F] hover:bg-[#182030] border border-[#1E2638] hover:border-[#E5A93C]/40 transition-all flex items-center justify-between btn-aerospace"
                >
                  <div>
                    <div className="font-bold text-xs text-white flex items-center space-x-2">
                      <span>{preset.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                        preset.status === 'fail' ? 'text-[#EF4444] bg-[#EF4444]/15' : 'text-[#10B981] bg-[#10B981]/15'
                      }`}>
                        {preset.badge}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#8B93A7] mt-0.5">{preset.coords}</div>
                  </div>
                  <div className="text-right text-[11px] font-mono">
                    <span className="text-[#E5A93C] font-bold">{preset.sunlitPct}% sunlit</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inspect Failure Modal */}
      {inspectModalData && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0D15] border border-[#EF4444]/40 rounded-lg max-w-md w-full p-4 font-mono text-xs shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#1E2738] pb-2">
              <span className="text-[#EF4444] font-bold uppercase tracking-wider text-sm flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4" />
                <span>Hard Constraint Violation</span>
              </span>
              <button
                onClick={() => setInspectModalData(null)}
                className="p-1 rounded text-[#8B93A7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-white font-bold">{inspectModalData.name}</p>
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/25 p-3 rounded text-[#EF4444] text-[11px] space-y-1">
              <p className="font-bold">{inspectModalData.statusTitle}</p>
              <p>{inspectModalData.statusSub}</p>
              <p className="text-slate-300 pt-1">
                Recommendation: Slip launch epoch toward late southern summer or shift landing reticle onto the elevated Malapert Ridge crest (+2.1 km elevation).
              </p>
            </div>
            <button
              onClick={() => setInspectModalData(null)}
              className="w-full py-2 bg-[#121622] hover:bg-[#1A2234] text-white border border-[#1E2738] rounded font-bold"
            >
              Close Failure Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
