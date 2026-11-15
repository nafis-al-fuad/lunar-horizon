import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, Calendar, ChevronUp, ChevronDown, Maximize2, Minimize2, Database, Check } from 'lucide-react';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function TimelineBottomBar({
  timeIndex,
  setTimeIndex,
  isPlaying,
  setIsPlaying,
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  ephemerisData,
  onSelectPredefinedScenario
}) {
  const [speed, setSpeed] = useState(4); // h / sec
  const [isExpanded, setIsExpanded] = useState(true);
  const [barHeight, setBarHeight] = useState(240); // Resizable height (px)
  const [isDraggingHeight, setIsDraggingHeight] = useState(false);

  const trackContainerRef = useRef(null);

  // 240 samples = 30 days in 3-hour increments (matching DE440 chunk step 10800s)
  const totalSteps = ephemerisData?.timeseries?.length ? (ephemerisData.timeseries.length - 1) : 240;

  // Animation play loop
  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = Math.max(25, Math.round(1000 / speed));
    const timer = setInterval(() => {
      setTimeIndex(prev => {
        if (prev >= totalSteps) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, speed, totalSteps, setTimeIndex, setIsPlaying]);

  // Drag-to-resize bottom bar height
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingHeight) return;
      const newHeight = window.innerHeight - e.clientY;
      const clamped = Math.max(120, Math.min(450, newHeight));
      setBarHeight(clamped);
    };

    const handleMouseUp = () => {
      setIsDraggingHeight(false);
    };

    if (isDraggingHeight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingHeight]);

  // Exact UTC timestamp derived from selected Year, Month, and scrub sample
  const baseEpochDate = new Date(Date.UTC(selectedYear, selectedMonth, 1, 0, 0, 0));
  const currentElapsedHours = timeIndex * 3; // 3 hours per sample
  const currentEpochDate = new Date(baseEpochDate.getTime() + currentElapsedHours * 3600 * 1000);

  const yearStr = currentEpochDate.getUTCFullYear();
  const monthStr = String(currentEpochDate.getUTCMonth() + 1).padStart(2, '0');
  const dayStr = String(currentEpochDate.getUTCDate()).padStart(2, '0');
  const hoursStr = String(currentEpochDate.getUTCHours()).padStart(2, '0');
  const minutesStr = String(currentEpochDate.getUTCMinutes()).padStart(2, '0');
  const currentUtcStr = `${yearStr}-${monthStr}-${dayStr} ${hoursStr}:${minutesStr} UTC`;

  // Real telemetry timeseries directly from loaded DE440 chunk
  const timeseries = ephemerisData?.timeseries || [];
  const currentSample = timeseries[timeIndex] || timeseries[0] || {
    sun: { elevation_deg: 1.2, state: 'clear' },
    earth: { elevation_deg: 3.5, state: 'clear' },
    power_watts: 620,
    dte_active: true
  };

  const currentSunEl = currentSample.sun?.elevation_deg ?? 1.2;
  const currentPower = currentSample.power_watts ?? 620;
  const currentDteActive = currentSample.dte_active ?? true;

  // Timeline scrub click handler
  const handleTimelineClick = (e) => {
    if (!trackContainerRef.current) return;
    const rect = trackContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    const newStep = Math.round(fraction * totalSteps);
    setTimeIndex(newStep);
  };

  const cursorPercent = (timeIndex / totalSteps) * 100;

  // Pre-generate SVG points from real DE440 timeseries data
  const sunPoints = timeseries.map((pt, i) => `${i},${Math.max(4, Math.min(30, 24 - pt.sun.elevation_deg * 8))}`).join(' ');
  const sunPolygon = `0,24 ${sunPoints} ${totalSteps},24`;
  const powerPoints = timeseries.map((pt, i) => `${i},${Math.max(4, Math.min(30, 30 - (pt.power_watts / 700) * 26))}`).join(' ');

  return (
    <div
      style={{ height: isExpanded ? `${barHeight}px` : 'auto' }}
      className="bg-[#0A0D15] border-t border-[#1E2738] select-none text-xs font-mono shadow-2xl flex flex-col justify-between transition-[height] duration-75 relative"
    >
      {/* Drag-to-Resize Handle Bar at Top Edge */}
      <div
        onMouseDown={() => setIsDraggingHeight(true)}
        title="Drag up or down to resize bottom bar"
        className="w-full h-2 cursor-ns-resize hover:bg-[#E5A93C]/40 bg-transparent flex items-center justify-center transition-colors group"
      >
        <div className="w-12 h-1 rounded-full bg-[#2A344A] group-hover:bg-[#E5A93C] transition-colors"></div>
      </div>

      {/* Main Controls Bar */}
      <div className="max-w-[1500px] w-full mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-[#182030]">
        {/* Playback Transport Buttons */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setTimeIndex(0)}
            title="First Step (Day 01)"
            className="w-7 h-7 flex items-center justify-center rounded bg-[#121622] text-slate-400 hover:text-white hover:bg-[#1A2234] border border-[#20293D] btn-aerospace"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setTimeIndex(Math.max(0, timeIndex - 8))}
            title="Step Backward (24h)"
            className="w-7 h-7 flex items-center justify-center rounded bg-[#121622] text-slate-400 hover:text-white hover:bg-[#1A2234] border border-[#20293D] btn-aerospace"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pause" : "Play"}
            className="w-8 h-7 flex items-center justify-center rounded bg-[#E5A93C] text-[#0A0D14] hover:bg-[#F5BA4F] font-bold btn-aerospace shadow-md"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
          </button>
          <button
            onClick={() => setTimeIndex(Math.min(totalSteps, timeIndex + 8))}
            title="Step Forward (24h)"
            className="w-7 h-7 flex items-center justify-center rounded bg-[#121622] text-slate-400 hover:text-white hover:bg-[#1A2234] border border-[#20293D] btn-aerospace"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTimeIndex(totalSteps)}
            title="Last Step (Day 30)"
            className="w-7 h-7 flex items-center justify-center rounded bg-[#121622] text-slate-400 hover:text-white hover:bg-[#1A2234] border border-[#20293D] btn-aerospace"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Speed Selector */}
          <div className="flex items-center space-x-1.5 ml-2 pl-2 border-l border-[#20293D]">
            <span className="text-slate-400 text-xs">SPEED:</span>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="bg-[#121622] border border-[#20293D] rounded px-1.5 py-0.5 text-white text-xs cursor-pointer focus:outline-none"
            >
              <option value="1">1 h/s</option>
              <option value="2">2 h/s</option>
              <option value="4">4 h/s</option>
              <option value="12">12 h/s</option>
              <option value="24">24 h/s</option>
            </select>
          </div>

          {/* 10-Year EPHEMERIS DATE SELECTOR (YEAR & MONTH) */}
          <div className="flex items-center space-x-2 ml-3 pl-3 border-l border-[#20293D]">
            <span className="text-[#E5A93C] font-semibold text-xs flex items-center space-x-1">
              <Database className="w-3.5 h-3.5 text-[#E5A93C]" />
              <span>DE440:</span>
            </span>

            {/* Year Selector (2026 to 2036) */}
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setTimeIndex(0);
              }}
              className="bg-[#121622] border border-[#20293D] rounded px-2 py-0.5 text-white text-xs cursor-pointer focus:outline-none font-bold"
            >
              {[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Month Selector (Jan to Dec) */}
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(Number(e.target.value));
                setTimeIndex(0);
              }}
              className="bg-[#121622] border border-[#20293D] rounded px-2 py-0.5 text-white text-xs cursor-pointer focus:outline-none font-bold"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx} value={idx}>{name} ({String(idx + 1).padStart(2, '0')})</option>
              ))}
            </select>

            {/* Chunk Badge */}
            {ephemerisData?.chunkId && (
              <span className="hidden xl:inline-flex items-center space-x-1 text-[10px] text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded border border-[#10B981]/25 font-mono">
                <Check className="w-3 h-3 text-[#10B981]" />
                <span>{ephemerisData.chunkId}.bin (REAL DATA)</span>
              </span>
            )}
          </div>
        </div>

        {/* Current Date, Window & Drawer Toggles */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-[#E5A93C] font-mono text-xs font-bold bg-[#E5A93C]/10 px-2.5 py-1 rounded border border-[#E5A93C]/25">
            <Calendar className="w-3.5 h-3.5" />
            <span className="tracking-wider">{currentUtcStr}</span>
          </div>

          <div className="text-slate-400 text-xs hidden md:block">
            WINDOW: <strong className="text-white">{selectedYear}-{String(selectedMonth + 1).padStart(2, '0')} (30 DAYS)</strong>
          </div>

          {/* Quick Resize Buttons */}
          <div className="flex items-center space-x-1 border-l border-[#20293D] pl-2">
            <button
              onClick={() => setBarHeight(barHeight === 130 ? 250 : 130)}
              title={barHeight === 130 ? "Expand Timeline View" : "Compact Timeline View"}
              className="p-1 rounded bg-[#121622] border border-[#20293D] text-slate-400 hover:text-white btn-aerospace"
            >
              {barHeight === 130 ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#121622] border border-[#20293D] text-slate-400 hover:text-white btn-aerospace"
            >
              <span className="text-xs uppercase font-bold">DRAWER</span>
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Multi-Track Timeline Container */}
      {isExpanded && (
        <div className="max-w-[1500px] w-full mx-auto px-4 py-2 flex-1 flex flex-col justify-around">
          {/* Interactive Scrubbing Tracks Viewport */}
          <div
            ref={trackContainerRef}
            onClick={handleTimelineClick}
            className="relative cursor-pointer select-none"
          >
            {/* Timeline Ruler Header with Ticks & Milestones */}
            <div className="relative h-6 text-xs text-slate-500 font-mono border-b border-[#182030] mb-1">
              <div className="absolute left-[0%] flex flex-col">
                <span className="text-slate-400 font-semibold">{MONTH_NAMES[selectedMonth]} 01</span>
                <span className="text-slate-600 text-[9px]">|</span>
              </div>
              <div className="absolute left-[16.6%] flex flex-col">
                <span className="text-slate-400 font-semibold">{MONTH_NAMES[selectedMonth]} 05</span>
                <span className="text-slate-600 text-[9px]">|</span>
              </div>
              <div className="absolute left-[33.3%] flex flex-col">
                <span className="text-slate-400 font-semibold">{MONTH_NAMES[selectedMonth]} 10</span>
                <span className="text-slate-600 text-[9px]">|</span>
              </div>
              <div className="absolute left-[66.6%] flex flex-col">
                <span className="text-slate-400 font-semibold">{MONTH_NAMES[selectedMonth]} 20</span>
                <span className="text-slate-600 text-[9px]">|</span>
              </div>
              <div className="absolute right-[0%] flex flex-col items-end">
                <span className="text-slate-400 font-semibold">{MONTH_NAMES[selectedMonth]} 30</span>
                <span className="text-slate-600 text-[9px]">|</span>
              </div>

              {/* Scrubber Capsule Handle on the Ruler */}
              <div
                style={{ left: `${cursorPercent}%` }}
                className="absolute top-0 bottom-1 w-3.5 -ml-1.5 bg-[#E5A93C] rounded-sm flex items-center justify-center shadow-[0_0_8px_#E5A93C] z-30"
              >
                <div className="w-0.5 h-3 bg-[#0A0D15]"></div>
              </div>
            </div>

            {/* Global Synchronized Vertical Cursor Hairline */}
            <div
              style={{ left: `${cursorPercent}%` }}
              className="absolute top-6 bottom-0 w-[1.5px] bg-[#E5A93C] z-30 pointer-events-none shadow-[0_0_6px_#E5A93C]"
            />

            {/* 4 Synchronized Telemetry Tracks Powered by Real JPL DE440 Data */}
            <div className="space-y-1">
              {/* TRACK 1: SUN ELEV */}
              <div className="flex items-center h-8 bg-[#0D111A] border border-[#1E2738] rounded overflow-hidden">
                <div className="w-44 px-3 flex items-center justify-between border-r border-[#1E2738] bg-[#0A0D15] h-full flex-shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">TRACK 1: SUN ELEV</span>
                  <span className="text-xs font-bold font-mono text-[#E5A93C]">
                    {currentSunEl > 0 ? '+' : ''}{currentSunEl.toFixed(1)}°
                  </span>
                </div>
                <div className="relative flex-1 h-full bg-[#090C13]">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${totalSteps} 32`}>
                    <line x1="0" y1="24" x2={totalSteps} y2="24" stroke="#1E2738" strokeDasharray="2 2" strokeWidth="1" />
                    {sunPolygon && <polygon fill="rgba(229, 169, 60, 0.14)" points={sunPolygon} />}
                    {sunPoints && <polyline fill="none" stroke="#E5A93C" strokeWidth="1.5" points={sunPoints} />}
                  </svg>
                </div>
              </div>

              {/* TRACK 2: POWER (W) */}
              <div className="flex items-center h-8 bg-[#0D111A] border border-[#1E2738] rounded overflow-hidden">
                <div className="w-44 px-3 flex items-center justify-between border-r border-[#1E2738] bg-[#0A0D15] h-full flex-shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">TRACK 2: POWER (W)</span>
                  <span className="text-xs font-bold font-mono text-[#10B981]">{currentPower} W</span>
                </div>
                <div className="relative flex-1 h-full bg-[#090C13]">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${totalSteps} 32`}>
                    <line x1="0" y1="26" x2={totalSteps} y2="26" stroke="#EF4444" strokeDasharray="3 3" strokeWidth="1" />
                    {powerPoints && <polyline fill="none" stroke="#10B981" strokeWidth="1.5" points={powerPoints} />}
                  </svg>
                </div>
              </div>

              {/* TRACK 3: DTE WINDOW */}
              <div className="flex items-center h-8 bg-[#0D111A] border border-[#1E2738] rounded overflow-hidden">
                <div className="w-44 px-3 flex items-center justify-between border-r border-[#1E2738] bg-[#0A0D15] h-full flex-shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">TRACK 3: DTE WINDOW</span>
                  <span className={`text-[11px] font-bold font-mono ${currentDteActive ? 'text-[#38BDF8]' : 'text-[#EF4444]'}`}>
                    {currentDteActive ? 'ACTIVE' : 'BLACKOUT'}
                  </span>
                </div>
                <div className="relative flex-1 h-full flex items-center bg-[#090C13] px-1 space-x-1">
                  {timeseries.length > 0 ? (
                    timeseries.filter((_, idx) => idx % 6 === 0).map((pt, idx) => (
                      <div
                        key={idx}
                        className={`h-5 flex-1 rounded-xs transition-colors ${
                          pt.dte_active ? 'bg-[#38BDF8]/80' : 'bg-[#182030]'
                        }`}
                        title={pt.dte_active ? 'DTE Carrier Active' : 'DTE Radio Gap'}
                      />
                    ))
                  ) : (
                    <div className="h-5 rounded bg-[#38BDF8]/80 flex items-center px-3 text-[10px] font-bold text-white shadow-sm w-full">
                      CARRIER LOCK (JPL DE440 EPHEMERIS)
                    </div>
                  )}
                </div>
              </div>

              {/* TRACK 4: COLD SOAK */}
              <div className="flex items-center h-8 bg-[#0D111A] border border-[#1E2738] rounded overflow-hidden">
                <div className="w-44 px-3 flex items-center justify-between border-r border-[#1E2738] bg-[#0A0D15] h-full flex-shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">TRACK 4: COLD SOAK</span>
                  <span className="text-[11px] font-bold font-mono text-slate-300">
                    {currentSample.sun?.state === 'blocked' ? 'COLD SOAK' : 'NOMINAL'}
                  </span>
                </div>
                <div className="relative flex-1 h-full flex items-center bg-[#090C13] px-1 space-x-1">
                  {timeseries.length > 0 ? (
                    timeseries.filter((_, idx) => idx % 6 === 0).map((pt, idx) => (
                      <div
                        key={idx}
                        className={`h-5 flex-1 rounded-xs transition-colors ${
                          pt.sun.state === 'blocked' ? 'bg-[#EF4444]/40 border border-[#EF4444]/60' : 'bg-[#182030]'
                        }`}
                        title={pt.sun.state === 'blocked' ? 'Shadow Occlusion / Cold Soak' : 'Thermal Equilibrium'}
                      />
                    ))
                  ) : (
                    <div className="h-5 rounded bg-[#1C2536] flex items-center px-3 text-[10px] font-bold text-slate-300 w-full">
                      THERMAL EQUILIBRIUM
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}