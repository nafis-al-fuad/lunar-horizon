import React from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import StarBackground from './StarBackground'
import CustomCursor from './CustomCursor'
import MoonModel from './MoonModel'

export default function LandingPage({ onExploreSite, onLearnMore }) {
  return (
    <main className="relative z-10 min-h-screen overflow-hidden scrollbar-none text-white select-none">
      <StarBackground />
      <CustomCursor />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-6 sm:px-12 relative z-20">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-md border border-white/10 bg-white/5 p-1 backdrop-blur-sm">
            <img src="/logo.png" alt="Lunar Horizon Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <span className="font-mono text-sm font-semibold tracking-wider text-white">LUNAR HORIZON</span>
            <span className="block font-mono text-[10px] text-blue-400/80">ARTEMIS SOUTH POLE ASTRODYNAMICS</span>
          </div>
        </div>

        <div className="relative flex items-center">
          <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-blue-500" />
          <span className="absolute right-0 bottom-0 h-3 w-3 border-b-2 border-r-2 border-blue-500" />
          <button
            onClick={onExploreSite}
            className="cursor-pointer inline-flex items-center gap-2 bg-white/10 px-5 py-2.5 text-xs font-mono font-medium tracking-wide text-blue-400 transition-all hover:bg-white/20 hover:text-blue-300"
          >
            Launch Horizon App <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pt-6 pb-28 sm:px-12 lg:grid-cols-2 relative z-20">
        {/* Hero copy */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-mono text-blue-400 mb-4">
            <Sparkles className="h-3 w-3" />
            <span>A launch slipped, what now?</span>
          </div>

          <h1 className="mt-1 text-4xl sm:text-5xl lg:text-6xl font-bold uppercase leading-tight tracking-wider">
            Welcome to
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-300">
              Lunar Horizon
            </span>
          </h1>

          <p className="mt-4 max-w-md text-base sm:text-lg font-semibold text-white/90">
            Plan your lunar landing. Calculate Sun and Earth visibility in seconds.
          </p>

          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/70">
            Rapid astrodynamics engine for Artemis candidate sites. Compute topocentric line-of-sight against 
            high-resolution LOLA/LRO 30-meter horizon elevation masks and JPL DE440 planetary ephemerides.
          </p>

          <div className="relative mt-8 flex flex-wrap items-center gap-4">
            <div className="relative inline-block">
              <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-blue-500" />
              <span className="absolute right-0 bottom-0 h-3 w-3 border-b-2 border-r-2 border-blue-500" />
              <button
                onClick={onExploreSite}
                className="cursor-pointer inline-flex items-center gap-2 bg-blue-600/25 border border-blue-500/50 px-6 py-3 text-sm font-mono font-medium tracking-wide text-blue-300 transition-all hover:bg-blue-600/40 hover:text-white hover:border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
              >
                Explore a site <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={onLearnMore}
              className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-3 text-sm font-mono font-medium text-white/80 hover:text-blue-300 transition-colors"
            >
              Methodology & Sources &rarr;
            </button>
          </div>
        </div>

        {/* Reticle / Lander graphic */}
        <div className="relative mx-auto aspect-square w-full max-w-lg">
          {/* Corner brackets */}
          <span className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-blue-500" />
          <span className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-blue-500" />
          <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-blue-500" />
          <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-blue-500" />

          {/* Reticle SVG */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <g fill="none" stroke="white" strokeWidth="0.35" opacity="0.85">
              {/* Top left */}
              <path d="M 27 5 H 36 L 44 14" />
              {/* Right middle */}
              <path d="M 61 32 H 80" />
              {/* Left middle */}
              <path d="M 8 58 H 22 L 34 62" />
              {/* Bottom right */}
              <path d="M 61 74 L 69 82 H 78" />
            </g>

            <g fill="white">
              <polygon points="27,4 28,5 27,6 26,5" />
              <polygon points="80,31 81,32 80,33 79,32" />
              <polygon points="8,57 9,58 8,59 7,58" />
              <polygon points="78,81 79,82 78,83 77,82" />
            </g>
          </svg>

          {/* Coordinate Readouts */}
          <span className="absolute left-[14%] top-[3%] font-mono text-[10px] leading-tight text-white/90">
            89.9°S 0.0°E
            <span className="block text-white/40">SHACKLETON RIM</span>
          </span>

          <span className="absolute right-[7%] top-[30%] font-mono text-[10px] leading-tight text-white/90">
            JPL DE440
            <span className="block text-white/40">EPHEMERIS</span>
          </span>

          <span className="absolute left-[2%] top-[50%] font-mono text-[10px] leading-tight text-white/90">
            0.05° STEP
            <span className="block text-white/40">AZIMUTH RES</span>
          </span>

          <span className="absolute right-[10%] top-[80%] font-mono text-[10px] leading-tight text-white/90">
            LRO LOLA
            <span className="block text-white/40">DEM 30M</span>
          </span>

          {/* Lander graphic */}
          <img
            src="/apollo-lunar.png"
            alt="Lunar Lander"
            className="absolute inset-0 m-auto h-4/5 w-4/5 scale-105 object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
          />
        </div>
      </section>

      {/* Floating badge */}
      <div className="absolute left-6 bottom-8 sm:left-12 z-20 hidden h-[60px] w-[210px] items-center rounded-md bg-white/5 pl-4 pr-16 backdrop-blur-md border border-white/10 md:flex pointer-events-none">
        <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-blue-500" />
        <span className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-blue-500" />
        <span className="font-mono text-xs leading-tight text-white/90">
          Explore 16 NASA <br /> Candidate Sites
        </span>
        <img
          src="/moon-small.png"
          alt="Moon badge"
          className="absolute -right-8 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full object-cover mix-blend-screen pointer-events-none"
        />
      </div>

      {/* 3D Rotating Moon Model in background */}
      <div className="absolute left-[-15%] top-[16%] z-0 h-[190%] w-[190%] pointer-events-none opacity-45">
        <MoonModel />
      </div>
    </main>
  )
}
