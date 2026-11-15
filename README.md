# 🌕 Lunar Horizon

**High-Precision Astrodynamics, Solar Illumination & Direct-to-Earth (DTE) Communications Engine for Lunar South Pole Exploration**

*Developed for the NASA International Space Apps Challenge — Lunar Landing Site Navigator*

[![Live Site](https://img.shields.io/badge/Live%20Application-lunar--horizon.pages.dev-0052FF?style=for-the-badge&logo=cloudflare&logoColor=white)](https://lunar-horizon.pages.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg?style=for-the-badge)](LICENSE)
[![NASA SPICE](https://img.shields.io/badge/NASA%20SPICE-DE440%20%2F%20DE421-blue.svg?style=for-the-badge)](https://naif.jpl.nasa.gov/naif/data.html)
[![LOLA DEM](https://img.shields.io/badge/LRO%20LOLA-South%20Pole%20DEM-emerald.svg?style=for-the-badge)](https://lola.gsfc.nasa.gov/)

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
* **Persistent Application Header:** Live site coordinates, active scenario badge, and navigation tabs.
* **Pro Mode Engine (`m` shortcut):** Toggles between standard overview and high-precision engineering mode ($\pm 0.2^\circ$ LOLA DEM terrain uncertainty band, DTE guide threshold lines, and grazing solar margin limits).
* **Launch Slip & Plan B Drawer (`s` shortcut):** Instant contingency recommendation drawer computing alternate candidate sites and slip windows when nominal launch epochs slip (+7d, +14d, +30d).
* **Interactive User Manual Modal (`u` shortcut):**
  * *Part 1 (How to Use):* 5-step onboarding guide for first-time operators.
  * *Part 2 (Control Dictionary):* Searchable categorized dictionary defining every button, stepper, and status indicator.
* **Scientific Limitations & Assumptions Drawer (`a` shortcut):** Complete transparency documentation citing celestial frame definitions, KaTeX formulas for dip geometry, and DEM resolution boundaries.
* **Keyboard Shortcut Matrix (`?` shortcut):** Full tactile hotkeys (`1`–`6` for screen navigation, `Space` for playback, `s` for slip, `m` for pro mode, `k` for share, `u` for manual, `Esc` to dismiss).
* **Permalink State Sync (`k` shortcut):** Encodes active site, date, time index, mode, mast height, and scenario slots into the browser URL hash for instant sharing.

---

### 2. Screen 1: Navigator & 360° Topographic Skyline
* **16 Curated Landing Sites Combobox:** Searchable catalog of Artemis candidate regions, CLPS target sites, and historical exploration benchmarks with exact coordinates and terrain tiers.
* **Custom Coordinates Input:** Direct latitude ($-90^\circ$ to $+90^\circ$) and longitude ($-180^\circ$ to $+180^\circ$) inputs with validation.
* **Interactive Polar Stereographic Mini Map (80°S–90°S):** Interactive south polar map with concentric latitude rings, meridian spokes, landing reticles, and click-to-sample terrain queries.
* **360° Panoramic Terrain Silhouette:** Plots continuous lunar skyline elevation ($-2^\circ$ to $+15^\circ$) across all $0^\circ$–$360^\circ$ azimuths relative to the geometric astronomical horizon.
* **Real-Time Celestial Body Tracking:**
  * **Solar Disc:** Real-time topocentric azimuth and elevation, dynamic corona halo, physical ridge occlusion detection, and below-horizon alerts.
  * **Earth Disc:** Real-time azimuth and elevation, optical phase shading, and continuous libration track polyline.
* **Lander Mast Height Stepper:** Adjustable vantage vantage height ($0.0\text{ m}$ to $10.0\text{ m}$) dynamically lowering the geometric horizon dip angle ($\Delta \theta \approx \sqrt{2h/R_{\text{moon}}}$).
* **True-Scale 1:1 Celestial Inset:**
  * Isotropic $1:1$ viewport rendering the Sun ($0.53^\circ$ angular diameter) and Earth ($1.91^\circ$ angular diameter) with zero vertical exaggeration.
  * **Automated Dual-Pane Viewport:** Automatically splits into synchronized left (Solar) and right (Earth) viewports when angular separation exceeds the active Field of View ($2^\circ$, $4^\circ$, $8^\circ$, or default $16^\circ$).
  * **Live 8-Card Telemetry HUD:** Real-time readouts for Sun Position (Az/El), Sun Ridge Clearance, Earth Position, Earth DTE Margin, Center-to-Center Angular Separation, Solar Eclipse Disc Occultation %, Local Horizon Crest, and True-Scale Ratio ($13.8\text{ px/}^\circ$).
* **3D Interactive Moon Globe:**
  * Real-time WebGL Three.js lunar globe with photo-realistic surface bump texture.
  * Sub-solar and sub-earth ground tracks, terminator shadow plane, and interactive 3D landing site pins with click-to-focus and hover tooltips.
  * OrbitControls zoom, rotate, and drag with event propagation isolation so page scroll remains unaffected when cursor is over the globe.

---

### 3. Persistent Bottom Dock & Multi-Track Timeline (Image 1 Specifications)
* **Transport Playback Bar:** Full transport controls (`|<`, `<`, Play/Pause, `>`, `>|`) with adjustable speeds ($1$, $2$, $4$, $12$, $24\text{ h/sec}$) and discrete step increments ($15\text{m}$, $1\text{h}$, $3\text{h}$, $6\text{h}$, $24\text{h}$).
* **10-Year JPL Ephemeris Navigation:** Direct Year selector ($2026$–$2036$) and Month selector ($122$ binary chunks loaded on the fly).
* **30-Day Timeline Ruler:** Tick marks (`MAR 01`, `05`, `10`, `25`, `31`), milestone event badges (`▼ SUNSET 15`, `• EARTHSET`, `✦ ECLIPSE`), and amber scrubber pill handle.
* **4 Synchronized Multi-Track Strips:**
  1. **`TRACK 1: SUN ELEV`**: Continuous solar elevation curve above the horizon with warm translucent area fill.
  2. **`TRACK 2: POWER (W)`**: Solar array generation curve in emerald green with red dotted threshold line and danger-shaded red zone during occultation dips.
  3. **`TRACK 3: DTE WINDOW`**: Blue carrier lock segments (`CONTINUOUS CARRIER LOCK (344h)`) and dark `RADIO GAP` blocks.
  4. **`TRACK 4: COLD SOAK`**: Dedicated blocks for thermal dormancy (`COLD SOAK (54h)`) and eclipse events (`ECL`).
* **Synchronized Vertical Hairline:** Amber cursor hairline spanning from ruler down through all 4 tracks.
* **Dock Ergonomics:** Drag-to-resize handle bar (resizable from $130\text{ px}$ to $460\text{ px}$) and collapsible `TIMELINES ^` drawer toggle.

---

### 4. Screen 2: Timeline Analytics & Partition Breakdown
* Cumulative mission duration charts partitioning time into `sunlight`, `dte`, and `simultaneous` windows.
* Outage frequency histograms and longest continuous night metrics.

---

### 5. Screen 3: Scenario Comparison Matrix (Image 2 Specifications)
* **Dynamic Multi-Slot Grid:** $2\times2$ grid comparing up to N scenarios simultaneously (Slot A, B, C, D, and dynamic `+ Add Slot` for Slot E, F, etc.).
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

## 🏛️ NASA Data Sources, Tools & References

Lunar Horizon relies directly on scientific datasets, SPICE kernels, and ephemeris systems developed by NASA and its research centers:

| NASA Resource | Providing Facility | Purpose in Lunar Horizon | Official Reference Link |
| :--- | :--- | :--- | :--- |
| **NASA NAIF SPICE** | JPL / NAIF | Planetary & lunar ephemeris computation | [https://naif.jpl.nasa.gov](https://naif.jpl.nasa.gov) |
| **DE440 Ephemeris** | JPL Solar System Dynamics | High-precision solar and planetary position vectors | [JPL DE440 Kernels](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/) |
| **Lunar Orientation** | JPL / NAIF | High-precision lunar body-fixed frame (`MOON_ME_DE421`) | [JPL Lunar PCK Kernels](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/) |
| **LRO LOLA DEM** | NASA GSFC / LRO Team | Digital elevation models and crater rim topography | [NASA LOLA Science Team](https://lola.gsfc.nasa.gov/) |
| **LROC Candidate Atlas** | Arizona State University / NASA | High-resolution candidate landing site coordinates | [LROC Featured Sites Atlas](https://www.lroc.asu.edu/featured_sites/) |
| **JPL Horizons System** | NASA JPL | Ground-truth verification for topocentric coordinates | [JPL Horizons On-Line System](https://ssd.jpl.nasa.gov/horizons/) |
| **Artemis Candidate Regions** | NASA Headquarters | Siting parameters for Artemis III/IV exploration zones | [NASA Artemis Candidate Regions](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-artemis-iii-lunar-landing/) |
| **NASA Space Apps** | NASA Earth Science Division | Innovation hackathon problem statement and guidelines | [NASA Space Apps Challenge](https://www.spaceappschallenge.org/) |

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
