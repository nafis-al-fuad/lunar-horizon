import React from 'react';
import { X, ShieldAlert, BookOpen, Layers, Radio, Sun } from 'lucide-react';

export default function AssumptionsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-mono text-sm">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4 z-10">
        <div className="bg-[#0A0D15] border border-[#252E42] rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b border-[#1A2234] flex items-center justify-between bg-[#0C101A]">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-[#E5A93C]" />
              <h3 className="text-base font-bold text-white uppercase tracking-wider">
                Assumptions & Scientific Limitations
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1A2234]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-5 space-y-4 text-xs leading-relaxed text-slate-300">
            <div className="bg-[#06080E] p-3.5 rounded-lg border border-[#161C28]">
              <div className="flex items-center space-x-2 text-[#E5A93C] font-bold text-sm mb-1">
                <Sun className="w-4 h-4" />
                <span>JPL DE440 Astrodynamics & Topocentric Vectors</span>
              </div>
              <p>
                Solar and Earth body-fixed positions are derived from the NASA JPL DE440 Planetary Ephemeris, spanning 2026 to 2036 across 122 streaming binary chunks. Time conversion from Ephemeris Time (ET/TDB) to Coordinated Universal Time (UTC) accounts for leap-second steps via the NAIF leap-seconds kernel (LSK).
              </p>
            </div>

            <div className="bg-[#06080E] p-3.5 rounded-lg border border-[#161C28]">
              <div className="flex items-center space-x-2 text-[#60A5FA] font-bold text-sm mb-1">
                <Layers className="w-4 h-4" />
                <span>Topographic Horizon Ray-Marching & LOLA DEM</span>
              </div>
              <p>
                Terrain silhouettes are computed through radial ray-marching across lunar south polar elevation models (anchored to Lunar Reconnaissance Orbiter LOLA altimeter spot heights). Radial profiles span 0° to 360° azimuth in 1.0° bins. Near-field boulders (&lt;5 m) and micro-roughness below DEM resolution are subject to ±0.2° uncertainty bands.
              </p>
            </div>

            <div className="bg-[#06080E] p-3.5 rounded-lg border border-[#161C28]">
              <div className="flex items-center space-x-2 text-[#10B981] font-bold text-sm mb-1">
                <Radio className="w-4 h-4" />
                <span>Direct-to-Earth (DTE) RF Line-of-Sight & Libration</span>
              </div>
              <p>
                Radio communication links assume Direct-to-Earth optical/RF line-of-sight. Atmospheric refraction on Earth is not applicable in the lunar vacuum. Earth libration wobbles in latitude (~±6.5°) and longitude (~±8.0°) over the 27.3-day nodal period modulate Earth horizon clearance at polar crests.
              </p>
            </div>

            <div className="bg-[#06080E] p-3.5 rounded-lg border border-[#161C28]">
              <div className="flex items-center space-x-2 text-[#F59E0B] font-bold text-sm mb-1">
                <BookOpen className="w-4 h-4" />
                <span>Observer Vantage & Mast Height Adjustment</span>
              </div>
              <p>
                Calculations default to a sensor/solar-panel mast elevation of +2.0 m above ground level. Raising mast height from 0.0 m to 10.0 m depresses the geometric horizon according to &Delta;&theta; &approx; &radic;(2h / R_moon), granting up to +0.19° clearance over distant ridges.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#1A2234] bg-[#0C101A] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#182133] hover:bg-[#E5A93C] text-white hover:text-black font-bold text-xs rounded-lg transition-colors"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
