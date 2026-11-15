import React, { useState, useEffect } from 'react';
import HorizonSkyline from './HorizonSkyline';
import Moon3D from './Moon3D';
import { loadHorizonData } from '../lib/consumer';
import { Shield, Database } from 'lucide-react';

export default function ExploreTab({ selectedSite, sites, onSelectSite, currentTelemetry, horizonData }) {
  // If currentTelemetry from real DE440 ephemeris is available, use it; otherwise fallback cleanly
  const instantSample = currentTelemetry || {
    sun: {
      azimuth_deg: 172.96,
      elevation_deg: 0.79,
      clearance_deg: 0.79,
      joint_state: 'clear'
    },
    earth: {
      azimuth_deg: 88.42,
      elevation_deg: 3.85,
      clearance_deg: 3.85,
      joint_state: 'clear'
    }
  };

  return (
    <div className="space-y-6">
      {/* Target Site Inspection Header Bar */}
      <div className="aerospace-panel p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1A202E]">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="text-xs uppercase font-mono tracking-wider text-[#E5A93C] font-bold">
                ACTIVE TARGET //
              </span>
              <h2 className="text-2xl font-bold text-white font-mono tracking-tight">
                {selectedSite.name}
              </h2>
              <span className={`text-xs uppercase font-mono px-2.5 py-0.5 rounded border font-bold ${
                selectedSite.site_type === 'candidate'
                  ? 'bg-[#3874CB]/15 text-[#5B96E8] border-[#3874CB]/30'
                  : 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
              }`}>
                {selectedSite.site_type.replace('_', ' ')}
              </span>
            </div>
            <div className="text-sm text-slate-400 mt-1.5 font-mono">
              Coordinates: <strong className="text-white">{selectedSite.lat_deg.toFixed(4)}°</strong> Lat,{' '}
              <strong className="text-white">{selectedSite.lon_deg.toFixed(4)}°</strong> Lon • Frame: <strong className="text-white">{selectedSite.frame}</strong> • Uncertainty: ±{selectedSite.coordinate_uncertainty_m}m
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="text-right">
              <div className="text-xs uppercase font-mono text-slate-400 font-semibold">Observer Terrain Elevation</div>
              <div className="text-xl font-bold font-mono text-white mt-0.5">
                {selectedSite.terrain_height_m != null ? `+${selectedSite.terrain_height_m.toFixed(1)} m` : 'Flat / Unknown'}
              </div>
            </div>
            <div className="h-10 w-[1px] bg-[#1E2536]"></div>
            <div className="text-right">
              <div className="text-xs uppercase font-mono text-slate-400 font-semibold">Default Mast Height</div>
              <div className="text-xl font-bold font-mono text-[#E5A93C] mt-0.5">
                +{selectedSite.default_mast_height_m.toFixed(1)} m
              </div>
            </div>
          </div>
        </div>

        {/* Provenance note */}
        {selectedSite.limitations?.[0] && (
          <div className="mt-3 flex items-start space-x-2.5 text-xs font-mono bg-[#080B12] p-3 rounded-lg border border-[#161B29] text-slate-400">
            <Shield className="w-4 h-4 text-[#E5A93C] flex-shrink-0 mt-0.5" />
            <span className="text-xs leading-relaxed"><strong className="text-white">PROVENANCE NOTE:</strong> {selectedSite.limitations[0]}</span>
          </div>
        )}
      </div>

      {/* Main Observatory Grid: 360° Topographic Skyline & 3D Interactive Moon */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 360° Skyline */}
        <div className="lg:col-span-7 flex flex-col">
          <HorizonSkyline
            horizonData={horizonData}
            instantSample={instantSample}
            siteName={selectedSite.name}
            terrainElevation={selectedSite.terrain_height_m || 0}
          />
        </div>

        {/* Right: 3D Interactive Moon Globe */}
        <div className="lg:col-span-5 flex flex-col">
          <Moon3D
            sites={sites}
            selectedSiteId={selectedSite.id}
            onSelectSite={onSelectSite}
          />
        </div>
      </div>
    </div>
  );
}