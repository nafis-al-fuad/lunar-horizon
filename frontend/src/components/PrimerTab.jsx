import React from 'react';
import { BookOpen, Compass, Sun, Globe, Mountain, Zap } from 'lucide-react';

export default function PrimerTab() {
  const sections = [
    {
      icon: Sun,
      title: '1. The Extreme Polar Grazing Angle (1.54° Obliquity)',
      content:
        'Unlike the Earth (which has a 23.4° axial tilt causing four distinct seasons), the Moon’s spin axis is tilted by only 1.54° relative to the ecliptic plane. At the Lunar South Pole (-80° to -90°), the Sun never climbs high into the sky; instead, it slowly sweeps around the local horizon, rising at most ~1.5° above or dipping ~1.5° below the astronomical horizon over an entire year. Consequently, even modest local hills can cast shadows stretching tens of kilometers across the lunar surface.'
    },
    {
      icon: Mountain,
      title: '2. Peaks of Eternal Light & Permanently Shadowed Regions (PSRs)',
      content:
        'Because the solar rays strike the South Pole horizontally, elevated topographic features—such as the crests of Shackleton Crater, Malapert Massif, and Mons Mouton—catch sunlight nearly continuously during the lunar southern summer. In contrast, the deep interior floors of impact craters (like Haworth, Faustini, and Shoemaker) have remained in absolute darkness for over two billion years, acting as cryogenic cold traps that preserve water ice.'
    },
    {
      icon: Globe,
      title: '3. Lunar Libration & Direct-to-Earth Line-of-Sight',
      content:
        'Because the Moon orbits the Earth in an elliptical orbit and its spin axis is slightly inclined, the Moon wobbles from our vantage point—a phenomenon known as libration (up to ±8° in longitude and ±6.7° in latitude). For a lander on the South Pole, libration causes the Earth to trace an apparent figure-eight loop in the sky over a 27.3-day cycle. Near the horizon, this periodic motion causes Earth to repeatedly rise and set behind local terrain, requiring precise geometric modeling to avoid communication blackouts.'
    },
    {
      icon: Zap,
      title: '4. The Physics of Observer Mast Height Gain',
      content:
        'On a spherical airless body with radius R = 1,737,400 m, an observer elevated at mast height h above the ground looks down over a dipped horizon: dip = -arccos(R / (R + h)) ≈ -sqrt(2h/R). Elevating solar arrays or high-gain antennas by just 2 to 6 meters above the lander deck depresses the apparent horizon by several tenths of a degree—often enough to clear distant crater walls and capture critical sunlight.'
    }
  ];

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="aerospace-panel p-4">
        <div className="flex items-center space-x-2">
          <span className="text-xs uppercase font-mono tracking-wider text-[#E5A93C] font-bold">
            MISSION PRIMER //
          </span>
          <h2 className="text-xl font-bold text-white font-mono tracking-tight">
            Lunar South Pole Astrodynamics & Topographic Physics
          </h2>
        </div>
        <p className="text-xs text-[#8B93A7] mt-1 font-mono">
          Core physical principles governing solar illumination, Earth visibility, and topographic horizon survival
        </p>
      </div>

      {/* Primer Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-mono">
        {sections.map((sec, idx) => {
          const Icon = sec.icon;
          return (
            <div key={idx} className="aerospace-panel p-4 space-y-2.5">
              <div className="flex items-center space-x-2 pb-2 border-b border-[#1A1F2C]">
                <div className="w-6 h-6 rounded bg-[#121622] border border-[#1E2536] flex items-center justify-center text-[#E5A93C]">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-bold text-white uppercase tracking-wider">
                  {sec.title}
                </h3>
              </div>
              <p className="text-[#94A3B8] leading-relaxed font-sans text-xs">
                {sec.content}
              </p>
            </div>
          );
        })}
      </div>

      {/* Frame Convention */}
      <div className="aerospace-panel p-4 bg-[#090C12]">
        <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider mb-1">
          Coordinate Frame: Lunar Body-Fixed Mean-Earth / Polar Axis (MOON_ME_DE421)
        </h4>
        <p className="text-xs text-[#8B93A7] leading-relaxed font-mono">
          All surface landing sites and topocentric horizons in Lunar Horizon are computed in the standard IAU/NAIF <strong className="text-white">MOON_ME_DE421</strong> body-fixed reference frame. The Z-axis aligns with the Moon’s mean north rotational pole, the X-axis points toward the mean sub-Earth point at the lunar equator (0°N, 0°E), and the Y-axis completes the right-handed Cartesian frame pointing toward 90°E.
        </p>
      </div>
    </div>
  );
}
