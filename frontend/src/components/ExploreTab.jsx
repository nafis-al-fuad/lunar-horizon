import React, { useState, useEffect } from 'react';
import HorizonSkyline from './HorizonSkyline';
import Moon3D from './Moon3D';
import { loadHorizonData } from '../lib/consumer';
import { Shield } from 'lucide-react';

export default function ExploreTab({ selectedSite, sites, onSelectSite, timeIndex }) {
  const [horizonData, setHorizonData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load horizon data when selected site changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    async function fetchHorizon() {
      try {
        const hData = await loadHorizonData(selectedSite.id);
        if (isMounted) setHorizonData(hData);
      } catch (err) {
        console.error('Error fetching horizon data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchHorizon();
    return () => { isMounted = false; };
  }, [selectedSite]);

  // Instant solar/terrestrial state linked to bottom scrubber timeIndex
  const stepHours = timeIndex * 1;
  const baseSunEl = selectedSite.lat_deg < -80 ? 1.35 : 45.0;
  const currentSunAz = (160 + stepHours * 0.55) % 360;
  const currentSunEl = baseSunEl + Math.sin(timeIndex * 0.08) * 0.45;
  const currentEarthAz = (85 + Math.sin(timeIndex * 0.05) * 4) % 360;
  const currentEarthEl = selectedSite.lat_deg < -80 ? (3.5 + Math.cos(timeIndex * 0.05) * 2.5) : 60.0;

  const instantSample = {
    sun: {
      azimuth_deg: currentSunAz,
      elevation_deg: currentSunEl,
      joint_state: currentSunEl > -0.1 ? 'clear' : 'blocked'
    },
    earth: {
      azimuth_deg: currentEarthAz,
      elevation_deg: currentEarthEl,
      joint_state: currentEarthEl > 0.0 ? 'clear' : 'blocked'
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
            <div className="text-sm text-[#8B93A7] mt-1.5 font-mono">
              Coordinates: <strong className="text-white">{selectedSite.lat_deg.toFixed(4)}°</strong> Lat,{' '}
              <strong className="text-white">{selectedSite.lon_deg.toFixed(4)}°</strong> Lon • Frame: <strong className="text-white">{selectedSite.frame}</strong> • Uncertainty: ±{selectedSite.coordinate_uncertainty_m}m
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="text-right">
              <div className="text-xs uppercase font-mono text-[#8B93A7] font-semibold">Observer Terrain Elevation</div>
              <div className="text-xl font-bold font-mono text-white mt-0.5">
                {selectedSite.terrain_height_m != null ? `+${selectedSite.terrain_height_m.toFixed(1)} m` : 'Flat / Unknown'}
              </div>
            </div>
            <div className="h-10 w-[1px] bg-[#1E2536]"></div>
            <div className="text-right">
              <div className="text-xs uppercase font-mono text-[#8B93A7] font-semibold">Default Mast Height</div>
              <div className="text-xl font-bold font-mono text-[#E5A93C] mt-0.5">
                +{selectedSite.default_mast_height_m.toFixed(1)} m
              </div>
            </div>
          </div>
        </div>

        {/* Provenance note */}
        {selectedSite.limitations?.[0] && (
          <div className="mt-3 flex items-start space-x-2.5 text-xs font-mono bg-[#080B12] p-3 rounded-lg border border-[#161B29] text-[#8B93A7]">
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