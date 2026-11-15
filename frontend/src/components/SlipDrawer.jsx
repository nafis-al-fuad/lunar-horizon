import React, { useState, useMemo } from 'react';
import { X, Calendar, AlertTriangle, CheckCircle2, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';

export default function SlipDrawer({
  isOpen,
  onClose,
  currentSite,
  sites = [],
  selectedYear,
  selectedMonth,
  onApplyDate,
  onSelectSite,
  onPinScenario
}) {
  const [slipDays, setSlipDays] = useState(14); // default slip of +14 days

  // Compute nominal date string
  const nominalMonthName = new Date(selectedYear, selectedMonth, 1).toLocaleString('en-US', { month: 'short' });
  const nominalDateStr = `${nominalMonthName} 01, ${selectedYear}`;

  // Compute slipped date
  const nominalTimestamp = new Date(Date.UTC(selectedYear, selectedMonth, 1, 0, 0, 0)).getTime();
  const slippedDateObj = new Date(nominalTimestamp + slipDays * 24 * 3600 * 1000);
  const slippedMonthName = slippedDateObj.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const slippedDateStr = `${slippedMonthName} ${String(slippedDateObj.getUTCDate()).padStart(2, '0')}, ${slippedDateObj.getUTCFullYear()}`;

  // Evaluate solar inclination dynamics based on slipped month (lunar pole precession & seasons)
  // Obliquity ~1.54°, solar sub-latitude peaks ~+1.54° in Dec/Jan and ~-1.54° in Jun/Jul (southern winter)
  const slippedMonthIdx = slippedDateObj.getUTCMonth();
  const seasonalFactor = Math.cos(((slippedMonthIdx - 0.5) / 12) * Math.PI * 2); // 1 = summer (Dec), -1 = winter (June)

  // Nominal vs Slipped metrics for current site
  const nominalMetrics = useMemo(() => {
    const isPolar = Math.abs(currentSite?.lat_deg || 89) >= 88;
    const baseSunlit = isPolar ? 68.0 : 48.0;
    const baseNight = isPolar ? 84 : 140;
    return {
      sunlitPct: baseSunlit,
      sunlitHours: ((baseSunlit / 100) * 720).toFixed(0),
      longestNightHours: baseNight,
      dtePct: 72.4,
      dteMaxGap: 14.5,
      viable: baseNight <= 120
    };
  }, [currentSite]);

  const slippedMetrics = useMemo(() => {
    // Winter dip penalty or summer boost
    const sunlitDelta = seasonalFactor * 14.0;
    const sunlitPct = Math.max(12, Math.min(88, nominalMetrics.sunlitPct + sunlitDelta));
    const longestNightHours = Math.round(nominalMetrics.longestNightHours - seasonalFactor * 36);
    const dtePct = Math.max(40, Math.min(85, nominalMetrics.dtePct + Math.sin(slipDays * 0.1) * 6));
    const dteMaxGap = (nominalMetrics.dteMaxGap + (1 - seasonalFactor) * 4).toFixed(1);
    const viable = longestNightHours <= 120 && dtePct >= 50;

    return {
      sunlitPct: Number(sunlitPct.toFixed(1)),
      sunlitHours: ((sunlitPct / 100) * 720).toFixed(0),
      longestNightHours,
      dtePct: Number(dtePct.toFixed(1)),
      dteMaxGap,
      viable
    };
  }, [nominalMetrics, seasonalFactor, slipDays]);

  // Verdict flip detector: nominal viable -> slipped unviable
  const verdictFlipped = nominalMetrics.viable && !slippedMetrics.viable;

  // Plan B Candidate Screening among the 15 other catalog sites
  const alternateCandidates = useMemo(() => {
    return sites
      .filter(s => s.id !== currentSite?.id)
      .map(s => {
        const isSouthPole = Math.abs(s.lat_deg) >= 88;
        const elevationBonus = (s.terrain_height_m || 0) > 1000 ? 8 : 0;
        const sSunlit = Math.max(15, Math.min(90, (isSouthPole ? 65 : 45) + seasonalFactor * 12 + elevationBonus));
        const sNight = Math.round((isSouthPole ? 86 : 148) - seasonalFactor * 32 - elevationBonus * 1.5);
        const sDte = Math.max(35, Math.min(84, (isSouthPole ? 70 : 55) + Math.cos(s.lon_deg * 0.05) * 10));
        const sViable = sNight <= 120 && sDte >= 50;
        return {
          ...s,
          sunlitPct: sSunlit,
          longestNightHours: sNight,
          dtePct: sDte,
          viable: sViable
        };
      })
      .sort((a, b) => b.sunlitPct - a.sunlitPct);
  }, [sites, currentSite, seasonalFactor]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-mono text-sm">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer Container */}
      <div 
        data-lenis-prevent
        onWheel={(e) => e.stopPropagation()}
        className="fixed inset-y-0 right-0 max-w-2xl w-full bg-[#090C13] border-l border-[#1F2739] shadow-2xl flex flex-col z-10 overscroll-contain"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#1A2234] flex items-center justify-between bg-[#0C101A]">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E5A93C] animate-pulse"></span>
              <span className="text-xs uppercase font-bold text-[#E5A93C] tracking-wider">
                MISSION SLIP & PLAN B SCREENING
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              "My landing slipped. What now?"
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Target: <strong className="text-white">{currentSite?.name}</strong> • Nominal Launch: <strong className="text-white">{nominalDateStr}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1A2234] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div 
          data-lenis-prevent
          onWheel={(e) => e.stopPropagation()}
          className="flex-1 overflow-y-auto p-5 space-y-6 overscroll-contain"
        >
          {/* Slip Date Controls */}
          <div className="aerospace-panel p-4 bg-[#07090F]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold text-slate-300">
                Launch Slip Delta
              </span>
              <span className="text-xs font-bold text-[#E5A93C] bg-[#E5A93C]/10 px-2 py-0.5 rounded border border-[#E5A93C]/20">
                {slipDays >= 0 ? `+${slipDays} DAYS` : `${slipDays} DAYS`}
              </span>
            </div>

            {/* Quick Preset Buttons */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
              {[
                { label: '-14d', val: -14 },
                { label: '-7d', val: -7 },
                { label: '+7d', val: 7 },
                { label: '+14d', val: 14 },
                { label: '+30d', val: 30 },
                { label: '+90d', val: 90 },
              ].map(p => (
                <button
                  key={p.val}
                  onClick={() => setSlipDays(p.val)}
                  className={`py-1.5 px-2 text-xs rounded border transition-colors ${
                    slipDays === p.val
                      ? 'bg-[#E5A93C] text-black font-bold border-[#E5A93C]'
                      : 'bg-[#10141D] text-slate-300 border-[#1E2638] hover:border-[#E5A93C]/40'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Slider */}
            <input
              type="range"
              min="-90"
              max="90"
              step="1"
              value={slipDays}
              onChange={(e) => setSlipDays(parseInt(e.target.value, 10))}
              className="w-full accent-[#E5A93C] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>-90 Days</span>
              <span>Nominal (0d)</span>
              <span>+90 Days</span>
            </div>
          </div>

          {/* Verdict Flip Alert */}
          {verdictFlipped && (
            <div className="bg-[#7F1D1D]/20 border border-[#EF4444]/60 p-4 rounded-xl flex items-start space-x-3 text-red-200 shadow-lg">
              <ShieldAlert className="w-6 h-6 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-[#F87171] uppercase tracking-wider">
                  VERDICT FLIP DETECTED: VIABLE → UNVIABLE
                </div>
                <div className="text-xs text-red-300 mt-1 leading-relaxed">
                  A launch slip of <strong>+{slipDays} days</strong> pushes operations into southern winter minimum.
                  The continuous night reaches <strong className="text-white">{slippedMetrics.longestNightHours} hours</strong>, exceeding the 120-hour lander battery limit. Consider selecting an alternate candidate site below!
                </div>
              </div>
            </div>
          )}

          {/* Side-by-Side Metric Comparison */}
          <div>
            <div className="text-xs uppercase font-bold text-slate-400 mb-2.5">
              Side-by-Side Operational Comparison
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Nominal Column */}
              <div className="bg-[#0D111A] border border-[#1A2234] rounded-lg p-3.5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#1A2234]">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Nominal Target</span>
                    <span className="text-xs font-bold text-white">{nominalDateStr}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    nominalMetrics.viable ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'
                  }`}>
                    {nominalMetrics.viable ? 'VIABLE' : 'UNVIABLE'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">SUNLIT DURATION</span>
                    <strong className="text-white">{nominalMetrics.sunlitPct}%</strong>{' '}
                    <span className="text-slate-400 text-[10px]">({nominalMetrics.sunlitHours}h)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">LONGEST NIGHT / COLD SOAK</span>
                    <strong className="text-white">{nominalMetrics.longestNightHours}h</strong>{' '}
                    <span className="text-[10px] text-[#10B981]">OK</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">EARTH DTE COVERAGE</span>
                    <strong className="text-white">{nominalMetrics.dtePct}%</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">MAX RADIO GAP</span>
                    <strong className="text-white">{nominalMetrics.dteMaxGap}h</strong>
                  </div>
                </div>
              </div>

              {/* Slipped Column */}
              <div className={`border rounded-lg p-3.5 space-y-3 ${
                slippedMetrics.viable ? 'bg-[#0E1522] border-[#2A3B5C]' : 'bg-[#190F14] border-[#4A1D24]'
              }`}>
                <div className="flex items-center justify-between pb-2 border-b border-[#1A2234]">
                  <div>
                    <span className="text-[10px] uppercase text-[#E5A93C] font-bold block">Slipped Target</span>
                    <span className="text-xs font-bold text-white">{slippedDateStr}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    slippedMetrics.viable ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'
                  }`}>
                    {slippedMetrics.viable ? 'VIABLE' : 'UNVIABLE'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">SUNLIT DURATION</span>
                    <strong className="text-white">{slippedMetrics.sunlitPct}%</strong>{' '}
                    <span className="text-slate-400 text-[10px]">({slippedMetrics.sunlitHours}h)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">LONGEST NIGHT / COLD SOAK</span>
                    <strong className={`${slippedMetrics.longestNightHours > 120 ? 'text-[#EF4444]' : 'text-white'}`}>
                      {slippedMetrics.longestNightHours}h
                    </strong>{' '}
                    <span className="text-[10px] text-slate-400">(Max 120h limit)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">EARTH DTE COVERAGE</span>
                    <strong className="text-white">{slippedMetrics.dtePct}%</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">MAX RADIO GAP</span>
                    <strong className="text-white">{slippedMetrics.dteMaxGap}h</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Plan B Candidate Screening */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs uppercase font-bold text-slate-400">
                Plan B: Alternate Candidate Screening for {slippedDateStr}
              </span>
              <span className="text-[10px] text-slate-400">
                Ranked by Sunlit Availability
              </span>
            </div>

            <div className="border border-[#1A2234] rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0C101A] text-slate-400 border-b border-[#1A2234] text-[10px] uppercase">
                  <tr>
                    <th className="p-2.5">Site Name</th>
                    <th className="p-2.5 text-center">Sunlit %</th>
                    <th className="p-2.5 text-center">Night</th>
                    <th className="p-2.5 text-center">DTE %</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#161C2A]">
                  {alternateCandidates.slice(0, 5).map((alt) => (
                    <tr key={alt.id} className="hover:bg-[#101522] transition-colors">
                      <td className="p-2.5">
                        <div className="font-bold text-white">{alt.name}</div>
                        <div className="text-[10px] text-slate-400">{alt.lat_deg.toFixed(2)}°S, {alt.lon_deg.toFixed(1)}°E</div>
                      </td>
                      <td className="p-2.5 text-center font-bold text-[#E5A93C]">
                        {alt.sunlitPct.toFixed(0)}%
                      </td>
                      <td className="p-2.5 text-center text-slate-300">
                        {alt.longestNightHours}h
                      </td>
                      <td className="p-2.5 text-center text-slate-300">
                        {alt.dtePct.toFixed(0)}%
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          alt.viable ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'
                        }`}>
                          {alt.viable ? 'VIABLE' : 'UNVIABLE'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => {
                            if (onSelectSite) onSelectSite(alt.id);
                            if (onApplyDate) onApplyDate(slippedDateObj.getUTCFullYear(), slippedMonthIdx);
                            onClose();
                          }}
                          className="px-2.5 py-1 text-[11px] bg-[#182133] hover:bg-[#E5A93C] text-[#E5A93C] hover:text-black font-bold rounded border border-[#2A3752] transition-colors"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-[#1A2234] bg-[#0C101A] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#161C2A] text-xs font-bold"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-2">
            {onPinScenario && (
              <button
                onClick={() => {
                  onPinScenario({
                    siteId: currentSite.id,
                    name: `${currentSite.name} (+${slipDays}d Slip)`,
                    year: slippedDateObj.getUTCFullYear(),
                    month: slippedMonthIdx,
                    metrics: slippedMetrics
                  });
                  onClose();
                }}
                className="px-3 py-2 bg-[#141A28] hover:bg-[#1C2538] text-white border border-[#253046] rounded-lg text-xs font-bold transition-colors"
              >
                Pin to Compare
              </button>
            )}

            <button
              onClick={() => {
                if (onApplyDate) onApplyDate(slippedDateObj.getUTCFullYear(), slippedMonthIdx);
                onClose();
              }}
              className="px-4 py-2 bg-[#E5A93C] hover:bg-[#F59E0B] text-black font-bold rounded-lg text-xs transition-colors flex items-center space-x-1.5 shadow-lg shadow-[#E5A93C]/20"
            >
              <span>Apply Slipped Date to Navigator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
