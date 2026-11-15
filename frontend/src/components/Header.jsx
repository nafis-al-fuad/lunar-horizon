import React, { useState } from 'react';
import {
  Compass,
  Clock,
  GitCompare,
  Calendar,
  ShieldCheck,
  BookOpen,
  ChevronDown,
  Check,
  Search,
  X,
  HelpCircle,
  Share2,
  Sliders,
  CalendarDays
} from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  sites,
  selectedSiteId,
  setSelectedSiteId,
  proMode,
  setProMode,
  onOpenSlipDrawer,
  onOpenAssumptions,
  onOpenUserManual,
  onOpenHelp,
  onShare,
  pinnedScenarioCount = 3,
  isSiteModalOpen,
  setIsSiteModalOpen
}) {
  const [internalSiteModalOpen, setInternalSiteModalOpen] = useState(false);
  const siteModalOpen = isSiteModalOpen !== undefined ? isSiteModalOpen : internalSiteModalOpen;
  const setSiteModalOpen = setIsSiteModalOpen || setInternalSiteModalOpen;
  const [searchQuery, setSearchQuery] = useState('');

  // Close site selector on Escape key
  React.useEffect(() => {
    if (siteModalOpen) {
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setSiteModalOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [siteModalOpen, setSiteModalOpen]);

  const selectedSite = sites.find(s => s.id === selectedSiteId) || sites[0] || { name: 'Shackleton Rim', lat_deg: -89.7, lon_deg: 124.5 };

  const filteredSites = sites.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    {
      id: 'explore',
      label: '1. Explore Site',
      icon: Compass,
      sparkline: (
        <svg className="w-4 h-2.5 opacity-80" viewBox="0 0 20 10">
          <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points="0,8 4,6 8,2 12,5 16,3 20,7" />
        </svg>
      )
    },
    {
      id: 'timeline',
      label: '2. Timeline & Events',
      icon: Clock,
      sparkline: (
        <svg className="w-4 h-2.5 opacity-80" viewBox="0 0 20 10">
          <rect x="0" y="2" width="6" height="6" fill="currentColor" rx="1" />
          <rect x="8" y="2" width="4" height="6" fill="currentColor" opacity="0.4" rx="1" />
          <rect x="14" y="2" width="6" height="6" fill="currentColor" rx="1" />
        </svg>
      )
    },
    {
      id: 'compare',
      label: `3. Compare (${pinnedScenarioCount})`,
      icon: GitCompare,
      sparkline: (
        <svg className="w-4 h-2.5 opacity-80" viewBox="0 0 20 10">
          <path d="M0,8 Q5,2 10,8 T20,2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    },
    {
      id: 'seasons',
      label: '4. Seasons & Heatmap',
      icon: CalendarDays,
      sparkline: (
        <svg className="w-4 h-2.5 opacity-80" viewBox="0 0 20 10">
          <circle cx="5" cy="5" r="3" fill="currentColor" opacity="0.8" />
          <circle cx="15" cy="5" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    },
    {
      id: 'validation',
      label: '5. Sources & Validation',
      icon: ShieldCheck,
      sparkline: (
        <svg className="w-4 h-2.5 opacity-80" viewBox="0 0 20 10">
          <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points="2,5 6,8 14,2" />
        </svg>
      )
    },
    {
      id: 'primer',
      label: '6. Mission Primer',
      icon: BookOpen,
      sparkline: (
        <svg className="w-4 h-2.5 opacity-80" viewBox="0 0 20 10">
          <line x1="2" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="1.5" />
          <line x1="2" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#07090E]/95 backdrop-blur-md border-b border-[#1A202E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between py-3 gap-3">
          {/* Brand & Project Metadata */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-[#111520] border border-[#252E42] flex items-center justify-center font-mono font-bold text-[#E5A93C] text-base shadow-sm">
              LH
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight uppercase text-white font-mono">
                  LUNAR HORIZON
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#E5A93C]/10 text-[#E5A93C] border border-[#E5A93C]/30 font-semibold">
                  NASA 2026
                </span>
              </div>
              <p className="text-xs text-[#8B93A7] font-mono hidden md:block">
                Astrodynamics, Topography & Line-of-Sight Engine
              </p>
            </div>
          </div>

          {/* Center-Left: Target Site Selector */}
          <div className="relative">
            <button
              onClick={() => setSiteModalOpen(true)}
              className="flex items-center space-x-2 bg-[#10141D] hover:bg-[#181F2E] border border-[#222B3D] hover:border-[#E5A93C]/40 rounded-lg px-3 py-1.5 text-xs font-mono text-white btn-aerospace shadow-sm"
            >
              <span className="text-[#8B93A7] font-medium">SITE:</span>
              <span className="font-bold text-[#E5A93C] max-w-[160px] sm:max-w-[220px] truncate text-xs">
                {selectedSite.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#8B93A7]" />
            </button>
          </div>

          {/* Primary Action Button: "My landing slipped. What now?" */}
          <div>
            <button
              onClick={onOpenSlipDrawer}
              className="flex items-center space-x-2 bg-[#E5A93C]/15 hover:bg-[#E5A93C]/25 text-[#E5A93C] border border-[#E5A93C]/40 rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition-all shadow-[0_0_12px_rgba(229,169,60,0.2)] active:scale-95"
            >
              <Calendar className="w-3.5 h-3.5 text-[#E5A93C]" />
              <span>My landing slipped. What now?</span>
            </button>
          </div>

          {/* Right Utility Stack */}
          <div className="flex items-center space-x-2 text-xs font-mono">
            {/* Explorer / Pro Mode Toggle */}
            <div className="flex items-center bg-[#0D111A] p-0.5 rounded-lg border border-[#222B3D]">
              <button
                onClick={() => setProMode(false)}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                  !proMode ? 'bg-[#18202E] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Explorer
              </button>
              <button
                onClick={() => setProMode(true)}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                  proMode ? 'bg-[#E5A93C] text-black shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Pro
              </button>
            </div>

            {/* User Manual Button */}
            <button
              onClick={onOpenUserManual}
              title="First-Time User Manual & Control Guide [u]"
              className="flex items-center space-x-1.5 px-2.5 py-1 text-slate-300 hover:text-[#E5A93C] hover:bg-[#141A26] rounded border border-[#222B3D] hover:border-[#E5A93C]/40 text-[11px] font-bold transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#E5A93C]" />
              <span>User Manual</span>
            </button>

            {/* Assumptions Modal Button */}
            <button
              onClick={onOpenAssumptions}
              title="Scientific Limitations & Assumptions [a]"
              className="px-2.5 py-1 text-slate-400 hover:text-white hover:bg-[#141A26] rounded border border-[#222B3D] text-[11px]"
            >
              Assumptions
            </button>

            {/* Help / Shortcuts Button */}
            <button
              onClick={onOpenHelp}
              title="Keyboard Shortcuts [?]"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-[#141A26] rounded border border-[#222B3D]"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>

            {/* Share Permalink Button */}
            <button
              onClick={onShare}
              title="Copy Shareable URL [k]"
              className="p-1.5 text-slate-400 hover:text-[#E5A93C] hover:bg-[#141A26] rounded border border-[#222B3D]"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            {/* Static Badges */}
            <div className="hidden xl:flex items-center space-x-1.5 text-[10px] text-[#10B981] bg-[#10B981]/10 px-2 py-1 rounded border border-[#10B981]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
              <span className="font-bold">ALL TIMES UTC</span>
            </div>
          </div>
        </div>

        {/* Global Tabs Navigation Bar */}
        <div className="flex space-x-1 border-t border-[#141824] overflow-x-auto py-1.5 scrollbar-none">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-2 text-xs font-mono font-semibold rounded-md whitespace-nowrap btn-aerospace ${
                  isActive
                    ? 'bg-[#181E2E] text-[#E5A93C] border border-[#2A344A] shadow-md'
                    : 'text-[#8B93A7] hover:text-white hover:bg-[#111520]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#E5A93C]' : 'text-[#8B93A7]'}`} />
                <span>{tab.label}</span>
                <span className={isActive ? 'text-[#E5A93C]' : 'text-[#64748B]'}>
                  {tab.sparkline}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sleek Custom Site Selector Modal */}
      {siteModalOpen && (
        <div 
          className="fixed inset-0 z-50 overflow-hidden font-mono text-sm"
          data-lenis-prevent
        >
          {/* Backdrop - Click Outside to Dismiss */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity cursor-pointer"
            onClick={() => setSiteModalOpen(false)}
            title="Click outside to close"
          />

          {/* Centered Modal Container */}
          <div 
            className="fixed inset-0 flex items-center justify-center p-4 z-10 pointer-events-none"
            data-lenis-prevent
          >
            <div 
              data-lenis-prevent
              onWheel={(e) => e.stopPropagation()}
              className="bg-[#0C0F17] border border-[#252E42] rounded-xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl pointer-events-auto overscroll-contain"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-[#1A202E] flex items-center justify-between bg-[#080B12] rounded-t-xl">
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">
                    Select Landing Site Target
                  </h3>
                  <p className="text-xs text-[#8B93A7] mt-0.5">
                    16 Sourced Exploration Candidates & Mission Benchmarks • <span className="text-[#E5A93C]">Click outside or [ESC] to exit</span>
                  </p>
                </div>
                <button
                  onClick={() => setSiteModalOpen(false)}
                  className="p-1.5 rounded-lg text-[#8B93A7] hover:text-white hover:bg-[#1A202E] transition-colors"
                  title="Close site selector"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Input */}
              <div className="p-3 border-b border-[#1A202E] bg-[#07090E]">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8B93A7] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Filter by name, region, or latitude..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0C0F17] border border-[#222B3D] rounded-lg pl-10 pr-3.5 py-2 text-white placeholder-[#64748B] text-sm focus:outline-none focus:border-[#E5A93C]"
                  />
                </div>
              </div>

              {/* Sites List */}
              <div 
                data-lenis-prevent
                onWheel={(e) => e.stopPropagation()}
                className="overflow-y-auto flex-1 p-3 space-y-1.5 overscroll-contain"
              >
              <div className="text-xs uppercase font-bold text-[#8B93A7] px-2 py-1">
                South Polar Candidates (80°S–90°S)
              </div>
              {filteredSites.filter(s => Math.abs(s.lat_deg) >= 80).map(s => {
                const isSelected = s.id === selectedSiteId;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSiteId(s.id);
                      setSiteModalOpen(false);
                    }}
                    className={`p-3 rounded-lg cursor-pointer transition-all flex items-center justify-between btn-aerospace ${
                      isSelected
                        ? 'bg-[#E5A93C]/12 border border-[#E5A93C]/40 text-white'
                        : 'hover:bg-[#131722] text-[#E2E4E9] border border-transparent'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm flex items-center space-x-2">
                        <span>{s.name}</span>
                        {s.site_type === 'candidate' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3874CB]/20 text-[#3874CB] font-bold">CANDIDATE</span>
                        )}
                      </div>
                      <div className="text-xs text-[#8B93A7] mt-1">
                        {s.lat_deg.toFixed(2)}° Lat, {s.lon_deg.toFixed(2)}° Lon • {s.terrain_height_m != null ? `+${s.terrain_height_m}m` : 'Flat / Unknown'}
                      </div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-[#E5A93C]" />}
                  </div>
                );
              })}

              <div className="text-xs uppercase font-bold text-[#8B93A7] px-2 py-1 pt-3">
                Benchmark Comparison Sites
              </div>
              {filteredSites.filter(s => Math.abs(s.lat_deg) < 80).map(s => {
                const isSelected = s.id === selectedSiteId;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSiteId(s.id);
                      setSiteModalOpen(false);
                    }}
                    className={`p-3 rounded-lg cursor-pointer transition-all flex items-center justify-between btn-aerospace ${
                      isSelected
                        ? 'bg-[#E5A93C]/12 border border-[#E5A93C]/40 text-white'
                        : 'hover:bg-[#131722] text-[#E2E4E9] border border-transparent'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm flex items-center space-x-2">
                        <span>{s.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] font-bold">BENCHMARK</span>
                      </div>
                      <div className="text-xs text-[#8B93A7] mt-1">
                        {s.lat_deg.toFixed(2)}° Lat, {s.lon_deg.toFixed(2)}° Lon
                      </div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-[#E5A93C]" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      )}
    </header>
  );
}
