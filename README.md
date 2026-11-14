# 🌕 Lunar Horizon

**High-Precision Astrodynamics, Illumination & Direct-to-Earth Communications Engine for Lunar South Pole Exploration**

*Developed for the NASA International Space Apps Challenge 2026 — Lunar Landing Site Navigator*

---

## Overview

When lunar mission timelines shift or launch windows slip, mission planners and scientists must rapidly evaluate alternative landing dates and sites to guarantee two mission-critical resources:
1. **Power (Solar Illumination):** Ensuring sunlight reaches solar arrays across the local terrain horizon.
2. **Communications (Direct-to-Earth / DTE):** Maintaining unobstructed line-of-sight to ground tracking stations while accounting for lunar libration and topographic masking.

**Lunar Horizon** provides an offline-first, high-precision astrodynamics and terrain modeling pipeline. It generates quantized, web-optimized datasets that enable instant in-browser scenario evaluation, date-slip analysis, and multi-site comparisons across the entire 2026–2035 exploration decade.

> [!NOTE]
> **Scientific Scope & Demonstration Boundaries:** Planetary ephemerides and celestial coordinates are rigorously computed from official NASA NAIF SPICE kernels (DE440 / DE421). In this release, South Polar terrain grids, slope maps, and ray-traced horizon skylines are generated from a calibrated **synthetic demonstration surface** anchored to published regional spot heights (Smith et al. 2010; Barker et al. 2021) for full-pipeline architectural demonstration, not continuous flight-grade LOLA DEM rasters.

---

## Key Capabilities

### 🛰️ 10-Year High-Precision Ephemerides (2026–2035)
* Pre-computed solar and terrestrial position vectors at uniform 3-hour intervals spanning a complete decade (`[2026-01-01, 2036-01-01)`).
* Derived from official NASA NAIF SPICE planetary ephemerides (`de440s.bsp`) and high-precision lunar orientation kernels (`moon_pa_de421_1900-2050.bpc`).
* Evaluated in the lunar body-fixed Mean-Earth/Polar-Axis frame (`MOON_ME_DE421`).
* Quantized into 122 web-friendly binary chunks (2.31 MB total) with cubic Catmull-Rom spline interpolation guards preserving $<0.001^\circ$ angular accuracy.

### 📍 Curated Landing Sites Catalog (16 Sites)
* **Artemis & CLPS South Pole Candidates:**
  * **Shackleton Connecting Ridge (Site 001):** High illumination crest between Shackleton and de Gerlache.
  * **Shackleton Crater Rim:** Extreme solar exposure and cold-trap access.
  * **Peak of Eternal Light 1 (PEL 1):** Historical quasi-permanent illumination benchmark.
  * **Malapert Massif Summit (Site 004):** Prominent high-elevation plateau evaluated for geometric Earth visibility and topographic masking.
  * **Haworth Crater Rim:** Elevated ridge adjacent to deep permanently shadowed regions (PSRs).
  * **Nobile Crater Rim (Mons Mouton):** Broad landing plateau and VIPER study region.
  * **Amundsen Crater Rim & de Gerlache Rim:** Strategic high-latitude exploration sites.
* **Historical & Benchmark Comparison Points:**
  * **Intuitive Machines IM-1 (Odysseus / Malapert A):** First commercial CLPS soft landing.
  * **Intuitive Machines IM-2 (PRIME-1 target):** Polar subsurface drill demonstration site.
  * **Chandrayaan-3 (Shiv Shakti Point):** Historic southern high-latitude landing site.
  * **SLIM (Shioli Crater):** Precision pinpoint lunar landing benchmark.
  * **Apollo 11 & Apollo 17:** Classic equatorial baseline diurnal comparison sites.
  * **Chang'e-4 (Von Kármán Crater):** Lunar far side baseline (permanently shielded from direct Earth line-of-sight).
  * **Astrobotic Blue Ghost 1:** Mare Crisium candidate landing site.

### 🏔️ Topographic Horizon Profiles & Dip Geometry
* 360-degree azimuthal skyline models for each landing site computed with exact lunar spherical curvature ($R = 1,737,400\text{ m}$). Ray-traced horizons from the polar demonstration surface for South Polar exploration sites; analytical spherical dip for benchmark sites.
* Configurable observer mast heights (0.0 m to 12.0 m) modeling lander antennas and mast-mounted solar arrays.
* Fast circular linear interpolation between azimuthal skyline bins.

### ☀️ Topocentric Visibility, Phase & Eclipse Modeling
* **Solar Disc Visibility:** Computes instantaneous topocentric clearance and partial disc occultation.
* **Direct-to-Earth (DTE) Links:** Calculates Earth topocentric elevation against the horizon with configurable safety clearance margins.
* **Eclipse Geometry:** Detects topocentric solar and lunar occultations, calculating exact unocculted solar disc fractions and distinguishing internal totality contacts.
* **Earth Lit Phase:** Models topocentric Earth illuminated fraction and phase angle across anomalistic and draconic libration cycles.

