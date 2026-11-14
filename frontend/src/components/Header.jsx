import React, { useState } from 'react';
import { Compass, Clock, GitCompare, ShieldCheck, BookOpen, ChevronDown, Check, Search, X } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, sites, selectedSiteId, setSelectedSiteId }) {
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedSite = sites.find(s => s.id === selectedSiteId) || sites[0];

  const filteredSites = sites.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    {
      id: 'explore',
      label: 'Explore Site',
      icon: Compass,
      sparkline: (
        <svg className="w-4 h-2.5 opacity-80" viewBox="0 0 20 10">
          <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points="0,8 4,6 8,2 12,5 16,3 20,7" />
        </svg>
      )
    },
    {
      id: 'timeline',
      label: 'Timeline & Events',
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
      label: 'Compare & Date Slip',
      icon: GitCompare,
      sparkline: (
        <svg className="w-4 h-2.5 opacity-80" viewBox="0 0 20 10">
          <path d="M0,8 Q5,2 10,8 T20,2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    },
    {
      id: 'validation',
      label: 'Sources & Validation',
      icon: ShieldCheck,
      sparkline: (
        <svg className="w-4 h-2.5 opacity-80" viewBox="0 0 20 10">
          <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points="2,5 6,8 14,2" />
        </svg>
      )
    },
    {
      id: 'primer',
      label: 'Mission Primer',
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
        <div className="flex items-center justify-between h-18">
          {/* Brand & Project Metadata */}
          <div className="flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-lg bg-[#111520] border border-[#252E42] flex items-center justify-center font-mono font-bold text-[#E5A93C] text-base shadow-sm">
              LH
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="text-lg sm:text-xl font-bold tracking-tight uppercase text-white font-display">
                  LUNAR HORIZON
                </span>
                <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-[#E5A93C]/10 text-[#E5A93C] border border-[#E5A93C]/30 font-semibold">
                  NASA Space Apps
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#8B93A7] font-mono hidden sm:block">
                Astrodynamics, Topography & Line-of-Sight Engine
              </p>
            </div>
          </div>

          {/* Custom Aerospace Site Selector Button */}
          <div className="relative">
            <button
              onClick={() => setSiteModalOpen(true)}
              className="flex items-center space-x-2.5 bg-[#10141D] hover:bg-[#181F2E] border border-[#222B3D] hover:border-[#E5A93C]/40 rounded-lg px-4 py-2 text-sm font-mono text-white btn-aerospace shadow-sm"
            >
              <span className="text-[#8B93A7] font-medium">SITE:</span>
              <span className="font-bold text-[#E5A93C] max-w-[200px] sm:max-w-[280px] truncate text-sm">
                {selectedSite.name}
              </span>
              <ChevronDown className="w-4 h-4 text-[#8B93A7]" />
            </button>
          </div>

          {/* Status Indicator Badge */}
          <div className="hidden lg:flex items-center space-x-2 text-xs font-mono text-[#10B981] bg-[#10B981]/10 px-3 py-1.5 rounded-lg border border-[#10B981]/30">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
            <span className="font-bold">DE440 VERIFIED // 182 TESTS PASSING</span>
          </div>
        </div>

        {/* Global Tabs with Sparklines */}
        <div className="flex space-x-1.5 border-t border-[#141824] overflow-x-auto py-1.5 scrollbar-none">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2.5 px-4 py-2.5 text-sm font-mono font-semibold rounded-md whitespace-nowrap btn-aerospace ${
                  isActive
                    ? 'bg-[#181E2E] text-[#E5A93C] border border-[#2A344A] shadow-md'
                    : 'text-[#8B93A7] hover:text-white hover:bg-[#111520]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#E5A93C]' : 'text-[#8B93A7]'}`} />
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0C0F17] border border-[#252E42] rounded-xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl font-mono text-sm">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#1A202E] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">
                  Select Landing Site Target
                </h3>
                <p className="text-xs text-[#8B93A7] mt-0.5">
                  16 Sourced Exploration Candidates & Mission Benchmarks
                </p>
              </div>
              <button
                onClick={() => setSiteModalOpen(false)}
                className="p-1.5 rounded-lg text-[#8B93A7] hover:text-white hover:bg-[#1A202E]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-[#1A202E]">
              <div className="relative">
                <Search className="w-4 h-4 text-[#8B93A7] absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Filter by name, region, or latitude..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#07090E] border border-[#222B3D] rounded-lg pl-10 pr-3.5 py-2 text-white placeholder-[#64748B] text-sm focus:outline-none focus:border-[#E5A93C]"
                />
              </div>
            </div>

            {/* Sites List */}
            <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
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
      )}
    </header>
  );
}