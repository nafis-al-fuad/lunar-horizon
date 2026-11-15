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
  const [stepSize, setStepSize] = useState('1h');
  const [isExpanded, setIsExpanded] = useState(true);
  const [barHeight, setBarHeight] = useState(250); // Resizable height (px)
  const [isDraggingHeight, setIsDraggingHeight] = useState(false);

  const trackContainerRef = useRef(null);

  // 240 samples = 30 days in 3-hour increments (matching DE440 chunk step 10800s)
  const totalSteps = ephemerisData?.timeseries?.length ? (ephemerisData.timeseries.length - 1) : 240;

  // Step increments in sample units (each sample is 3 hours)
  const getStepDelta = () => {
    switch (stepSize) {
      case '15m': return 1;
      case '1h': return 1;
      case '3h': return 1;
      case '6h': return 2;
      case '24h': return 8;
      default: return 1;
    }
  };

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
        return Math.min(totalSteps, prev + 1);
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, speed, totalSteps, setTimeIndex, setIsPlaying]);

  // Drag-to-resize bottom bar height
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingHeight) return;
      const newHeight = window.innerHeight - e.clientY;
      const clamped = Math.max(130, Math.min(460, newHeight));
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

  const windowStartStr = `${yearStr}-${monthStr}-01`;
  const windowEndStr = `${yearStr}-${monthStr}-31`;

  // Real telemetry timeseries directly from loaded DE440 chunk
  const timeseries = ephemerisData?.timeseries || [];
  const currentSample = timeseries[timeIndex] || timeseries[0] || {
    sun: { elevation_deg: 1.4, state: 'clear' },
    earth: { elevation_deg: 3.5, state: 'clear' },
    power_watts: 620,
    dte_active: true
  };

  const currentSunEl = currentSample.sun?.elevation_deg ?? 1.4;
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

  // Generate SVG path for Track 1 (Sun Elevation)
  // Curve rises, crests around +1.8°, and gently descends
  const sunPathD = timeseries.length > 0
    ? timeseries.map((pt, i) => {
        const x = (i / totalSteps) * 1000;
        const el = pt.sun.elevation_deg;
        // Map elevation from -2° to +3° into SVG y 4 to 28
        const y = 24 - (el / 2.5) * 14;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${Math.max(4, Math.min(28, y)).toFixed(1)}`;
      }).join(' ')
    : "M 0 22 C 200 10, 400 8, 500 12 C 650 16, 800 24, 1000 16";

  const sunAreaD = timeseries.length > 0
    ? `${sunPathD} L 1000 32 L 0 32 Z`
    : "M 0 22 C 200 10, 400 8, 500 12 C 650 16, 800 24, 1000 16 L 1000 32 L 0 32 Z";

  // Generate SVG path for Track 2 (Power W) with occultation dip
  const powerPathD = timeseries.length > 0
    ? timeseries.map((pt, i) => {
        const x = (i / totalSteps) * 1000;
        const p = pt.power_watts;
        // Map 0 - 700 W to SVG y 28 to 6
        const y = 28 - (p / 700) * 22;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${Math.max(4, Math.min(28, y)).toFixed(1)}`;
      }).join(' ')
    : "M 0 10 C 250 8, 480 8, 650 10 C 720 12, 740 28, 770 28 C 820 28, 850 26, 1000 20";

  return (
    <div
      style={{ height: isExpanded ? `${barHeight}px` : 'auto' }}
      className="bg-[#07090E] border-t border-[#161D2B] select-none text-xs font-mono shadow-2xl flex flex-col justify-between transition-[height] duration-75 relative z-40"
    >
      {/* Drag-to-Resize Handle Bar at Top Edge */}
      <div
        onMouseDown={() => setIsDraggingHeight(true)}
        title="Drag up or down to resize bottom bar"
        className="w-full h-2 cursor-ns-resize hover:bg-[#E5A93C]/40 bg-transparent flex items-center justify-center transition-colors group"
      >
        <div className="w-12 h-1 rounded-full bg-[#1F2738] group-hover:bg-[#E5A93C] transition-colors"></div>
      </div>

      {/* Main Controls Bar (matching reference layout) */}
      <div className="w-full px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#141A26]">
        {/* Playback Transport Buttons & Controls */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setTimeIndex(0)}
            title="First Step (Day 01)"
            className="w-6 h-6 flex items-center justify-center rounded bg-[#10141F] text-slate-400 hover:text-white hover:bg-[#1A2234] border border-[#1E2638] btn-aerospace"
          >
            <SkipBack className="w-3 h-3" />
          </button>
          <button
            onClick={() => setTimeIndex(Math.max(0, timeIndex - getStepDelta()))}
            title="Step Backward"
            className="w-6 h-6 flex items-center justify-center rounded bg-[#10141F] text-slate-400 hover:text-white hover:bg-[#1A2234] border border-[#1E2638] btn-aerospace"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pause" : "Play"}
            className="w-7 h-6 flex items-center justify-center rounded bg-[#E5A93C] text-[#0A0D14] hover:bg-[#F5BA4F] font-bold btn-aerospace shadow-sm"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />}
          </button>
          <button
            onClick={() => setTimeIndex(Math.min(totalSteps, timeIndex + getStepDelta()))}
            title="Step Forward"
            className="w-6 h-6 flex items-center justify-center rounded bg-[#10141F] text-slate-400 hover:text-white hover:bg-[#1A2234] border border-[#1E2638] btn-aerospace"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setTimeIndex(totalSteps)}
            title="Last Step (Day 30)"
            className="w-6 h-6 flex items-center justify-center rounded bg-[#10141F] text-slate-400 hover:text-white hover:bg-[#1A2234] border border-[#1E2638] btn-aerospace"
          >
            <SkipForward className="w-3 h-3" />
          </button>

          {/* Speed Selector */}
          <div className="flex items-center space-x-1.5 ml-2 pl-2 border-l border-[#1A2234]">
            <span className="text-[#8B93A7] text-[11px] font-bold uppercase tracking-wider">SPEED:</span>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="bg-[#10141F] border border-[#1E2638] rounded px-1.5 py-0.5 text-white text-[11px] cursor-pointer focus:outline-none"
            >
              <option value="1">1 h/sec</option>
              <option value="2">2 h/sec</option>
              <option value="4">4 h/sec</option>
              <option value="12">12 h/sec</option>
              <option value="24">24 h/sec</option>
            </select>
          </div>

          {/* Step Selector */}
          <div className="flex items-center space-x-1.5 ml-1.5">
            <span className="text-[#8B93A7] text-[11px] font-bold uppercase tracking-wider">STEP:</span>
            <select
              value={stepSize}
              onChange={(e) => setStepSize(e.target.value)}
              className="bg-[#10141F] border border-[#1E2638] rounded px-1.5 py-0.5 text-white text-[11px] cursor-pointer focus:outline-none"
            >
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="3h">3h</option>
              <option value="6h">6h</option>
              <option value="24h">24h</option>
            </select>
          </div>

          {/* 10-Year EPHEMERIS DATE SELECTOR (YEAR & MONTH) */}
          <div className="hidden lg:flex items-center space-x-1.5 ml-2 pl-2 border-l border-[#1A2234]">
            <span className="text-[#E5A93C] font-semibold text-[11px] flex items-center space-x-1">
              <Database className="w-3 h-3 text-[#E5A93C]" />
              <span>DE440:</span>
            </span>

            {/* Year Selector (2026 to 2036) */}
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setTimeIndex(0);
              }}
              className="bg-[#10141F] border border-[#1E2638] rounded px-1.5 py-0.5 text-white text-[11px] cursor-pointer focus:outline-none font-bold"
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
              className="bg-[#10141F] border border-[#1E2638] rounded px-1.5 py-0.5 text-white text-[11px] cursor-pointer focus:outline-none font-bold"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Current Date, Window & Drawer Toggles */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 text-[#E5A93C] font-mono text-xs font-bold">
            <Calendar className="w-3.5 h-3.5 text-[#E5A93C]" />
            <span className="tracking-wide">{currentUtcStr}</span>
          </div>

          <div className="text-[#8B93A7] text-[11px] hidden sm:block font-mono">
            ANALYSIS WINDOW: <span className="text-slate-300 font-semibold">{windowStartStr} &rarr; {windowEndStr} (30 DAYS)</span>
          </div>

          {/* Quick Resize / Collapse Buttons */}
          <div className="flex items-center space-x-1.5 border-l border-[#1A2234] pl-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#10141F] border border-[#1E2638] text-[#8B93A7] hover:text-white btn-aerospace"
            >
              <span className="text-[10px] uppercase font-bold tracking-wider">TIMELINES</span>
              {isExpanded ? <ChevronUp className="w-3 h-3 text-[#E5A93C]" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Multi-Track Timeline Container */}
      {isExpanded && (
        <div className="w-full px-4 py-2 flex-1 flex flex-col justify-between">
          {/* Interactive Scrubbing Tracks Viewport */}
          <div
            ref={trackContainerRef}
            onClick={handleTimelineClick}
            className="relative cursor-pointer select-none"
          >
            {/* Timeline Ruler Header with Ticks & Events (matching reference) */}
            <div className="relative h-6 text-[10px] text-slate-500 font-mono border-b border-[#141A26] mb-1">
              {/* Ticks */}
              <div className="absolute left-[0%] flex flex-col">
                <span className="text-slate-400 font-medium">MAR 01</span>
                <span className="text-slate-600 text-[8px] leading-none">|</span>
              </div>
              <div className="absolute left-[16.6%] flex flex-col">
                <span className="text-slate-400 font-medium">MAR 05</span>
                <span className="text-slate-600 text-[8px] leading-none">|</span>
              </div>
              <div className="absolute left-[33.3%] flex flex-col">
                <span className="text-slate-400 font-medium">MAR 10</span>
                <span className="text-slate-600 text-[8px] leading-none">|</span>
              </div>

              {/* Event Pins matching reference screenshot */}
              <div className="absolute left-[47%] flex items-center space-x-1 text-[#E5A93C] text-[10px] font-bold">
                <span>&#9660; SUNSET 15</span>
              </div>
              <div className="absolute left-[65%] flex items-center space-x-1 text-[#38BDF8] text-[10px]">
                <span>&bull; EARTHSET</span>
              </div>
              <div className="absolute left-[70%] flex items-center space-x-1 text-[#F87171] text-[10px]">
                <span>&#10022; ECLIPSE</span>
              </div>

              <div className="absolute left-[83.3%] flex flex-col">
                <span className="text-slate-400 font-medium">MAR 25</span>
                <span className="text-slate-600 text-[8px] leading-none">|</span>
              </div>
              <div className="absolute right-[0%] flex flex-col items-end">
                <span className="text-slate-400 font-medium">MAR 31</span>
                <span className="text-slate-600 text-[8px] leading-none">|</span>
              </div>

              {/* Amber Scrubber Capsule Handle on the Ruler */}
              <div
                style={{ left: `${cursorPercent}%` }}
                className="absolute top-0 bottom-1 w-3 -ml-1.5 bg-[#E5A93C] rounded-sm flex items-center justify-center shadow-[0_0_8px_#E5A93C] z-30 pointer-events-none"
              >
                <div className="w-0.5 h-3 bg-[#07090E]"></div>
              </div>
            </div>

            {/* Global Synchronized Vertical Cursor Hairline */}
            <div
              style={{ left: `${cursorPercent}%` }}
              className="absolute top-6 bottom-0 w-[1.5px] bg-[#E5A93C] z-30 pointer-events-none shadow-[0_0_6px_#E5A93C]"
            />

            {/* 4 Synchronized Telemetry Tracks */}
            <div className="space-y-1">
              {/* TRACK 1: SUN ELEV */}
              <div className="flex items-center h-8 bg-[#090C14] border border-[#161D2B] rounded overflow-hidden">
                <div className="w-44 px-3 flex items-center justify-between border-r border-[#161D2B] bg-[#07090E] h-full flex-shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">TRACK 1: SUN ELEV</span>
                  <span className="text-xs font-bold font-mono text-[#E5A93C]">
                    {currentSunEl > 0 ? '+' : ''}{currentSunEl.toFixed(1)}°
                  </span>
                </div>
                <div className="relative flex-1 h-full bg-[#080B12]">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 32">
                    <line x1="0" y1="20" x2="1000" y2="20" stroke="#161D2B" strokeDasharray="3 3" strokeWidth="1" />
                    <path d={sunAreaD} fill="rgba(229, 169, 60, 0.12)" />
                    <path d={sunPathD} fill="none" stroke="#E5A93C" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>

              {/* TRACK 2: POWER (W) */}
              <div className="flex items-center h-8 bg-[#090C14] border border-[#161D2B] rounded overflow-hidden">
                <div className="w-44 px-3 flex items-center justify-between border-r border-[#161D2B] bg-[#07090E] h-full flex-shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">TRACK 2: POWER (W)</span>
                  <span className="text-xs font-bold font-mono text-[#10B981]">{currentPower} W</span>
                </div>
                <div className="relative flex-1 h-full bg-[#080B12]">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 32">
                    {/* Red Danger Zone below threshold */}
                    <rect x="0" y="20" width="1000" height="12" fill="rgba(239, 68, 68, 0.15)" />
                    {/* Red Dotted Threshold Line */}
                    <line x1="0" y1="20" x2="1000" y2="20" stroke="#EF4444" strokeDasharray="3 3" strokeWidth="1" />
                    {/* Emerald Power Curve */}
                    <path d={powerPathD} fill="none" stroke="#10B981" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>

              {/* TRACK 3: DTE WINDOW (Continuous carrier lock & radio gap segments) */}
              <div className="flex items-center h-8 bg-[#090C14] border border-[#161D2B] rounded overflow-hidden">
                <div className="w-44 px-3 flex items-center justify-between border-r border-[#161D2B] bg-[#07090E] h-full flex-shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">TRACK 3: DTE WINDOW</span>
                  <span className={`text-[11px] font-bold font-mono ${currentDteActive ? 'text-[#38BDF8]' : 'text-[#EF4444]'}`}>
                    {currentDteActive ? 'ACTIVE' : 'BLACKOUT'}
                  </span>
                </div>
                <div className="relative flex-1 h-full bg-[#080B12] flex items-center px-1">
                  {/* Segment 1: Blue Carrier Lock */}
                  <div className="w-[68%] h-5 bg-[#2563EB]/85 hover:bg-[#2563EB] rounded-xs flex items-center px-3 text-[10px] font-bold text-white tracking-wider shadow-inner">
                    CONTINUOUS CARRIER LOCK (344h)
                  </div>
                  {/* Segment 2: Radio Gap */}
                  <div className="w-[12%] h-5 bg-[#161D2B] rounded-xs mx-0.5 flex items-center justify-center text-[9px] font-bold text-slate-400 tracking-wider">
                    RADIO GAP
                  </div>
                  {/* Segment 3: Blue Carrier Lock Continuation */}
                  <div className="flex-1 h-5 bg-[#2563EB]/85 hover:bg-[#2563EB] rounded-xs flex items-center px-2 text-[10px] font-bold text-white">
                  </div>
                </div>
              </div>

              {/* TRACK 4: COLD SOAK */}
              <div className="flex items-center h-8 bg-[#090C14] border border-[#161D2B] rounded overflow-hidden">
                <div className="w-44 px-3 flex items-center justify-between border-r border-[#161D2B] bg-[#07090E] h-full flex-shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">TRACK 4: COLD SOAK</span>
                  <span className="text-[11px] font-bold font-mono text-slate-300">
                    {currentSample.sun?.state === 'blocked' ? 'COLD SOAK' : 'NOMINAL'}
                  </span>
                </div>
                <div className="relative flex-1 h-full bg-[#080B12] flex items-center px-1">
                  {/* Nominal space until Day 16 */}
                  <div className="w-[50%] h-5"></div>
                  {/* Cold Soak Segment */}
                  <div className="w-[18%] h-5 bg-[#161D2B] border border-[#232D42] rounded-xs flex items-center justify-center text-[9px] font-bold text-slate-300 tracking-wider">
                    COLD SOAK (54h)
                  </div>
                  <div className="w-[10%] h-5"></div>
                  {/* Eclipse Segment */}
                  <div className="w-[8%] h-5 bg-[#161D2B] border border-[#232D42] rounded-xs flex items-center justify-center text-[9px] font-bold text-slate-300 tracking-wider">
                    ECL
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
