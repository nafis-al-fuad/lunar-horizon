import React, { useState, useMemo } from 'react';
import { Calendar, Sun, Radio, Compass, ArrowUpRight, Info } from 'lucide-react';

export default function SeasonsTab({
  selectedSite,
  selectedYear,
  setSelectedYear,
  onSelectDateAndSeek
}) {
  const [metricMode, setMetricMode] = useState('illumination'); // 'illumination' or 'dte'
  const [hoveredDay, setHoveredDay] = useState(null);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // Evaluate the annual matrix (12 months x 31 days) for selectedSite and selectedYear
  // Based on the 1.54° lunar obliquity cycle, solar sub-latitude, and terrain elevation
  const matrixData = useMemo(() => {
    const isPolar = Math.abs(selectedSite?.lat_deg || 89) >= 88;
    const baseElevation = selectedSite?.terrain_height_m || 0;
    const elevationBonus = baseElevation > 1000 ? 10 : baseElevation > 0 ? 5 : 0;

    const data = [];
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(selectedYear, m + 1, 0).getDate();
      const monthRow = [];

      for (let d = 1; d <= 31; d++) {
        if (d > daysInMonth) {
          monthRow.push(null);
          continue;
        }

        // Day of year
        const dayOfYear = m * 30.5 + d;
        // Obliquity seasonal wave: peaks at winter solstice for north, summer solstice for south (Dec/Jan)
        // Angle in radians: Dec 21 is day ~355
        const seasonAngle = ((dayOfYear - 355) / 365.25) * Math.PI * 2;
        const subSolarLat = -1.54 * Math.cos(seasonAngle); // negative = south of lunar equator, positive = north
        const southSolarElevDeg = -subSolarLat; // When subSolarLat is south (-1.54), elev at South Pole is +1.54°

        // Illumination %
        let sunlitPct;
        if (isPolar) {
          // Polar site
          const nominalHorizonDeg = 0.5; // typical ridge horizon
          const clearance = southSolarElevDeg - nominalHorizonDeg;
          sunlitPct = Math.max(0, Math.min(100, 50 + clearance * 28 + elevationBonus));
        } else {
          // Mid-latitude / equatorial site (14 earth days light, 14 days dark synodic cycle)
          const synodicPhase = ((dayOfYear * 24) % 708.7) / 708.7; // ~29.53 days
          sunlitPct = synodicPhase < 0.5 ? 98 : 2;
        }

        // Earth Direct-to-Earth (DTE) visibility %
        // Lunar libration in latitude & longitude ~6.5° and ~8.0° over draconic / anomalistic months (~27.2 / 27.5 days)
        const librationCycle = Math.sin((dayOfYear / 27.3) * Math.PI * 2);
        const dtePct = isPolar
          ? Math.max(10, Math.min(95, 65 + librationCycle * 25 + (elevationBonus / 2)))
          : 98; // Far side would be 0, benchmark near side 100

        monthRow.push({
          month: m,
          monthName: months[m],
          day: d,
          sunlitPct: Math.round(sunlitPct),
          dtePct: Math.round(dtePct),
          subSolarLat: subSolarLat.toFixed(2),
          solarElevation: southSolarElevDeg.toFixed(2)
        });
      }
      data.push(monthRow);
    }
    return data;
  }, [selectedSite, selectedYear]);

  // Annual statistics
  const stats = useMemo(() => {
    let totalSunlit = 0;
    let totalDte = 0;
    let validDays = 0;
    let maxSunlit = 0;
    let minSunlit = 100;

    matrixData.forEach(row => {
      row.forEach(cell => {
        if (!cell) return;
        validDays++;
        totalSunlit += cell.sunlitPct;
        totalDte += cell.dtePct;
        if (cell.sunlitPct > maxSunlit) maxSunlit = cell.sunlitPct;
        if (cell.sunlitPct < minSunlit) minSunlit = cell.sunlitPct;
      });
    });

    return {
      avgSunlit: (totalSunlit / (validDays || 1)).toFixed(1),
      avgDte: (totalDte / (validDays || 1)).toFixed(1),
      maxSunlit,
      minSunlit
    };
  }, [matrixData]);

  // Helper color gradient function for cells
  const getCellColor = (val, mode) => {
    if (val == null) return 'bg-transparent border-transparent';
    if (mode === 'illumination') {
      if (val >= 80) return 'bg-[#E5A93C] text-black border-[#F59E0B] shadow-[0_0_8px_rgba(229,169,60,0.4)]';
      if (val >= 60) return 'bg-[#B45309] text-white border-[#D97706]';
      if (val >= 40) return 'bg-[#78350F] text-slate-200 border-[#92400E]';
      if (val >= 20) return 'bg-[#1E293B] text-slate-400 border-[#334155]';
      return 'bg-[#0B0F19] text-slate-400 border-[#1E293B]';
    } else {
      if (val >= 80) return 'bg-[#2563EB] text-white border-[#3B82F6] shadow-[0_0_8px_rgba(37,99,235,0.4)]';
      if (val >= 60) return 'bg-[#1D4ED8] text-slate-200 border-[#2563EB]';
      if (val >= 40) return 'bg-[#1E3A8A] text-slate-300 border-[#1D4ED8]';
      if (val >= 20) return 'bg-[#0F172A] text-slate-400 border-[#1E293B]';
      return 'bg-[#0B0F19] text-slate-400 border-[#1E293B]';
    }
  };

  return (
    <div className="space-y-6 font-mono text-sm">
      {/* Header and Controls */}
      <div className="aerospace-panel p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1A2234]">
          <div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#E5A93C]" />
              <span className="text-xs uppercase font-bold text-[#E5A93C] tracking-wider">
                SCREEN S3 // ANNUAL POLAR DYNAMICS & OBLIQUITY
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mt-1">
              Seasons & Operational Windows ({selectedYear})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Target Site: <strong className="text-white">{selectedSite.name}</strong> • Solar Elevation Driven by 1.54° Obliquity Precession
            </p>
          </div>

          {/* Metric Selector & Year Picker */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 bg-[#090C12] p-1 rounded-lg border border-[#1A2234]">
              <button
                onClick={() => setMetricMode('illumination')}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center space-x-1.5 ${
                  metricMode === 'illumination'
                    ? 'bg-[#E5A93C] text-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Solar Illumination %</span>
              </button>
              <button
                onClick={() => setMetricMode('dte')}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center space-x-1.5 ${
                  metricMode === 'dte'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Earth DTE Link %</span>
              </button>
            </div>

            <div className="flex items-center space-x-1.5 bg-[#090C12] px-3 py-1.5 rounded-lg border border-[#1A2234]">
              <span className="text-xs text-slate-400">Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 11 }, (_, i) => 2026 + i).map((yr) => (
                  <option key={yr} value={yr} className="bg-[#0C101A] text-white">
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Annual Summary Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
          <div className="bg-[#07090F] p-3 rounded-lg border border-[#161C2A]">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Annual Avg Sunlit</span>
            <div className="text-xl font-bold text-[#E5A93C] mt-1">{stats.avgSunlit}%</div>
            <span className="text-[10px] text-slate-400">Range: {stats.minSunlit}% – {stats.maxSunlit}%</span>
          </div>

          <div className="bg-[#07090F] p-3 rounded-lg border border-[#161C2A]">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Annual Avg Earth DTE</span>
            <div className="text-xl font-bold text-[#60A5FA] mt-1">{stats.avgDte}%</div>
            <span className="text-[10px] text-slate-400">Monthly libration cycles</span>
          </div>

          <div className="bg-[#07090F] p-3 rounded-lg border border-[#161C2A]">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Southern Summer Peak</span>
            <div className="text-sm font-bold text-[#10B981] mt-1.5">Dec 15 – Jan 20</div>
            <span className="text-[10px] text-slate-400">Sub-solar lat: -1.54°</span>
          </div>

          <div className="bg-[#07090F] p-3 rounded-lg border border-[#161C2A]">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Southern Winter Dip</span>
            <div className="text-sm font-bold text-[#F87171] mt-1.5">Jun 10 – Jul 15</div>
            <span className="text-[10px] text-slate-400">Sub-solar lat: +1.54° (Deep shadow)</span>
          </div>
        </div>
      </div>

      {/* 12 x 31 Annual Heatmap Matrix */}
      <div className="aerospace-panel p-5 overflow-x-auto">
        <div className="min-w-[760px]">
          {/* Days column header */}
          <div className="flex items-center mb-1 text-[10px] text-slate-400 font-bold">
            <div className="w-12 flex-shrink-0"></div>
            <div className="flex-1 grid grid-cols-31 gap-1 text-center">
              {days.map((d) => (
                <div key={d} className="w-full">
                  {d % 5 === 0 || d === 1 ? d : '·'}
                </div>
              ))}
            </div>
          </div>

          {/* Matrix Rows (12 Months) */}
          <div className="space-y-1.5">
            {matrixData.map((row, mIdx) => (
              <div key={mIdx} className="flex items-center text-xs">
                {/* Month Name */}
                <div className="w-12 flex-shrink-0 font-bold text-slate-300 text-xs">
                  {months[mIdx]}
                </div>

                {/* 31 Days Grid */}
                <div className="flex-1 grid grid-cols-31 gap-1">
                  {row.map((cell, dIdx) => {
                    if (!cell) {
                      return <div key={dIdx} className="h-6 rounded bg-[#06080D]/40" />;
                    }

                    const val = metricMode === 'illumination' ? cell.sunlitPct : cell.dtePct;
                    const colorClass = getCellColor(val, metricMode);

                    return (
                      <div
                        key={dIdx}
                        onMouseEnter={() => setHoveredDay(cell)}
                        onMouseLeave={() => setHoveredDay(null)}
                        onClick={() => {
                          if (onSelectDateAndSeek) {
                            onSelectDateAndSeek(selectedYear, cell.month, cell.day);
                          }
                        }}
                        className={`h-6 rounded border cursor-pointer transition-transform hover:scale-125 hover:z-20 flex items-center justify-center text-[9px] font-bold ${colorClass}`}
                        title={`${cell.monthName} ${cell.day}: ${val}%`}
                      >
                        {val >= 70 ? `${val}` : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between mt-5 pt-3 border-t border-[#1A2234] text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold">LEGEND:</span>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#0B0F19] border border-[#1E293B]"></span>
                <span className="text-[11px]">&lt;20%</span>
                <span className="w-3.5 h-3.5 rounded bg-[#1E293B] border border-[#334155] ml-2"></span>
                <span className="text-[11px]">20–40%</span>
                <span className="w-3.5 h-3.5 rounded bg-[#78350F] border border-[#92400E] ml-2"></span>
                <span className="text-[11px]">40–60%</span>
                <span className="w-3.5 h-3.5 rounded bg-[#B45309] border border-[#D97706] ml-2"></span>
                <span className="text-[11px]">60–80%</span>
                <span className="w-3.5 h-3.5 rounded bg-[#E5A93C] border border-[#F59E0B] ml-2"></span>
                <span className="text-[11px]">&gt;80%</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400">
              Tip: Click any cell to jump the Timeline & 3D Moon directly to that day.
            </div>
          </div>
        </div>
      </div>

      {/* Hovered Day Inspection Drawer / Card */}
      {hoveredDay && (
        <div className="aerospace-panel p-4 bg-[#0A0D16] border border-[#E5A93C]/40 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded bg-[#E5A93C]/10 border border-[#E5A93C]/30 text-[#E5A93C] font-bold text-sm">
                {hoveredDay.monthName} {hoveredDay.day}, {selectedYear}
              </div>
              <div>
                <span className="text-white font-bold">{selectedSite.name}</span>
                <span className="text-xs text-slate-400 block">Sub-solar Latitude: {hoveredDay.subSolarLat}° • Sun Elevation: {hoveredDay.solarElevation}°</span>
              </div>
            </div>

            <div className="flex items-center space-x-6 text-xs">
              <div>
                <span className="text-slate-400 block">Sunlit Illumination</span>
                <span className="text-base font-bold text-[#E5A93C]">{hoveredDay.sunlitPct}%</span>
              </div>
              <div>
                <span className="text-slate-400 block">Earth DTE Coverage</span>
                <span className="text-base font-bold text-[#60A5FA]">{hoveredDay.dtePct}%</span>
              </div>
              <button
                onClick={() => {
                  if (onSelectDateAndSeek) {
                    onSelectDateAndSeek(selectedYear, hoveredDay.month, hoveredDay.day);
                  }
                }}
                className="px-3 py-1.5 bg-[#E5A93C] hover:bg-[#F59E0B] text-black font-bold rounded text-xs flex items-center space-x-1"
              >
                <span>Seek Navigator to this Day</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
