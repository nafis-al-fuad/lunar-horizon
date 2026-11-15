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
import { getSites, initReleaseData, loadScenarioData, loadHorizonData, loadMonthlyEphemerisTimeseries } from './lib/consumer';
import { ExternalLink } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('explore');
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState('shackleton-connecting-ridge');
  const [horizonData, setHorizonData] = useState(null);

  // 10-Year JPL DE440 Ephemeris Controls (2026 to 2036, Jan to Dec)
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = Jan 2026
  const [timeIndex, setTimeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ephemerisData, setEphemerisData] = useState(null);

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

  // Initialize startup dataset
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        await initReleaseData();
        const loadedSites = await getSites();
        const scData = await loadScenarioData('scenario-artemis-shackleton-2026');
        const hData = await loadHorizonData('shackleton-connecting-ridge');
        if (isMounted) {
          setSites(loadedSites);
          setScenarioData(scData);
          setHorizonData(hData);
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

  // Load horizon data when active site changes
  useEffect(() => {
    let isMounted = true;
    async function updateHorizon() {
      if (!selectedSiteId) return;
      try {
        const hData = await loadHorizonData(selectedSiteId);
        if (isMounted) setHorizonData(hData);
      } catch (err) {
        console.error('Failed to load horizon:', err);
      }
    }
    updateHorizon();
    return () => { isMounted = false; };
  }, [selectedSiteId]);

  // Load real 10-year JPL DE440 binary chunk whenever year, month, or site changes
  const selectedSite = sites.find(s => s.id === selectedSiteId) || sites[0];

  useEffect(() => {
    let isMounted = true;
    async function fetchEphemerisTimeseries() {
      if (!selectedSite) return;
      try {
        const tsData = await loadMonthlyEphemerisTimeseries(
          selectedYear,
          selectedMonth,
          selectedSite,
          horizonData,
          2.0 // default 2m mast height
        );
        if (isMounted) {
          setEphemerisData(tsData);
        }
      } catch (err) {
        console.error('Error loading real DE440 chunk timeseries:', err);
      }
    }

    fetchEphemerisTimeseries();
    return () => { isMounted = false; };
  }, [selectedYear, selectedMonth, selectedSite, horizonData]);

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

  if (loading || !selectedSite) {
    return (
      <div className="min-h-screen bg-[#07090E] flex flex-col items-center justify-center space-y-4 font-mono">
        <div className="w-12 h-12 rounded-full border-2 border-[#E5A93C] border-t-transparent animate-spin shadow-[0_0_20px_rgba(229,169,60,0.3)]"></div>
        <div className="text-sm font-bold text-[#E5A93C] tracking-widest uppercase">
          INITIALIZING LUNAR HORIZON ENGINE
        </div>
        <div className="text-xs text-slate-400">
          Loading 10-Year JPL DE440 Ephemeris (122 Chunks) & Ray-Traced Horizons...
        </div>
      </div>
    );
  }

  // Current real-time telemetry sample evaluated from the real DE440 chunk
  const currentTelemetry = ephemerisData?.timeseries?.[timeIndex] || null;

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
            currentTelemetry={currentTelemetry}
            horizonData={horizonData}
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
            <span className="font-semibold text-slate-400">LUNAR HORIZON NAVIGATOR // NASA SPACE APPS CHALLENGE 2026</span>
          </div>

          <div className="flex items-center space-x-3 text-slate-400">
            <span>DATASET: <strong className="text-white">v3.0 (122 DE440 CHUNKS)</strong></span>
            <span>•</span>
            <span>EPHEMERIS: <strong className="text-white">JPL DE440 2026–2036</strong></span>
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
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            ephemerisData={ephemerisData}
          />
        </div>
      )}
    </div>
  );
}