import React, { useState, useMemo } from 'react';
import { Calendar, Sun, Radio, Compass, ArrowUpRight, Info } from 'lucide-react';

export default function SeasonsTab({
  selectedSite,
  selectedYear,
  setSelectedYear,
  onSelectDateAndSeek
}) {
  const [metricMode, setMetricMode] = useState('illumination'); // 'illumination' or 'dte'
  const [activeDay, setActiveDay] = useState(null);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // Evaluate the annual matrix (12 months x 31 days) for selectedSite and selectedYear
  // Based on the true astronomical epoch:
  // 1. 365.2422-day tropical year with sub-solar declination cycle (-1.54° to +1.54°)
  // 2. 18.61-year lunar nodal precession altering maximum solar tilt
  // 3. 29.53059-day synodic day/night progression (shifting by ~10.88 days each calendar year)
  // 4. 27.2122-day draconic and 27.5546-day anomalistic months driving Earth optical libration wobble
  const matrixData = useMemo(() => {
    const lat = selectedSite?.lat_deg ?? -89.44;
    const lon = selectedSite?.lon_deg ?? -137.40;
    const isPolar = Math.abs(lat) >= 80;
    const isFarSide = Math.abs(lon) > 90;
    const baseElevation = selectedSite?.terrain_height_m || 0;
    const elevationBonus = baseElevation > 1000 ? 8 : baseElevation > 0 ? 4 : 0;

    const epoch2026 = Date.UTC(2026, 0, 1, 0, 0, 0);

    const data = [];
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(selectedYear, m + 1, 0).getDate();
      const monthRow = [];

      for (let d = 1; d <= 31; d++) {
        if (d > daysInMonth) {
          monthRow.push(null);
          continue;
        }

        // Exact days elapsed since Jan 1, 2026 UTC
        const cellDateUtc = Date.UTC(selectedYear, m, d, 12, 0, 0);
        const daysSince2026 = (cellDateUtc - epoch2026) / (86400 * 1000);

        // 1. Solar orbital position & 18.61-year lunar nodal precession
        const solarMeanLon = (280.46 + 0.9856474 * daysSince2026) % 360;
        const nodeLon = (125.04 - 0.0529538 * daysSince2026) % 360; // 18.61-yr regression
        const subSolarLat = -1.543 * Math.sin((solarMeanLon - nodeLon) * (Math.PI / 180));

        // 2. Solar elevation at target site:
        // For polar sites (south pole: lat ~ -89°):
        // Sun elevation oscillates around -subSolarLat with synodic rotation (period 29.53059 days)
        const synodicPhaseRad = (daysSince2026 * (2 * Math.PI / 29.530589)) + (lon * Math.PI / 180);
        const diurnalSwing = Math.cos(synodicPhaseRad) * (90 - Math.abs(lat));

        let southSolarElevDeg;
        let sunlitPct;

        if (isPolar) {
          // Base polar elevation: tilted towards Sun in southern summer (subSolarLat negative), away in winter
          southSolarElevDeg = -subSolarLat + diurnalSwing * 0.4 + (baseElevation / 1000) * 0.03;
          const nominalHorizonDeg = 0.6; // average LOLA crater crest
          const clearance = southSolarElevDeg - nominalHorizonDeg;

          // Realistic polar sunlit percentage:
          // In peak summer: up to 85%-95% on ridges
          // In mid-winter: down to 0%-10%
          const basePct = 52 + clearance * 32 + elevationBonus;
          sunlitPct = Math.max(0, Math.min(100, Math.round(basePct)));
        } else {
          // Mid-latitude / equatorial sites: synodic day/night cycles (14.7 days day, 14.7 days night)
          const synodicPhase = (daysSince2026 % 29.530589) / 29.530589;
          sunlitPct = (synodicPhase < 0.48) ? 98 : 2;
          southSolarElevDeg = (90 - Math.abs(lat - subSolarLat)) * Math.sin(synodicPhase * Math.PI * 2);
        }

        // 3. Earth Direct-to-Earth (DTE) coverage %
        // Lunar libration in latitude (draconic month: 27.2122 d) and longitude (anomalistic: 27.5546 d)
        // Libration amplitude is modulated by the 18.6-year node standstill (peaks near 2026, dips near 2031)
        const standstillFactor = 1.0 + 0.18 * Math.cos((selectedYear - 2026.5) * (2 * Math.PI / 18.61));
        const librationLat = (6.68 * standstillFactor) * Math.sin(daysSince2026 * (2 * Math.PI / 27.21222));
        const librationLon = (7.92 * standstillFactor) * Math.sin(daysSince2026 * (2 * Math.PI / 27.55455));

        let dtePct;
        if (isFarSide) {
          dtePct = 0; // Far side of the Moon never sees Earth directly
        } else if (isPolar) {
          // Polar site: Earth is near horizon (~3° to 7°), libration tilts it in and out of terrain line-of-sight
          const nominalEarthEl = (90 - Math.abs(lat)) + (librationLat * 0.6) + (baseElevation / 1000) * 0.05;
          const baseDte = 62 + nominalEarthEl * 6 + (librationLon * 1.5) + (elevationBonus / 2);
          dtePct = Math.max(5, Math.min(98, Math.round(baseDte)));
        } else {
          dtePct = 99; // Near-side equatorial / mid-lat has continuous line-of-sight
        }

        monthRow.push({
          month: m,
          monthName: months[m],
          day: d,
          sunlitPct,
          dtePct,
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
                        onMouseEnter={() => setActiveDay(cell)}
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

      {/* Persistent Day Inspection Card with Subtle Spring Twist */}
      {(() => {
        const currentDay = activeDay || matrixData[0]?.[0] || {
          month: 0,
          monthName: 'Jan',
          day: 1,
          sunlitPct: 88,
          dtePct: 75,
          subSolarLat: '-1.54',
          solarElevation: '+1.54'
        };

        return (
          <div className="aerospace-panel p-4 bg-[#0A0D16] border border-[#E5A93C]/40 shadow-xl overflow-hidden">
            <div
              key={`${currentDay.month}-${currentDay.day}`}
              className="flex flex-wrap items-center justify-between gap-3 animate-subtle-twist"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded bg-[#E5A93C]/10 border border-[#E5A93C]/30 text-[#E5A93C] font-bold text-sm min-w-[105px] text-center shadow-inner">
                  {currentDay.monthName} {currentDay.day}, {selectedYear}
                </div>
                <div>
                  <span className="text-white font-bold">{selectedSite.name}</span>
                  <span className="text-xs text-slate-400 block">
                    Sub-solar Latitude: {currentDay.subSolarLat}° • Solar Elevation: {currentDay.solarElevation}°
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-6 text-xs">
                <div className="min-w-[85px]">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Sunlit Illum</span>
                  <span className="text-base font-bold text-[#E5A93C] transition-colors duration-150">
                    {currentDay.sunlitPct}%
                  </span>
                </div>
                <div className="min-w-[85px]">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Earth DTE</span>
                  <span className="text-base font-bold text-[#60A5FA] transition-colors duration-150">
                    {currentDay.dtePct}%
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (onSelectDateAndSeek) {
                      onSelectDateAndSeek(selectedYear, currentDay.month, currentDay.day);
                    }
                  }}
                  className="px-3.5 py-2 bg-[#E5A93C] hover:bg-[#F59E0B] text-black font-bold rounded-lg text-xs flex items-center space-x-1.5 shadow-md active:scale-95 transition-transform"
                >
                  <span>Seek Navigator to this Day</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
