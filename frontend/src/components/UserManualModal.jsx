import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Compass,
  Clock,
  GitCompare,
  CalendarDays,
  ShieldCheck,
  Search,
  Sliders,
  Play,
  RotateCw,
  Eye,
  CheckCircle2,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function UserManualModal({ isOpen, onClose }) {
  const [activeSection, setActiveSection] = useState('how-to-use'); // 'how-to-use' or 'button-guide'
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen) return null;

  const quickSteps = [
    {
      num: '01',
      title: 'Select a Lunar Landing Site',
      desc: 'Click the "SITE:" button in the top navigation or click any site pin on the 3D Moon sphere. You can choose from 16 authentic candidate sites including Shackleton Rim, Malapert Massif, and Haworth Crater Rim.'
    },
    {
      num: '02',
      title: 'Inspect Terrain Skyline & Direct-to-Earth Line of Sight',
      desc: 'In Tab 1 (Explore Site), examine the 360° Topographic Skyline. The yellow dot represents the Sun (solar power) and the blue dot represents Earth (direct-to-earth RF communications). If either dot dips below the gray mountain silhouette, it is physically occluded.'
    },
    {
      num: '03',
      title: 'Scrub the 10-Year JPL Ephemeris Timeline',
      desc: 'Use the bottom playback bar to step hour-by-hour or play at up to 24 h/sec across 2026 to 2036. The timeline streams 122 binary chunks of real NASA JPL DE440 ephemeris data to show exact shadow transitions and cold soak durations.'
    },
    {
      num: '04',
      title: 'Stress-Test Launch Delays ("My landing slipped. What now?")',
      desc: 'Click the amber "My landing slipped. What now?" button in the header (or press "s"). Test slips of +14, +30, or +90 days to see if prolonged night violates the 120-hour lander battery limit, and screen viable Plan B backup sites.'
    },
    {
      num: '05',
      title: 'Analyze Seasons & Compare Multiple Sites',
      desc: 'Switch to Tab 4 (Seasons & Heatmap) to view the 12×31 annual matrix and spot seasonal windows driven by the 1.54° obliquity cycle. Go to Tab 3 (Compare) to benchmark up to 4 landing site scenarios simultaneously.'
    }
  ];

  const buttonGroups = [
    {
      category: 'Top Header Bar & Navigation',
      buttons: [
        { name: 'SITE: [Name]', desc: 'Opens the search modal containing 16 polar exploration candidates and benchmark landing sites.' },
        { name: 'My landing slipped. What now?', desc: 'Opens the Mission Slip & Plan B Drawer to simulate launch delays and evaluate alternate sites.' },
        { name: 'Explorer / Pro Toggle', desc: 'Switches between simplified operational view (Explorer) and advanced engineering mode (Pro) displaying ±0.2° LOLA DEM uncertainty bands and link margin guide lines.' },
        { name: 'Assumptions [a]', desc: 'Opens the scientific limitations and astrodynamics documentation (DE440, LSK leap-seconds, LOLA DEM, mast height).' },
        { name: 'User Manual', desc: 'Opens this interactive walkthrough and control dictionary.' },
        { name: 'Share [k]', desc: 'Encodes active site, date, mast height, and view mode into a permalink and copies it to your clipboard.' },
        { name: 'Tab 1: Explore Site [1]', desc: 'Primary observatory view with 360° skyline, 3D Moon sphere, and 1:1 true-scale celestial inset.' },
        { name: 'Tab 2: Timeline & Events [2]', desc: 'Mission events schedule, lighting transitions, and solar eclipse tracks.' },
        { name: 'Tab 3: Compare [3]', desc: '4-scenario comparison grid with mini skylines, battery verdicts, and operational metrics.' },
        { name: 'Tab 4: Seasons & Heatmap [4]', desc: '12-month x 31-day annual heatmap matrix showing illumination & Earth DTE windows.' },
        { name: 'Tab 5: Sources & Validation [5]', desc: 'Ephemeris validation against SPICE/DE440 benchmarks with 182 passing test vectors.' },
        { name: 'Tab 6: Mission Primer [6]', desc: 'Lunar polar environmental primer on permanent shadow regions (PSRs) and peaks of eternal light.' }
      ]
    },
    {
      category: 'Explore Site & Skyline Controls',
      buttons: [
        { name: 'Skyline / Radar', desc: 'Toggles between 360° panoramic silhouette and polar Plan Position Indicator (PPI) radar.' },
        { name: 'Mast Height Slider (0m–12m)', desc: 'Adjusts solar array/antenna mast height from ground level, dynamically calculating horizon depression dip.' },
        { name: 'Both / Sun / Earth', desc: 'In True-Scale Inset: centers viewport on Sun (0.53°), Earth (1.91°), or calculates angular separation between both.' },
        { name: 'FOV (2°, 4°, 8°, 16°)', desc: 'Selects the angular field of view without vertical distortion for true topocentric scaling.' },
        { name: 'South Pole / Equatorial', desc: 'On 3D Moon: snaps camera perspective directly over South Pole (80°S–90°S) or body-fixed equator.' },
        { name: 'Auto-Rotate', desc: 'Toggles subtle 3D rotational motion of the lunar sphere.' }
      ]
    },
    {
      category: 'Timeline Dock & Playback Controls',
      buttons: [
        { name: 'Play / Pause [Space]', desc: 'Starts continuous real-time astrodynamic playback or freezes time.' },
        { name: 'Prev / Next Hour [< / >]', desc: 'Steps the mission forward or backward by the selected step increment.' },
        { name: 'Start / End [|< / >|]', desc: 'Jumps directly to the start or end of the active 30-day analysis window.' },
        { name: 'Speed (1h/s to 24h/s)', desc: 'Adjusts simulation speed across ephemeris frames.' },
        { name: 'Step (15m to 24h)', desc: 'Sets granular step size for keyboard and button stepping.' },
        { name: 'Year & Month Selectors', desc: 'Selects from 2026 to 2036, streaming the corresponding real JPL DE440 binary chunk.' },
        { name: 'Dock Resize Handle / Chevron', desc: 'Expands the timeline dock upward to reveal all 4 telemetry tracks or collapses to slim playback.' }
      ]
    },
    {
      category: 'Compare & Plan B Actions',
      buttons: [
        { name: 'Open in Navigator', desc: 'Loads the selected comparison scenario into Screen 1 as the active simulation site.' },
        { name: 'Slip', desc: 'Opens the launch delay tool specifically for that scenario slot.' },
        { name: 'Clone', desc: 'Duplicates the scenario settings into another comparison slot.' },
        { name: 'Delete', desc: 'Clears the scenario slot to attach a new candidate site.' }
      ]
    }
  ];

  const filteredGroups = buttonGroups.map(group => ({
    ...group,
    buttons: group.buttons.filter(b =>
      b.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      b.desc.toLowerCase().includes(searchFilter.toLowerCase())
    )
  })).filter(g => g.buttons.length > 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-mono text-sm" data-lenis-prevent>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 flex items-center justify-center p-4 z-10" data-lenis-prevent>
        <div
          data-lenis-prevent
          onWheel={(e) => e.stopPropagation()}
          className="bg-[#090C13] border border-[#222B3D] rounded-xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl overscroll-contain"
        >
          {/* Header */}
          <div className="p-4 border-b border-[#1A2234] flex items-center justify-between bg-[#0C101A]">
            <div className="flex items-center space-x-2.5">
              <BookOpen className="w-5 h-5 text-[#E5A93C]" />
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">
                  Lunar Horizon User Manual
                </h3>
                <p className="text-xs text-slate-400">
                  Getting Started Walkthrough & Interactive Control Dictionary
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1A2234] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Section Navigation & Search Bar */}
          <div className="p-3 border-b border-[#1A2234] bg-[#07090F] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 bg-[#0C101A] p-1 rounded-lg border border-[#1A2234] w-full sm:w-auto">
              <button
                onClick={() => setActiveSection('how-to-use')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                  activeSection === 'how-to-use'
                    ? 'bg-[#E5A93C] text-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1. How to Use the App
              </button>
              <button
                onClick={() => setActiveSection('button-guide')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                  activeSection === 'button-guide'
                    ? 'bg-[#E5A93C] text-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                2. Button & Control Guide
              </button>
            </div>

            {activeSection === 'button-guide' && (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter buttons or functions..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-[#0C101A] border border-[#1E273A] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#E5A93C]"
                />
              </div>
            )}
          </div>

          {/* Scrollable Content Body */}
          <div
            data-lenis-prevent
            onWheel={(e) => e.stopPropagation()}
            className="flex-1 overflow-y-auto p-5 space-y-6 overscroll-contain"
          >
            {activeSection === 'how-to-use' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-300 leading-relaxed bg-[#0D121D] p-3.5 rounded-lg border border-[#1E283C]">
                  <strong className="text-[#E5A93C]">Welcome to Lunar Horizon!</strong> This mission-grade astrodynamics web tool simulates solar power availability and direct Earth radio line-of-sight for lunar exploration missions (such as NASA Artemis). Follow these 5 quick steps to get started:
                </div>

                <div className="space-y-3">
                  {quickSteps.map(step => (
                    <div
                      key={step.num}
                      className="flex items-start space-x-3.5 bg-[#07090F] p-3.5 rounded-lg border border-[#161C28] hover:border-[#222E46] transition-colors"
                    >
                      <span className="w-8 h-8 rounded-lg bg-[#E5A93C]/10 border border-[#E5A93C]/30 text-[#E5A93C] font-bold flex items-center justify-center text-xs flex-shrink-0">
                        {step.num}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-white mb-1">
                          {step.title}
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'button-guide' && (
              <div className="space-y-6">
                {filteredGroups.map(group => (
                  <div key={group.category} className="space-y-2">
                    <h4 className="text-xs uppercase font-bold text-[#E5A93C] tracking-wider pb-1 border-b border-[#1A2234]">
                      {group.category}
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {group.buttons.map(b => (
                        <div
                          key={b.name}
                          className="bg-[#07090F] p-2.5 rounded-lg border border-[#161C28] flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5"
                        >
                          <span className="font-bold text-xs text-white sm:w-56 flex-shrink-0">
                            {b.name}
                          </span>
                          <span className="text-xs text-slate-300 flex-1 leading-relaxed">
                            {b.desc}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3.5 border-t border-[#1A2234] bg-[#0C101A] flex items-center justify-between text-xs text-slate-400">
            <span>Tip: Press <kbd className="px-1.5 py-0.5 bg-[#151C2C] text-[#E5A93C] rounded border border-[#25324E] text-[10px]">?</kbd> anytime for keyboard shortcuts matrix</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#E5A93C] hover:bg-[#F59E0B] text-black font-bold text-xs rounded-lg transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