### 📊 Mission Timelines & Event Accounting
* Continuous partition tracks for `sunlight`, `dte`, and `simultaneous` (both power and comms available).
* Mission summary metrics:
  * Sunlit window fraction (`sunlit_time_fraction`)
  * Direct-to-Earth communication fraction (`dte_time_fraction`)
  * Simultaneous power & communications fraction (`simultaneous_time_fraction`)
  * Longest continuous night / blackout duration (`longest_night_s`)
  * Peak solar elevation (`peak_sun_elevation_deg`)
  * Minimum terrain clearance margin (`min_sun_clearance_deg`)

### 🗺️ South Polar Terrain & Slope Layer (80°S–90°S) — Synthetic Demonstration
* South Polar Stereographic demonstration digital elevation model (DEM) and quantized slope grid layer ($0.5^\circ$ resolution) anchored to regional spot heights for pipeline verification and lander touchdown slope assessment.

---

## Published Dataset (`lunar-horizon-release-v1`)

The release bundle is structured according to the unified Lunar Horizon schema 3.0:

| Path | Product | Description |
| :--- | :---: | :--- |
| `manifest.json` | **P01** | Top-level index mapping all 286 resources, SHA-256 digests, and capabilities |
| `model.json` | **P01** | Model parameters, lunar reference figure, coordinate frames, and threshold rules |
| `sources.json` | **P01** | Data provenance, kernel versioning, and NASA/JPL citations |
| `time.json` | **P01** | UTC $\leftrightarrow$ ET time conversion knots derived from the pinned `naif0012` LSK |
| `sites.json` | **P02** | Curated catalog of 16 landing sites with verified coordinates and uncertainties |
| `terrain/` | **P04** | South Polar stereographic DEM index, metadata, and binary elevation grid |
| `slope/` | **P05** | South Polar stereographic slope descriptor and binary slope grid |
| `horizons/` | **P06** | 360° azimuthal horizon masks for each curated landing site |
| `ephemeris/` | **P03** | 122 binary chunks covering 2026–2035 Sun and Earth position vectors |
| `scenarios/` | **P09** | Baseline mission scenario specifications for Artemis III, CLPS, and Apollo |
| `events/` | **P08** | Evaluated timeline intervals (`sunlight`, `dte`, `simultaneous`) per scenario |
| `results/` | **P09** | Extracted mission metrics, longest night, and threshold viability determinations |
| `content/core.json` | **P15** | UI terminology, educational glossaries, and physical modeling assumptions |
| `validation/summary.json`| **P14** | Complete status summary of release validation gates (V01–V12) |

---

## Rigorous Verification

Lunar Horizon includes an automated test harness ensuring reproducible precision:

* **182 Automated Unit Tests:** Covering coordinate boundaries, pole meridian logic, ephemeris interpolation, horizon dip angles, eclipse intersections, and timeline partitioning.
* **JPL TESTPO Conformance:** Passed all 17 selected position and velocity scalar components from the official JPL `testpo.440` test suite within strict $10^{-12}$ tolerance ($< 2.1 \times 10^{-17}\text{ AU}$ position error, $< 3.5 \times 10^{-18}\text{ AU/day}$ velocity error against the strict JPL $10^{-13}$ threshold). Catmull-Rom interpolated ephemerides verified against JPL polynomial evaluations to within stated $< 0.001^\circ$ angular tolerance.
* **Historical Component Verification (Ephemeris Math):** An offline DE440 ASCII evaluator (`de440_ascii.py`) previously verified fundamental Chebyshev polynomial evaluation against raw JPL ASCII coefficients for isolated ephemeris components.
* **Node.js Package Loader Verification:** Tested via Node.js headless loader (`smoke-release.mjs`) verifying 100% SHA-256 payload digests, manifest integrity, and JSON/binary parsing. Interactive in-browser testing is scheduled for the frontend UI development phase.

---

## Getting Started

### Prerequisites
* Python 3.12+ (standard library for core validation; `numpy` and `spiceypy` for kernel processing)
* Node.js 20+ (for consumer smoke checks)

### Run Tests
```powershell
cd data
python -m unittest discover tests
```

### Rebuild Unified Dataset Release
```powershell
cd data
python run_publisher.py
```

---

## Citations & Acknowledgments

* **NASA / JPL NAIF:** Navigation and Ancillary Information Facility for the SPICE system and generic planetary/lunar ephemeris kernels (`de440s.bsp`, `moon_pa_de421_1900-2050.bpc`, `pck00011.tpc`, `naif0012.tls`).
* **NASA GSFC LRO Team:** Lunar Reconnaissance Orbiter LOLA and LROC science teams for lunar digital elevation models and landing site coordinates.
* **JPL Solar System Dynamics Group:** Horizons On-Line Ephemeris System and DE440 ASCII development ephemeris coefficients.

---

## License

This project is licensed under the [MIT License](LICENSE) — see the LICENSE file for details. Open-source and freely available in compliance with NASA Space Apps Challenge participant rules.
