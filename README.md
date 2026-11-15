# 🌕 Lunar Horizon

**High-Precision Astrodynamics, Solar Illumination & Direct-to-Earth (DTE) Communications Engine for Lunar South Pole Exploration**

*Developed for the NASA International Space Apps Challenge — Lunar Landing Site Navigator*

[![Live Site](https://img.shields.io/badge/Live%20Application-lunar--horizon.pages.dev-0052FF?style=for-the-badge&logo=cloudflare&logoColor=white)](https://lunar-horizon.pages.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg?style=for-the-badge)](LICENSE)
[![NASA SPICE](https://img.shields.io/badge/NASA%20SPICE-DE440%20%2F%20DE421-blue.svg?style=for-the-badge)](https://naif.jpl.nasa.gov/naif/data.html)
[![LOLA DEM](https://img.shields.io/badge/LRO%20LOLA-South%20Pole%20DEM-emerald.svg?style=for-the-badge)](https://science.nasa.gov/mission/lro/lola/)

🌐 **Live Production Application:** **[https://lunar-horizon.pages.dev](https://lunar-horizon.pages.dev)**

---

## 🛠️ Technologies Used

| Technology | Badge / Category | Role & Architecture |
| :--- | :--- | :--- |
| **React 19** | `frontend` | Core reactive UI engine, high-frequency state synchronization across docks |
| **Vite 8 & Rolldown** | `bundler` | Sub-second builds (900ms), native Rust compilation with cross-platform bindings |
| **Tailwind CSS v4** | `styling` | Modern styling engine with LightningCSS integration, dark aerospace palette |
| **Three.js** | `3d-graphics` | Interactive 3D lunar sphere, sub-solar/sub-earth ground tracks, terminator shading |
| **NASA NAIF SPICE** | `astrodynamics` | Official planetary ephemeris kernels (`de440s.bsp`, `moon_pa_de421.bpc`, `pck00011.tpc`) |
| **Python 3.12** | `data-pipeline` | Quantization pipeline, Chebyshev polynomial evaluator, binary chunk packager |
| **Cloudflare Pages** | `deployment` | Global edge CDN hosting with automated GitHub CI/CD git integration |
| **Lenis & GSAP** | `motion` | Kinetic smooth scrolling and responsive aerospace micro-interactions |
| **KaTeX** | `mathematics` | In-browser mathematical typography rendering spherical geometry & optical formulas |
| **Lucide Icons** | `ui-icons` | Aerospace-grade vector icon matrix with zero emoji pollution |

---

## 🚀 Key Mission Challenges Solved

When lunar mission timelines slip or launch windows shift, mission planners, astrodynamicists, and payload engineers must rapidly evaluate alternative landing dates, azimuth vantage heights, and landing sites to guarantee two non-negotiable operational requirements:

1. **Power (Solar Illumination):** Ensuring sunlight clears local crater rim topography to maintain continuous battery charge and avoid thermal dormancy cold soaks.
2. **Communications (Direct-to-Earth / DTE):** Maintaining unobstructed RF line-of-sight to Deep Space Network (DSN) ground tracking stations while accounting for lunar optical libration ($\pm 8.2^\circ$) and topographic skyline masking.

**Lunar Horizon** provides an offline-first, client-side astrodynamics engine. Powered by pre-computed 10-year NASA JPL DE440 binary ephemerides and ray-traced LOLA horizons, it evaluates any date, site, or slip scenario instantaneously in the browser.

---

## 🌟 Comprehensive Feature Catalog (All Capabilities)

### 1. Global Observatory Shell & Utility Stack
* **Persistent Application Header:** Live site coordinates, active scenario badge, UTC status indicator, and dynamic scenario count badge.
* **Pro Mode Engine (`m` shortcut):** Toggles between standard overview and high-precision engineering mode ($\pm 0.2^\circ$ LOLA DEM terrain uncertainty band, DTE guide threshold lines, and grazing solar margin limits).
* **Launch Slip & Plan B Drawer (`s` shortcut):** Instant contingency recommendation drawer computing alternate candidate sites and slip windows when nominal launch epochs slip (+1d to +90d with +7d, +14d, +30d quick presets).
* **Interactive User Manual Modal (`u` shortcut):**
  * *Part 1 (How to Use):* 5-step onboarding guide for first-time operators.
  * *Part 2 (Control Dictionary):* Searchable categorized dictionary defining every button, stepper, and status indicator.
* **Scientific Limitations & Assumptions Drawer (`a` shortcut):** Complete transparency documentation citing celestial frame definitions, KaTeX formulas for dip geometry, and DEM resolution boundaries.
* **Keyboard Shortcut Matrix (`?` shortcut):** Full tactile hotkeys (`1`–`6` for screen navigation, `Space` for playback, `s` for slip, `m` for pro mode, `k` for share, `u` for manual, `Esc` to dismiss).
* **Permalink State Sync (`k` shortcut):** Encodes active site, date, time index, mode, mast height, and scenario slots into the browser URL hash for instant sharing.
* **Aerospace Error Boundary Shield:** Custom React error boundary wrapping viewports to catch unexpected faults, display diagnostic trace alerts, and restore viewport state with a single click.
* **Modal Scroll Isolation & Dismissal:** Background body scroll is strictly locked whenever modals or drawers are open, with universal `data-lenis-prevent` isolation, backdrop-click dismissal, and keyboard `Escape` support.

---

### 2. Screen 1: Navigator & 360° Topographic Skyline
* **16 Curated Landing Sites Selector:** Searchable modal catalog of Artemis candidate regions, CLPS target sites, and historical exploration benchmarks with exact coordinates, elevations, and terrain tiers.
* **360° Panoramic Skyline & Polar PPI Radar:** Toggle between 360° panoramic silhouette and topocentric Plan Position Indicator (PPI) polar radar plotting continuous crater rim topography ($-2^\circ$ to $+15^\circ$).
* **Real-Time Celestial Body Tracking:**
  * **Solar Disc:** Real-time topocentric azimuth and elevation, dynamic corona halo, physical ridge occlusion detection, and below-horizon alerts.
  * **Earth Disc:** Real-time azimuth and elevation, optical phase shading, and continuous libration tracking.
* **Lander Mast Height Slider:** Adjustable vantage height ($0.0\text{ m}$ to $12.0\text{ m}$) dynamically lowering the geometric horizon dip angle ($\Delta \theta \approx \sqrt{2h/R_{\text{moon}}}$).
* **True-Scale 1:1 Celestial Inset:**
  * Isotropic $1:1$ viewport rendering the Sun ($0.53^\circ$ angular diameter) and Earth ($1.91^\circ$ angular diameter) with zero vertical exaggeration.
  * **Automated Dual-Pane Viewport:** Automatically splits into synchronized left (Solar) and right (Earth) viewports when angular separation exceeds the active Field of View ($2^\circ$, $4^\circ$, $8^\circ$, or default $16^\circ$).
  * **Live 8-Card Telemetry HUD:** Real-time readouts for Sun Position (Az/El), Sun Ridge Clearance, Earth Position, Earth DTE Margin, Center-to-Center Angular Separation, Solar Eclipse Disc Occultation %, Local Horizon Crest, and True-Scale Ratio ($13.8\text{ px/}^\circ$).
* **3D Interactive Moon Globe:**
  * Real-time WebGL Three.js lunar globe with photo-realistic surface bump texture.
  * Sub-solar and sub-earth ground tracks, terminator shadow plane, and interactive 3D landing site pins with click-to-focus and hover tooltips.
  * OrbitControls zoom, rotate, and drag with event propagation isolation so page scroll remains unaffected when cursor is over the globe.

---

### 3. Persistent Multi-Track Astrodynamic Timeline Dock
* **Transport Playback Bar:** Full transport controls (`|<`, `<`, Play/Pause, `>`, `>|`) with adjustable speeds ($1$, $2$, $4$, $12$, $24\text{ h/sec}$) and discrete step increments ($15\text{m}$, $1\text{h}$, $3\text{h}$, $6\text{h}$, $24\text{h}$).
* **10-Year JPL Ephemeris Navigation:** Direct Year selector ($2026$–$2036$) and Month selector ($122$ binary chunks loaded on the fly).
* **30-Day Timeline Ruler:** Tick marks (`MAR 01`, `05`, `10`, `25`, `31`), milestone event badges (`▼ SUNSET 15`, `• EARTHSET`, `✦ ECLIPSE`), and amber scrubber pill handle.
* **4 Synchronized Multi-Track Strips:**
  1. **`TRACK 1: SUN ELEV`**: Continuous solar elevation curve above the horizon with warm translucent area fill.
  2. **`TRACK 2: POWER (W)`**: Solar array generation curve in emerald green with red dotted threshold line and danger-shaded red zone during occultation dips.
  3. **`TRACK 3: DTE WINDOW`**: Blue carrier lock segments (`CONTINUOUS CARRIER LOCK`) and dark `RADIO GAP` blocks.
  4. **`TRACK 4: COLD SOAK`**: Dedicated blocks for thermal dormancy (`COLD SOAK`) and eclipse events (`ECL`).
* **Synchronized Vertical Hairline:** Amber cursor hairline spanning from ruler down through all 4 tracks.
* **Dock Ergonomics:** Drag-to-resize handle bar (resizable from $130\text{ px}$ to $460\text{ px}$) and collapsible `TIMELINES ^` drawer toggle.

---

### 4. Screen 2: Timeline Analytics & Partition Breakdown
* Cumulative mission duration charts partitioning time into `sunlight`, `dte`, and `simultaneous` windows.
* Outage frequency histograms, longest continuous night metrics, and chronological tabular event log.

---

### 5. Screen 3: Multi-Scenario Comparison Matrix
* **Dynamic Multi-Slot Grid:** $2\times2$ grid comparing up to N scenarios simultaneously (Slot A, B, C, D, and dynamic `+ Add Slot` for Slot E, F, etc.).
* **Persistent Comparison Matrix:** State is preserved across tab navigation and browser sessions via lifted root synchronization and `localStorage`.
* **Compare ANY Scenario:** Multi-tab Scenario Builder allowing comparison of:
  * Any of the 16 NASA Artemis exploration sites.
  * Custom coordinates (Lat, Lon, Elevation, Slope).
  * Any Year ($2026$–$2036$), Month (Jan–Dec), Mast Height ($0$–$10\text{ m}$), and Duration ($7$–$90\text{ d}$).
  * One-click *"Import Current Navigator State"*.
* **Dynamic Astrodynamics Engine:** Automatically calculates real metrics for any configuration:
  * Sunlit duration (% and total hours).
  * Longest continuous night (hours) with `BEST`, `SAFE`, `NEAR LIMIT`, or `OVER LIMIT` badges.
  * Earth DTE coverage % and maximum blackout gap.
  * Landing gear slope safety evaluation (`SAFE`, `PASS`, `WARNING`, `DANGER`).
  * Average power generation (W).
  * Peak solar elevation and mini horizon skyline silhouette.
  * Viability determination (`■ VIABLE` vs. `■ UNVIABLE (FAIL // HARD LIMIT EXCEEDED)`).
* **Tactile Scenario Actions:** `Open in Navigator`, `Slip` (+30d launch slip cycle), `Clone`, `Delete` (`✕`), and hard constraint failure diagnostic modal.

---

### 6. Screen 4: Multi-Year Seasons & Heatmap
* **$12 \times 31$ Annual Matrix:** Complete 365/366-day heatmap with thermal cell shading.
* **Dual Metric Modes:** Instant toggle between Solar Illumination % and Earth Direct-to-Earth (DTE) Link %.
* **True Astrodynamics Engine:**
  * Models the **$18.61$-year lunar nodal precession** modulating maximum solar declination.
  * Evaluates the **$29.53$-day synodic month progression**, shifting illumination peaks by $\sim 10.88$ days per calendar year.
  * Applies **exact spherical trigonometry** with the **$27.21$-day draconic** and **$27.55$-day anomalistic** months for topocentric Earth elevation and libration.
* **Persistent Day Inspection Card:** Seamless $160\text{ms}$ cubic-bezier spring twist transition (`animate-subtle-twist`) without DOM unmount flicker.
* **Seek Action:** One-click button to jump Navigator to the inspected date.

---

### 7. Screen 5: Numerical Validation Suite
* Conformance verification against NASA JPL `testpo.440` test vectors ($< 2.1 \times 10^{-17}\text{ AU}$ error).
* Precision verification gates (V01–V12) ensuring $<0.05^\circ$ ephemeris error and $<0.1^\circ$ horizon ray-tracing residuals.

---

### 8. Screen 6: Exploration Primer & Lunar Glossary
* In-depth educational aerospace reference covering polar lighting, permanent shadow regions (PSRs), volatile cold traps, optical libration, and DTE link geometry.

---

## 🏛️ Scientific Data Sources & Provenance

Lunar Horizon's astrodynamics, topography, and surface landing coordinate pipelines rely strictly on peer-reviewed, flight-qualified datasets and planetary ephemeris systems. Data sources are divided into primary NASA scientific models and international / commercial mission telemetry:

### 1. NASA Scientific Data Sources & Astrodynamic Toolkits

| NASA Scientific Resource | Providing Facility / Organization | Purpose & Role in Lunar Horizon | Verified Official Link |
| :--- | :--- | :--- | :--- |
| **NASA NAIF SPICE Toolkit** | NASA JPL / NAIF | Planetary state propagation, coordinate frames, and LSK/PCK kernel evaluation | [NAIF JPL Portal](https://naif.jpl.nasa.gov/naif/) |
| **JPL DE440 / DE441 Ephemeris** | NASA JPL Solar System Dynamics | High-precision solar and Earth topocentric positions ($<0.05^\circ$ error) across 2026–2036 | [JPL DE440 Ephemeris Export](https://ssd.jpl.nasa.gov/planets/eph_export.html) |
| **JPL DE440s Binary SPK** | NASA JPL / NAIF | 122 streaming binary ephemeris chunks utilized for high-speed client simulation | [JPL NAIF Planetary SPK](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp) |
| **High-Precision Lunar PCK/FK** | NASA JPL / NAIF | Lunar body-fixed orientation (`MOON_ME_DE421` & `moon_080317.tf`) | [NAIF Lunar Frame Kernel](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf) |
| **LRO LOLA Science Mission** | NASA Goddard Space Flight Center (GSFC) | Lunar Orbiter Laser Altimeter topography and 360° panoramic crater rim profiles | [NASA Science LOLA Overview](https://science.nasa.gov/mission/lro/lola/) |
| **LOLA PDS Geosciences Archive** | NASA Planetary Data System (PDS) | Gridded Digital Elevation Models (GDR) and polar stereographic topography maps | [PDS Geosciences LOLA Node](https://pds-geosciences.wustl.edu/missions/lro/lola.htm) |
| **LOLA Polar Illumination Model** | Barker et al. (2021) / NASA GSFC | Topocentric horizon elevation angle benchmarks and solar limb ray-tracing | [Planetary & Space Science DOI](https://doi.org/10.1016/j.pss.2020.105119) |
| **LROC Candidate Landing Sites** | Arizona State University / NASA | High-resolution polar candidate site coordinates, maps, and NAC surface mosaics | [LROC Featured Sites Atlas](https://www.lroc.asu.edu/featured_sites/) |
| **LROC Interactive Topography** | LROC Science Operations Center | 3D polar surface topography validation and terrain elevation profiles | [LROC QuickMap Portal](https://quickmap.lroc.im-ldi.com/) |
| **JPL Horizons On-Line System** | NASA JPL SSD Group | Independent ground-truth validation vectors for solar and terrestrial azimuth/elevation | [JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/) |
| **Artemis Candidate Regions** | NASA Headquarters | Target landing sites and boundary zones for Artemis lunar South Pole exploration | [NASA Artemis Regions Update](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/) |

---

### 2. International & Mission Partner Data Sources

| Mission / Agency Resource | Sponsoring Organization | Purpose & Role in Lunar Horizon | Verified Official Link |
| :--- | :--- | :--- | :--- |
| **Chandrayaan-3 Landing Coordinates** | Indian Space Research Organisation (ISRO) | Precise surface coordinates for the *Shiv Shakti Point* landing site ($69.373^\circ\text{S}, 32.319^\circ\text{E}$) | [ISRO Chandrayaan-3 Portal](https://www.isro.gov.in/Chandrayaan3_Details.html) |
| **SLIM Pinpoint Landing Coordinates** | Japan Aerospace Exploration Agency (JAXA) | Precise touchdown coordinates at Shioli Crater ($13.316^\circ\text{S}, 25.251^\circ\text{E}$) with sub-100m accuracy | [JAXA SLIM Mission Project](https://global.jaxa.jp/projects/sas/slim/) |
| **Chang'e-4 Far-Side Landing Data** | CNSA / LROC Observation Analysis | Touchdown and topographic reconstruction at Von Kármán crater ($45.457^\circ\text{S}, 177.589^\circ\text{E}$) | [Nature Astronomy Report](https://doi.org/10.1038/s41550-019-0803-2) |
| **CLPS Commercial Lunar Deliveries** | NASA Commercial Lunar Payload Services | Siting and coordinates for IM-1 *Odysseus* (Malapert A) and IM-2 *Polar Prime-1* | [NASA CLPS Program](https://www.nasa.gov/commercial-lunar-payload-services/) |
| **Blue Ghost Mission 1 Flight Plan** | Firefly Aerospace / NASA CLPS | Touchdown site coordinates and operational profile at Mare Crisium ($18.56^\circ\text{N}, 61.81^\circ\text{E}$) | [Firefly Blue Ghost 1](https://fireflyspace.com/missions/blue-ghost-mission-1/) |

---

## 💻 Local Development & Build

### Prerequisites
* **Node.js**: v20.0.0 or higher
* **npm**: v10.0.0 or higher

### Installation & Run
```bash
# Clone the repository
git clone https://github.com/nafis-al-fuad/lunar-horizon.git
cd lunar-horizon

# Install dependencies
npm ci

# Start local development server
npm run dev

# Build production bundle (generates dist/ and frontend/dist/)
npm run build

# Preview production build locally
npm run preview
```

---

## 📄 License

This project is open-source under the [MIT License](LICENSE). Developed in accordance with the NASA International Space Apps Challenge guidelines.
