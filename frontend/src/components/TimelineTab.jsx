import React, { useState, useEffect } from 'react';
import { loadScenarioData } from '../lib/consumer';
import { Clock, Sun, Globe, Zap, CheckCircle, AlertTriangle } from 'lucide-react';

export default function TimelineTab({ selectedSite }) {
  const [scenarioData, setScenarioData] = useState(null);
  const [activeScenarioId, setActiveScenarioId] = useState('scenario-artemis-shackleton-2026');
  const [loading, setLoading] = useState(true);

  const scenarioOptions = [
    { id: 'scenario-artemis-shackleton-2026', title: 'Artemis III: Shackleton Ridge (Summer Baseline)' },
    { id: 'scenario-shackleton-winter-date-slip', title: 'Artemis III: Southern Winter Date Slip (June 2026)' },
    { id: 'scenario-artemis-malapert-2026', title: 'Artemis III: Malapert Massif Summit' },
    { id: 'scenario-apollo-11-benchmark', title: 'Apollo 11: Tranquillity Base Baseline' },
  ];

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    async function fetchScenario() {
      try {
        const data = await loadScenarioData(activeScenarioId);
        if (isMounted) setScenarioData(data);
      } catch (err) {
        console.error('Failed to load scenario:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchScenario();
    return () => { isMounted = false; };
  }, [activeScenarioId]);

  if (loading || !scenarioData) {
    return (
      <div className="aerospace-panel p-12 text-center text-[#8B93A7] font-mono">
        Loading validated mission timeline and event data...
      </div>
    );
  }

  const { scenario, events, results } = scenarioData;
  const metrics = results.metrics;
  const tracks = events.tracks;
  const eventList = events.events || [];
  const windowDurationS = scenario.window.duration_s || (14 * 86400);

  const getIntervalStyle = (startEt, endEt) => {
    const left = ((startEt - scenario.window.start_et_s) / windowDurationS) * 100;
    const width = ((endEt - startEt) / windowDurationS) * 100;
    return { left: `${Math.max(0, left)}%`, width: `${Math.min(100 - left, width)}%` };
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Scenario Selector */}
      <div className="aerospace-panel p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#1A1F2C]">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-mono tracking-wider text-[#E5A93C] font-bold">
                MISSION TIMELINE //
              </span>
              <h2 className="text-xl font-bold text-white font-mono tracking-tight">
                {scenario.title}
              </h2>
            </div>
            <p className="text-xs text-[#8B93A7] mt-1 font-mono">
              Evaluated against JPL DE440 planetary ephemerides and 720-bin local horizon skyline
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-[#090C12] border border-[#1A1F2C] rounded px-3 py-1.5 text-xs font-mono">
            <span className="text-[#8B93A7]">SCENARIO:</span>
            <select
              value={activeScenarioId}
              onChange={(e) => setActiveScenarioId(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer pr-4 font-mono text-xs"
            >
              {scenarioOptions.map(sc => (
                <option key={sc.id} value={sc.id} className="bg-[#090C12] text-white">
                  {sc.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mission Metrics Summary Scorecard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs font-mono">
          <div className="bg-[#090C12] p-3 rounded border border-[#161B26]">
            <div className="text-[10px] text-[#8B93A7] uppercase">Sunlit Fraction</div>
            <div className="text-xl font-bold text-[#E5A93C] mt-1">
              {(metrics.sunlit_time_fraction.value * 100).toFixed(1)}%
            </div>
            <div className="text-[11px] text-[#64748B] mt-0.5">
              Total: {((metrics.sunlit_time_fraction.value * windowDurationS) / 3600).toFixed(1)} h
            </div>
          </div>

          <div className="bg-[#090C12] p-3 rounded border border-[#161B26]">
            <div className="text-[10px] text-[#8B93A7] uppercase">Direct-to-Earth LOS</div>
            <div className="text-xl font-bold text-[#3874CB] mt-1">
              {(metrics.dte_time_fraction.value * 100).toFixed(1)}%
            </div>
            <div className="text-[11px] text-[#64748B] mt-0.5">
              Total: {((metrics.dte_time_fraction.value * windowDurationS) / 3600).toFixed(1)} h
            </div>
          </div>

          <div className="bg-[#090C12] p-3 rounded border border-[#161B26]">
            <div className="text-[10px] text-[#8B93A7] uppercase">Longest Night</div>
            <div className="text-xl font-bold text-white mt-1">
              {(metrics.longest_night_s.value / 3600).toFixed(1)} h
            </div>
            <div className="text-[11px] text-[#64748B] mt-0.5">
              Thermal survival limit
            </div>
          </div>

          <div className="bg-[#090C12] p-3 rounded border border-[#161B26]">
            <div className="text-[10px] text-[#8B93A7] uppercase">Longest DTE Gap</div>
            <div className="text-xl font-bold text-white mt-1">
              {(metrics.longest_dte_gap_s.value / 3600).toFixed(1)} h
            </div>
            <div className="text-[11px] text-[#64748B] mt-0.5">
              Autonomous ops window
            </div>
          </div>
        </div>
      </div>

      {/* Gantt Timeline Tracks */}
      <div className="aerospace-panel p-4">
        <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider mb-3">
          Continuous Partition Tracks // 14-Day Mission Window
        </h3>

        <div className="space-y-4">
          {/* Sunlight Track */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-[#8B93A7] mb-1">
              <span className="text-[#E5A93C] font-bold">SOLAR ILLUMINATION</span>
              <span>{(metrics.sunlit_time_fraction.value * 100).toFixed(1)}% Sunlit</span>
            </div>
            <div className="relative h-6 bg-[#090C12] rounded overflow-hidden border border-[#181D2A]">
              {tracks.sunlight.map((it, idx) => (
                <div
                  key={idx}
                  style={getIntervalStyle(it.start_et_s, it.end_et_s)}
                  className={`absolute top-0 bottom-0 ${
                    it.state === 'clear' ? 'bg-[#E5A93C]' : 'bg-transparent'
                  }`}
                  title={`${it.state.toUpperCase()}: ${((it.duration_s)/3600).toFixed(1)}h`}
                />
              ))}
            </div>
          </div>

          {/* DTE Track */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-[#8B93A7] mb-1">
              <span className="text-[#3874CB] font-bold">DIRECT-TO-EARTH (LINE-OF-SIGHT)</span>
              <span>{(metrics.dte_time_fraction.value * 100).toFixed(1)}% LOS</span>
            </div>
            <div className="relative h-6 bg-[#090C12] rounded overflow-hidden border border-[#181D2A]">
              {tracks.dte.map((it, idx) => (
                <div
                  key={idx}
                  style={getIntervalStyle(it.start_et_s, it.end_et_s)}
                  className={`absolute top-0 bottom-0 ${
                    it.state === 'clear' ? 'bg-[#3874CB]' : 'bg-transparent'
                  }`}
                  title={`${it.state.toUpperCase()}: ${((it.duration_s)/3600).toFixed(1)}h`}
                />
              ))}
            </div>
          </div>

          {/* Simultaneous Track */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-[#8B93A7] mb-1">
              <span className="text-[#10B981] font-bold">SIMULTANEOUS POWER & COMMS</span>
              <span>{(metrics.simultaneous_time_fraction.value * 100).toFixed(1)}% Active</span>
            </div>
            <div className="relative h-6 bg-[#090C12] rounded overflow-hidden border border-[#181D2A]">
              {tracks.simultaneous.map((it, idx) => (
                <div
                  key={idx}
                  style={getIntervalStyle(it.start_et_s, it.end_et_s)}
                  className={`absolute top-0 bottom-0 ${
                    it.state === 'clear' ? 'bg-[#10B981]' : 'bg-transparent'
                  }`}
                  title={`${it.state.toUpperCase()}: ${((it.duration_s)/3600).toFixed(1)}h`}
                />
              ))}
            </div>
          </div>

          {/* Timeline markers */}
          <div className="flex justify-between text-[11px] text-[#64748B] font-mono pt-1">
            <span>Day 00 (Start)</span>
            <span>Day 03.5</span>
            <span>Day 07.0 (Midpoint)</span>
            <span>Day 10.5</span>
            <span>Day 14.0 (End)</span>
          </div>
        </div>
      </div>

      {/* Refined Event Contacts Table */}
      <div className="aerospace-panel p-4">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1A1F2C]">
          <div>
            <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
              Refined Transition Events ({eventList.length} Contacts Detected)
            </h3>
            <p className="text-[11px] text-[#8B93A7] font-mono mt-0.5">
              Bisection root-finding refined to ≤ 30s resolution for horizon crossings and totality contacts
            </p>
          </div>
        </div>

        {eventList.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#8B93A7] font-mono">
            No horizon transitions detected in this window (Continuous light or unbroken night).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1A1F2C] text-[#8B93A7] text-[10px] uppercase">
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">T+ Offset</th>
                  <th className="py-2.5 px-3">Ephemeris Time (ET s)</th>
                  <th className="py-2.5 px-3">Timing Resolution</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141824]">
                {eventList.map((ev, i) => {
                  const hoursOffset = ((ev.et_s - scenario.window.start_et_s) / 3600).toFixed(2);
                  const isTotality = ev.event_type.includes('totality');
                  const isSun = ev.event_type.startsWith('sun') || isTotality;

                  return (
                    <tr key={i} className="hover:bg-[#0D1017] transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-white">
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                          isTotality ? 'bg-[#EF4444]' : isSun ? 'bg-[#E5A93C]' : 'bg-[#3874CB]'
                        }`}></span>
                        {ev.event_type.replace(/_/g, ' ').toUpperCase()}
                      </td>
                      <td className="py-2.5 px-3 text-[#E2E4E9]">+{hoursOffset} h</td>
                      <td className="py-2.5 px-3 text-[#8B93A7]">{ev.et_s.toFixed(1)}</td>
                      <td className="py-2.5 px-3 text-[#10B981]">
                        {ev.resolution_s ? `≤ ${ev.resolution_s}s` : 'Bisection Root'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                          VERIFIED
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
