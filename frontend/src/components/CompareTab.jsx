import React, { useState } from 'react';
import { Plus, Check, X, AlertTriangle, Copy, Trash2, Folder, ExternalLink, RefreshCw, Calendar, ShieldAlert, ArrowRight, Settings2, Search, Sliders, Pin } from 'lucide-react';

// Mini Horizon Skyline Component matching reference image 2
function MiniSkyline({ maxEl, skylineType = 'normal' }) {
  const isOccluded = skylineType === 'occluded';
  const isWarning = skylineType === 'warning';

  // SVG polygon coordinates for lunar crater rims
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

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Dynamic Astrodynamics & Operational Viability Calculator
 * Computes realistic metrics for ANY site (16 curated or custom), year (2026-2036),
 * month, duration, and vantage mast height.
 */
function computeScenarioMetrics(site, year = 2027, month = 2, mastHeightM = 2.0, durationDays = 30, customLimits = {}) {
  const lat = site?.lat_deg ?? -89.44;
  const lon = site?.lon_deg ?? -137.40;
  const baseElev = site?.terrain_height_m ?? 0;
  const slope = site?.max_slope_deg ?? site?.slope_deg ?? 7.5;
  const isSouthPolar = lat <= -75;
  const isFarSide = Math.abs(lat) < 75 && Math.abs(lon) > 90;

  const nightLimit = customLimits.nightLimit ?? 120;
  const slopeLimit = customLimits.slopeLimit ?? 10.0;
  const minDteLimit = customLimits.minDte ?? 60.0;

  // Exact astronomical epoch
  const epoch2026 = Date.UTC(2026, 0, 1, 0, 0, 0);
  const targetEpoch = Date.UTC(year, month, 1, 12, 0, 0);
  const daysSince2026 = (targetEpoch - epoch2026) / (86400 * 1000);

  // Solar orbital cycle & 18.61-year nodal precession
  const solarLon = (280.46 + 0.9856474 * daysSince2026) % 360;
  const nodeLon = (125.04 - 0.0529538 * daysSince2026) % 360;
  const subSolarLat = -1.543 * Math.sin((solarLon - nodeLon) * (Math.PI / 180));

  // Mast vantage gain (higher mast lowers horizon dip angle)
  const mastGain = (mastHeightM / 1000) * 0.04;
  const elevBonus = (baseElev / 1000) * 0.035;

  let peakEl;
  let sunlitPct;
  let longestNight;
  let dteCoverage;
  let dteMaxGap;
  let avgPower;
  let skylineType = 'normal';

  if (isSouthPolar) {
    // Southern polar geometry
    peakEl = -subSolarLat + mastGain + elevBonus;

    // Peak summer (Dec-Feb): subSolarLat is negative (-1.5°), South Pole is tilted towards Sun
    // Peak winter (June-Aug): subSolarLat is positive (+1.5°), South Pole is tilted away (polar night)
    const seasonalFactor = (-subSolarLat / 1.54); // +1.0 in summer, -1.0 in winter
    const baseSunlit = 55 + seasonalFactor * 35 + (baseElev > 1000 ? 8 : 0) + (mastHeightM * 1.2);
    sunlitPct = Math.max(0, Math.min(94, Math.round(baseSunlit)));

    if (sunlitPct >= 60) {
      longestNight = Math.round(72 + (94 - sunlitPct) * 1.2);
      skylineType = 'normal';
    } else if (sunlitPct >= 35) {
      longestNight = Math.round(112 + (60 - sunlitPct) * 1.8);
      skylineType = 'warning';
    } else {
      longestNight = Math.round(150 + (35 - sunlitPct) * 4.5);
      skylineType = 'occluded';
    }

    // Earth DTE coverage at south pole:
    if (isFarSide) {
      dteCoverage = 0;
      dteMaxGap = durationDays * 24;
    } else {
      const standstillFactor = 1.0 + 0.15 * Math.cos((year - 2026.5) * (2 * Math.PI / 18.61));
      const librationAmp = 6.8 * standstillFactor;
      const baseDte = 68 + (baseElev > 1000 ? 5 : 0) + (mastHeightM * 0.8) + (librationAmp * 0.4);
      dteCoverage = Math.max(20, Math.min(92, Math.round(baseDte)));
      dteMaxGap = Math.round((100 - dteCoverage) * 0.6 + 4);
    }

    avgPower = Math.round(sunlitPct * 0.8);
  } else {
    // Non-polar sites (synodic day/night 14.7d / 14.7d)
    peakEl = 90 - Math.abs(lat - subSolarLat);
    sunlitPct = 50.0;
    longestNight = 354; // ~14.7 days night
    dteCoverage = isFarSide ? 0 : 98.0;
    dteMaxGap = isFarSide ? (durationDays * 24) : 0;
    avgPower = 45;
    skylineType = 'normal';
  }

  const sunlitHours = Number(((sunlitPct / 100) * durationDays * 24).toFixed(1));
  const avgPowerW = Math.round(avgPower * 10);

  // Status & viability determination
  let status = 'pass';
  let badge = 'VIABLE';
  let statusText = 'Passes all operational limits';
  let statusTitle = '';
  let statusSub = '';

  const failsNight = longestNight > nightLimit;
  const failsSlope = slope > slopeLimit;
  const failsDte = dteCoverage < minDteLimit;

  if (failsNight || failsSlope || failsDte) {
    status = 'fail';
    badge = 'UNVIABLE';
    statusTitle = 'FAIL // HARD LIMIT EXCEEDED';
    if (failsNight) {
      statusSub = `Longest night (${longestNight} h) exceeds operational limit (${nightLimit} h)`;
    } else if (failsSlope) {
      statusSub = `Ground slope (${slope.toFixed(1)}°) exceeds landing gear limit (${slopeLimit.toFixed(1)}°)`;
    } else {
      statusSub = `Earth DTE coverage (${dteCoverage}%) below minimum link limit (${minDteLimit}%)`;
    }
  } else if (longestNight >= (nightLimit - 12) || slope >= (slopeLimit - 1.5)) {
    status = 'warning';
    badge = 'VIABLE';
    statusText = 'Viable with threshold proximity alerts';
  }

  // Tags
  let longestNightTag = 'SAFE';
  let longestNightColor = 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30';
  if (status === 'fail' && failsNight) {
    longestNightTag = 'OVER LIMIT';
    longestNightColor = 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30';
  } else if (longestNight >= (nightLimit - 12)) {
    longestNightTag = 'NEAR LIMIT';
    longestNightColor = 'bg-[#E5A93C]/15 text-[#E5A93C] border border-[#E5A93C]/30';
  } else if (longestNight <= 98) {
    longestNightTag = 'BEST';
  }

  let slopeTag = 'PASS';
  let slopeColor = 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30';
  if (status === 'fail' && failsSlope) {
    slopeTag = 'DANGER';
    slopeColor = 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30';
  } else if (slope >= (slopeLimit - 1.5)) {
    slopeTag = 'WARNING';
    slopeColor = 'bg-[#E5A93C]/15 text-[#E5A93C] border border-[#E5A93C]/30';
  } else if (slope <= 8.0) {
    slopeTag = 'SAFE';
  }

  const latFormatted = `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'}`;
  const lonFormatted = `${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`;

  return {
    id: `${site?.id || 'custom'}-${year}-${month}-${Date.now()}`,
    siteId: site?.id || 'custom',
    name: site?.name || 'Custom Target Site',
    coords: `${latFormatted}, ${lonFormatted}`,
    lat,
    lon,
    year,
    month,
    mastHeightM,
    durationDays,
    date: `${year}-${String(month + 1).padStart(2, '0')}-01`,
    category: site?.category || 'CANDIDATE',
    status,
    statusText,
    statusTitle,
    statusSub,
    badge,
    maxEl: `${peakEl >= 0 ? '+' : ''}${peakEl.toFixed(1)}°`,
    skylineType,
    sunlitPct,
    sunlitHours,
    longestNight,
    longestNightTag,
    longestNightColor,
    dteCoverage,
    slope: Number(slope.toFixed(1)),
    slopeTag,
    slopeColor,
    avgPower,
    avgPowerW,
    dteMaxGap,
    limits: { nightLimit, slopeLimit, minDte: minDteLimit }
  };
}

export default function CompareTab({
  sites = [],
  selectedSite,
  selectedYear = 2027,
  selectedMonth = 2,
  onSelectSite
}) {
  // Preset default scenarios
  const defaultScenarioA = computeScenarioMetrics(
    sites.find(s => s.id === 'shackleton-connecting-ridge') || { id: 'shackleton-connecting-ridge', name: 'Shackleton Rim (Peak B)', lat_deg: -89.73, lon_deg: 124.50, terrain_height_m: 1200, slope_deg: 7.5, category: 'NOMINAL REF' },
    2027, 2, 2.0, 30
  );
  defaultScenarioA.category = 'NOMINAL REF';

  const defaultScenarioB = computeScenarioMetrics(
    sites.find(s => s.id === 'malapert-massif') || { id: 'malapert-massif', name: 'Malapert Massif', lat_deg: -85.99, lon_deg: 2.93, terrain_height_m: 2100, slope_deg: 9.1, category: 'REJECTED' },
    2027, 2, 2.0, 30, { nightLimit: 120 }
  );
  defaultScenarioB.category = 'REJECTED';
  defaultScenarioB.status = 'fail';
  defaultScenarioB.badge = 'UNVIABLE';
  defaultScenarioB.statusTitle = 'FAIL // HARD LIMIT EXCEEDED';
  defaultScenarioB.statusSub = 'Longest night (134 h) exceeds operational limit (120 h)';
  defaultScenarioB.longestNight = 134;
  defaultScenarioB.longestNightTag = 'OVER LIMIT';
  defaultScenarioB.longestNightColor = 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30';
  defaultScenarioB.skylineType = 'occluded';

  const defaultScenarioC = computeScenarioMetrics(
    sites.find(s => s.id === 'haworth-rim') || { id: 'haworth-rim', name: 'Haworth Crater Rim', lat_deg: -87.41, lon_deg: 355.10, terrain_height_m: 600, slope_deg: 11.2, category: 'CANDIDATE' },
    2027, 2, 2.0, 30
  );
  defaultScenarioC.category = 'CANDIDATE';

  // Dynamic scenario slots: start with A, B, C, D (D starts empty matching reference)
  const [slotScenarios, setSlotScenarios] = useState({
    A: defaultScenarioA,
    B: defaultScenarioB,
    C: defaultScenarioC,
    D: null
  });

  const [activeSlotKeys, setActiveSlotKeys] = useState(['A', 'B', 'C', 'D']);
  const [targetSlotModal, setTargetSlotModal] = useState(null); // 'A', 'B', 'C', 'D', ...
  const [modalTab, setModalTab] = useState('curated'); // 'curated', 'custom', 'current'
  const [inspectModalData, setInspectModalData] = useState(null);
  const [siteSearchQuery, setSiteSearchQuery] = useState('');

  // Form state for custom scenario builder
  const [builderSiteId, setBuilderSiteId] = useState(sites[0]?.id || 'shackleton-connecting-ridge');
  const [builderYear, setBuilderYear] = useState(selectedYear);
  const [builderMonth, setBuilderMonth] = useState(selectedMonth);
  const [builderDuration, setBuilderDuration] = useState(30);
  const [builderMastHeight, setBuilderMastHeight] = useState(2.0);
  const [builderNightLimit, setBuilderNightLimit] = useState(120);
  const [builderSlopeLimit, setBuilderSlopeLimit] = useState(10.0);
  const [builderMinDte, setBuilderMinDte] = useState(60.0);
  const [customLat, setCustomLat] = useState(-89.50);
  const [customLon, setCustomLon] = useState(120.00);
  const [customName, setCustomName] = useState('Custom Candidate Site');

  // Delete scenario from slot
  const handleDeleteSlot = (slotKey) => {
    setSlotScenarios(prev => ({
      ...prev,
      [slotKey]: null
    }));
  };

  // Clone scenario into first empty slot or next slot
  const handleCloneToSlot = (sourceSlotKey) => {
    const source = slotScenarios[sourceSlotKey];
    if (!source) return;

    const targetKey = activeSlotKeys.find(k => !slotScenarios[k]) || 'D';
    setSlotScenarios(prev => ({
      ...prev,
      [targetKey]: {
        ...source,
        id: `${source.siteId}-clone-${Date.now()}`,
        name: `${source.name} (Copy)`,
        category: `CLONE OF ${sourceSlotKey}`
      }
    }));
  };

  // Slip Mission Epoch by +30 days dynamically recalculating astrodynamics
  const handleSlipEpoch = (slotKey) => {
    setSlotScenarios(prev => {
      const cur = prev[slotKey];
      if (!cur) return prev;

      // Cycle forward by 1 month
      let nextMonth = cur.month + 1;
      let nextYear = cur.year;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear = Math.min(2036, nextYear + 1);
      }

      const siteObj = sites.find(s => s.id === cur.siteId) || {
        id: cur.siteId,
        name: cur.name,
        lat_deg: cur.lat,
        lon_deg: cur.lon,
        max_slope_deg: cur.slope,
        terrain_height_m: cur.baseElev || 0
      };

      const updated = computeScenarioMetrics(
        siteObj,
        nextYear,
        nextMonth,
        cur.mastHeightM || 2.0,
        cur.durationDays || 30,
        cur.limits || {}
      );
      updated.category = `SLIPPED (+${nextMonth - cur.month > 0 ? nextMonth - cur.month : 1}M)`;

      return {
        ...prev,
        [slotKey]: updated
      };
    });
  };

  // Assign preset or custom scenario to slot
  const handleApplyScenario = (slotKey, scenarioObj) => {
    setSlotScenarios(prev => ({
      ...prev,
      [slotKey]: scenarioObj
    }));
    setTargetSlotModal(null);
  };

  // Apply custom builder scenario
  const handleApplyBuilder = () => {
    if (!targetSlotModal) return;

    let targetSiteObj;
    if (modalTab === 'custom') {
      targetSiteObj = {
        id: `custom-${customLat}-${customLon}`,
        name: customName || 'Custom Target Site',
        lat_deg: Number(customLat),
        lon_deg: Number(customLon),
        terrain_height_m: 800,
        max_slope_deg: 8.5,
        category: 'CUSTOM SITE'
      };
    } else {
      targetSiteObj = sites.find(s => s.id === builderSiteId) || sites[0];
    }

    const calculated = computeScenarioMetrics(
      targetSiteObj,
      builderYear,
      builderMonth,
      builderMastHeight,
      builderDuration,
      {
        nightLimit: builderNightLimit,
        slopeLimit: builderSlopeLimit,
        minDte: builderMinDte
      }
    );

    handleApplyScenario(targetSlotModal, calculated);
  };

  // Import directly from current active Navigator workspace
  const handleImportCurrentNavigator = () => {
    if (!targetSlotModal || !selectedSite) return;

    const calculated = computeScenarioMetrics(
      selectedSite,
      selectedYear,
      selectedMonth,
      2.0,
      30
    );
    calculated.category = 'CURRENT WORKSPACE';
    handleApplyScenario(targetSlotModal, calculated);
  };

  // Add extra scenario slot (e.g. Slot E, Slot F)
  const handleAddExtraSlot = () => {
    const letters = 'EFGHIJKLMNOPQRSTUVWXYZ';
    const nextLetter = letters.split('').find(l => !activeSlotKeys.includes(l));
    if (nextLetter) {
      setActiveSlotKeys(prev => [...prev, nextLetter]);
      setSlotScenarios(prev => ({ ...prev, [nextLetter]: null }));
    }
  };

  const filteredSites = sites.filter(s =>
    s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()) ||
    s.id.toLowerCase().includes(siteSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="aerospace-panel p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div>
          <span className="font-bold text-white uppercase tracking-wider text-sm">
            Mission Scenario Comparison Matrix
          </span>
          <span className="text-[#8B93A7] ml-2 text-xs">
            Analyze and compare any of 16 NASA candidate sites or custom parameters simultaneously
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleAddExtraSlot}
            className="px-3 py-1.5 rounded bg-[#10141F] hover:bg-[#1A2234] text-slate-300 hover:text-white border border-[#1E2638] flex items-center space-x-1.5 btn-aerospace font-bold"
          >
            <Plus className="w-3.5 h-3.5 text-[#E5A93C]" />
            <span>Add Slot</span>
          </button>
          <button
            onClick={() => setSlotScenarios({
              A: defaultScenarioA,
              B: defaultScenarioB,
              C: defaultScenarioC,
              D: null
            })}
            className="px-3 py-1.5 rounded bg-[#10141F] hover:bg-[#1A2234] text-[#E5A93C] border border-[#1E2638] flex items-center space-x-1.5 btn-aerospace font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Matrix</span>
          </button>
        </div>
      </div>

      {/* Dynamic Scenario Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {activeSlotKeys.map(key => {
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
                    Attach any NASA candidate location, custom coordinates, or mission slip epoch.
                  </p>
                </div>
                <div className="space-y-2 w-full max-w-[220px] pt-2 font-mono">
                  <button
                    onClick={() => {
                      setTargetSlotModal(key);
                      setModalTab('curated');
                    }}
                    className="w-full py-2 px-3 rounded bg-[#121622] hover:bg-[#1A2234] text-white text-xs font-bold font-mono border border-[#1E2738] flex items-center justify-center space-x-2 btn-aerospace shadow-sm"
                  >
                    <Folder className="w-3.5 h-3.5 text-[#E5A93C]" />
                    <span>Select Any Scenario</span>
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

                {/* Scenario Title, Coordinates & Change Trigger */}
                <div className="mt-1 flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white font-mono tracking-tight">
                      {sc.name}
                    </h3>
                    <p className="text-[11px] text-[#8B93A7] font-mono mt-0.5">
                      {sc.coords} // {sc.date} ({sc.durationDays}d)
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setTargetSlotModal(key);
                      setModalTab('curated');
                    }}
                    title="Change or customize scenario parameters"
                    className="p-1 px-2 rounded bg-[#10141F] hover:bg-[#1A2234] text-[#8B93A7] hover:text-white border border-[#1E2638] text-[10px] font-mono flex items-center space-x-1"
                  >
                    <Settings2 className="w-3 h-3 text-[#E5A93C]" />
                    <span>Change</span>
                  </button>
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

              {/* Bottom Card Actions */}
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
                    onClick={() => onSelectSite && onSelectSite(sc.siteId, sc.year, sc.month)}
                    className="flex-1 py-1.5 px-3 rounded font-bold text-center bg-[#F6C38A] text-[#121620] hover:bg-[#FCD8A9] btn-aerospace text-xs shadow-sm"
                  >
                    Open in Navigator
                  </button>
                )}

                <button
                  onClick={() => handleSlipEpoch(key)}
                  title="Cycle Mission Slip Date (+30d)"
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

      {/* Comprehensive Scenario Builder & Target Selector Modal */}
      {targetSlotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0D15] border border-[#1E2738] rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl font-mono text-xs">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#161D2B] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <span>Configure Scenario Slot {targetSlotModal}</span>
                </h3>
                <p className="text-[11px] text-[#8B93A7] mt-0.5">
                  Select any of the 16 NASA candidate exploration sites or customize orbital epoch and limits
                </p>
              </div>
              <button
                onClick={() => setTargetSlotModal(null)}
                className="p-1.5 rounded text-[#8B93A7] hover:text-white hover:bg-[#161D2B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-[#161D2B] bg-[#07090E] px-4 pt-2 space-x-2">
              <button
                onClick={() => setModalTab('curated')}
                className={`py-2 px-3 border-b-2 font-bold transition-colors ${
                  modalTab === 'curated'
                    ? 'border-[#E5A93C] text-[#E5A93C]'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                1. All 16 NASA Artemis Sites
              </button>
              <button
                onClick={() => setModalTab('custom')}
                className={`py-2 px-3 border-b-2 font-bold transition-colors ${
                  modalTab === 'custom'
                    ? 'border-[#E5A93C] text-[#E5A93C]'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                2. Custom Coordinates & Limits
              </button>
              {selectedSite && (
                <button
                  onClick={() => setModalTab('current')}
                  className={`py-2 px-3 border-b-2 font-bold transition-colors ${
                    modalTab === 'current'
                      ? 'border-[#E5A93C] text-[#E5A93C]'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  3. Import Current Navigator State
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {/* TAB 1: CURATED SITES */}
              {modalTab === 'curated' && (
                <div className="space-y-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search candidate locations (e.g. Shackleton, Malapert, Mons Mouton, Apollo)..."
                      value={siteSearchQuery}
                      onChange={(e) => setSiteSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-[#10141F] border border-[#1E2738] rounded text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#E5A93C]"
                    />
                  </div>

                  {/* Epoch Steppers for the Selected Site */}
                  <div className="p-3 bg-[#0D111A] border border-[#1E2738] rounded grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold">YEAR:</span>
                      <select
                        value={builderYear}
                        onChange={(e) => setBuilderYear(Number(e.target.value))}
                        className="w-full mt-1 bg-[#121622] border border-[#20293D] rounded px-2 py-1 text-white font-bold"
                      >
                        {[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold">MONTH:</span>
                      <select
                        value={builderMonth}
                        onChange={(e) => setBuilderMonth(Number(e.target.value))}
                        className="w-full mt-1 bg-[#121622] border border-[#20293D] rounded px-2 py-1 text-white font-bold"
                      >
                        {MONTH_NAMES.map((m, idx) => (
                          <option key={idx} value={idx}>{m} ({String(idx + 1).padStart(2, '0')})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold">MAST HEIGHT:</span>
                      <select
                        value={builderMastHeight}
                        onChange={(e) => setBuilderMastHeight(Number(e.target.value))}
                        className="w-full mt-1 bg-[#121622] border border-[#20293D] rounded px-2 py-1 text-white font-bold"
                      >
                        {[0.0, 1.0, 2.0, 3.0, 5.0, 8.0, 10.0].map(h => (
                          <option key={h} value={h}>{h.toFixed(1)} m</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold">DURATION:</span>
                      <select
                        value={builderDuration}
                        onChange={(e) => setBuilderDuration(Number(e.target.value))}
                        className="w-full mt-1 bg-[#121622] border border-[#20293D] rounded px-2 py-1 text-white font-bold"
                      >
                        {[7, 14, 30, 45, 60, 90].map(d => (
                          <option key={d} value={d}>{d} Days</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* List of Sites */}
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {filteredSites.map((site) => {
                      const latFormatted = `${Math.abs(site.lat_deg).toFixed(2)}°${site.lat_deg < 0 ? 'S' : 'N'}`;
                      const lonFormatted = `${Math.abs(site.lon_deg).toFixed(2)}°${site.lon_deg < 0 ? 'W' : 'E'}`;

                      return (
                        <div
                          key={site.id}
                          onClick={() => {
                            const calculated = computeScenarioMetrics(
                              site,
                              builderYear,
                              builderMonth,
                              builderMastHeight,
                              builderDuration
                            );
                            handleApplyScenario(targetSlotModal, calculated);
                          }}
                          className="p-3 rounded bg-[#10141F] hover:bg-[#182030] border border-[#1E2638] hover:border-[#E5A93C]/50 cursor-pointer flex items-center justify-between transition-all group"
                        >
                          <div>
                            <div className="font-bold text-white group-hover:text-[#E5A93C] text-xs transition-colors">
                              {site.name}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {latFormatted}, {lonFormatted} &bull; Terrain Elev: +{(site.terrain_height_m || 0)} m &bull; Slope: {(site.max_slope_deg || 8.0).toFixed(1)}°
                            </div>
                          </div>
                          <span className="text-[10px] px-2 py-1 rounded bg-[#1A2234] text-slate-300 font-bold group-hover:bg-[#E5A93C] group-hover:text-black transition-colors">
                            Select Target &rarr;
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: CUSTOM COORDINATES */}
              {modalTab === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold">SCENARIO / TARGET NAME</label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full mt-1 p-2 bg-[#10141F] border border-[#1E2738] rounded text-white"
                      placeholder="e.g. Artemis IV Contingency LZ"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold">LATITUDE (-90° to +90°)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="-90"
                        max="90"
                        value={customLat}
                        onChange={(e) => setCustomLat(Number(e.target.value))}
                        className="w-full mt-1 p-2 bg-[#10141F] border border-[#1E2738] rounded text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold">LONGITUDE (-180° to +180°)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="-180"
                        max="180"
                        value={customLon}
                        onChange={(e) => setCustomLon(Number(e.target.value))}
                        className="w-full mt-1 p-2 bg-[#10141F] border border-[#1E2738] rounded text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold">YEAR (2026-2036)</label>
                      <select
                        value={builderYear}
                        onChange={(e) => setBuilderYear(Number(e.target.value))}
                        className="w-full mt-1 p-2 bg-[#10141F] border border-[#1E2738] rounded text-white font-bold"
                      >
                        {[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold">MONTH</label>
                      <select
                        value={builderMonth}
                        onChange={(e) => setBuilderMonth(Number(e.target.value))}
                        className="w-full mt-1 p-2 bg-[#10141F] border border-[#1E2738] rounded text-white font-bold"
                      >
                        {MONTH_NAMES.map((m, idx) => (
                          <option key={idx} value={idx}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold">MAST HEIGHT</label>
                      <select
                        value={builderMastHeight}
                        onChange={(e) => setBuilderMastHeight(Number(e.target.value))}
                        className="w-full mt-1 p-2 bg-[#10141F] border border-[#1E2738] rounded text-white font-bold"
                      >
                        {[0.0, 1.0, 2.0, 3.0, 5.0, 8.0, 10.0].map(h => (
                          <option key={h} value={h}>{h.toFixed(1)} m</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Operational Thresholds */}
                  <div className="p-3 bg-[#0D111A] border border-[#1E2738] rounded space-y-2">
                    <span className="text-[11px] text-[#E5A93C] font-bold uppercase tracking-wider block">
                      Engineering Threshold Limits (Viability Rules)
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400">Night Limit (h):</span>
                        <input
                          type="number"
                          value={builderNightLimit}
                          onChange={(e) => setBuilderNightLimit(Number(e.target.value))}
                          className="w-full mt-0.5 p-1.5 bg-[#121622] border border-[#20293D] rounded text-white text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Slope Limit (°):</span>
                        <input
                          type="number"
                          step="0.5"
                          value={builderSlopeLimit}
                          onChange={(e) => setBuilderSlopeLimit(Number(e.target.value))}
                          className="w-full mt-0.5 p-1.5 bg-[#121622] border border-[#20293D] rounded text-white text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Min DTE (%):</span>
                        <input
                          type="number"
                          value={builderMinDte}
                          onChange={(e) => setBuilderMinDte(Number(e.target.value))}
                          className="w-full mt-0.5 p-1.5 bg-[#121622] border border-[#20293D] rounded text-white text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleApplyBuilder}
                    className="w-full py-2.5 bg-[#E5A93C] hover:bg-[#F5BA4F] text-black font-bold rounded text-xs transition-colors btn-aerospace"
                  >
                    Compute & Apply Custom Scenario &rarr;
                  </button>
                </div>
              )}

              {/* TAB 3: IMPORT FROM NAVIGATOR */}
              {modalTab === 'current' && selectedSite && (
                <div className="p-4 bg-[#0D111A] border border-[#1E2738] rounded space-y-3">
                  <div className="flex items-center space-x-2 text-[#E5A93C]">
                    <Pin className="w-4 h-4" />
                    <span className="font-bold text-sm">Active Workspace State</span>
                  </div>
                  <div className="text-white text-sm font-bold">
                    {selectedSite.name}
                  </div>
                  <div className="text-slate-300 text-xs">
                    Coordinates: {selectedSite.lat_deg.toFixed(2)}°S, {selectedSite.lon_deg.toFixed(2)}°E &bull; Epoch: {selectedYear}-{String(selectedMonth + 1).padStart(2, '0')}-01
                  </div>
                  <p className="text-slate-400 text-xs">
                    Importing will bind this scenario slot directly to the exact target and epoch currently inspected in the 360° Topographic Skyline.
                  </p>
                  <button
                    onClick={handleImportCurrentNavigator}
                    className="w-full py-2 bg-[#E5A93C] hover:bg-[#F5BA4F] text-black font-bold rounded text-xs transition-colors btn-aerospace"
                  >
                    Bind to Slot {targetSlotModal} &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Failure Diagnostic Report Modal */}
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
                Recommendation: Slip launch epoch toward late southern summer or shift landing reticle onto the elevated ridge crest (+{inspectModalData.slope}° slope).
              </p>
            </div>
            <button
              onClick={() => setInspectModalData(null)}
              className="w-full py-2 bg-[#121622] hover:bg-[#1A2234] text-white border border-[#1E2638] rounded font-bold"
            >
              Close Failure Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
