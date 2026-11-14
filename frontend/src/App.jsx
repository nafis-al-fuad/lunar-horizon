import React, { useState, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import Header from './components/Header';
import ExploreTab from './components/ExploreTab';
import TimelineTab from './components/TimelineTab';
import CompareTab from './components/CompareTab';
import ValidationTab from './components/ValidationTab';
import PrimerTab from './components/PrimerTab';
import TimelineBottomBar from './components/TimelineBottomBar';
import { getSites, initReleaseData, loadScenarioData } from './lib/consumer';
import { ExternalLink } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('explore');
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState('shackleton-connecting-ridge');
  const [timeIndex, setTimeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scenarioData, setScenarioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const mainContentRef = useRef(null);

  // Initialize Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  // Initialize dataset
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        await initReleaseData();
        const loadedSites = await getSites();
        const scData = await loadScenarioData('scenario-artemis-shackleton-2026');
        if (isMounted) {
          setSites(loadedSites);
          setScenarioData(scData);
          if (loadedSites.length > 0 && !selectedSiteId) {
            setSelectedSiteId(loadedSites[0].id);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to initialize dataset:', err);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, []);

  // GSAP tab entrance transition
  useEffect(() => {
    if (mainContentRef.current) {
      gsap.fromTo(
        mainContentRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }
      );
    }
  }, [activeTab]);

  // Global keyboard shortcuts (Emil Kowalski UX)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '1') setActiveTab('explore');
      if (e.key === '2') setActiveTab('timeline');
      if (e.key === '3') setActiveTab('compare');
      if (e.key === '4') setActiveTab('validation');
      if (e.key === '5') setActiveTab('primer');
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(p => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedSite = sites.find(s => s.id === selectedSiteId) || sites[0];

  if (loading || !selectedSite) {
    return (
      <div className="min-h-screen bg-[#07090E] flex flex-col items-center justify-center space-y-4 font-mono">
        <div className="w-12 h-12 rounded-full border-2 border-[#E5A93C] border-t-transparent animate-spin shadow-[0_0_20px_rgba(229,169,60,0.3)]"></div>
        <div className="text-sm font-bold text-[#E5A93C] tracking-widest uppercase">
          INITIALIZING LUNAR HORIZON ENGINE
        </div>
        <div className="text-xs text-[#8B93A7]">
          Decoding JPL DE440 Chebyshev Ephemeris & Ray-Traced Horizons...
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#07090E] text-[#E2E4E9] flex flex-col font-sans selection:bg-[#E5A93C]/20 ${
      activeTab === 'explore' ? 'pb-44' : 'pb-16'
    }`}>
      {/* Top Observatory Navigation Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sites={sites}
        selectedSiteId={selectedSiteId}
        setSelectedSiteId={setSelectedSiteId}
      />

      {/* Main View Area */}
      <main ref={mainContentRef} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'explore' && (
          <ExploreTab
            selectedSite={selectedSite}
            sites={sites}
            onSelectSite={(id) => setSelectedSiteId(id)}
            timeIndex={timeIndex}
          />
        )}
        {activeTab === 'timeline' && (
          <TimelineTab
            scenarioData={scenarioData}
            selectedSite={selectedSite}
          />
        )}
        {activeTab === 'compare' && (
          <CompareTab
            sites={sites}
            onSelectSite={(id) => {
              setSelectedSiteId(id);
              setActiveTab('explore');
            }}
          />
        )}
        {activeTab === 'validation' && (
          <ValidationTab />
        )}
        {activeTab === 'primer' && (
          <PrimerTab />
        )}
      </main>

      {/* Aerospace Telemetry Footer */}
      <footer className="border-t border-[#161B29] bg-[#06080D] py-5 text-xs font-mono text-[#64748B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]"></span>
            <span className="font-semibold text-[#8B93A7]">LUNAR HORIZON NAVIGATOR // NASA SPACE APPS CHALLENGE 2026</span>
          </div>

          <div className="flex items-center space-x-3 text-[#8B93A7]">
            <span>DATASET: <strong className="text-white">v3.0 RELEASE-V1</strong></span>
            <span>•</span>
            <span>EPHEMERIS: <strong className="text-white">JPL DE440</strong></span>
            <span>•</span>
            <a
              href="https://github.com/nafis-al-fuad/lunar-horizon"
              target="_blank"
              rel="noreferrer"
              className="text-[#E5A93C] hover:underline flex items-center space-x-1"
            >
              <span>GitHub Repository</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </footer>

      {/* Docked Aerospace Bottom Multi-Track Timeline & Playback Bar: ONLY RENDERED ON TAB 1 (EXPLORE SITE) */}
      {activeTab === 'explore' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 shadow-2xl">
          <TimelineBottomBar
            timeIndex={timeIndex}
            setTimeIndex={setTimeIndex}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            scenarioData={scenarioData}
          />
        </div>
      )}
    </div>
  );
}