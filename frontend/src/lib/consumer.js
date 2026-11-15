// Browser dataset consumer for Lunar Horizon release package
// Connects UI directly to real JPL DE440 ephemeris chunks and ray-traced horizons

const BASE_PATH = '/data/release-v1/';
const textDecoder = new TextDecoder('utf-8');
const MOON_RADIUS_KM = 1737.4;

async function readBytes(href) {
  const url = `${BASE_PATH}${href.replace(/^\//, '')}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load resource: ${href} (status: ${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

// In-memory cache for fast tab and site switching
const cache = {
  manifest: null,
  entrypoints: {},
  scenarios: new Map(),
  horizons: new Map(),
  chunks: new Map(),
};

export async function initReleaseData() {
  if (cache.manifest) {
    return { manifest: cache.manifest, entrypoints: cache.entrypoints };
  }

  const manifestBytes = await readBytes('manifest.json');
  const manifest = JSON.parse(textDecoder.decode(manifestBytes));
  cache.manifest = manifest;

  const fileMap = new Map(manifest.files.map(f => [f.id, f]));

  // Load startup entrypoints
  for (const [key, fileId] of Object.entries(manifest.entrypoints)) {
    if (!fileId) continue;
    const entry = fileMap.get(fileId);
    if (!entry) continue;
    const dataBytes = await readBytes(entry.href);
    cache.entrypoints[key] = JSON.parse(textDecoder.decode(dataBytes));
  }

  return { manifest, entrypoints: cache.entrypoints };
}

export async function getSites() {
  const { entrypoints } = await initReleaseData();
  return entrypoints.sites?.sites || [];
}

export async function getValidationSummary() {
  const { entrypoints } = await initReleaseData();
  return entrypoints.validation_summary || null;
}

export async function getCoreContent() {
  const { entrypoints } = await initReleaseData();
  return entrypoints.core_content || null;
}

export async function getSources() {
  const { entrypoints } = await initReleaseData();
  return entrypoints.sources?.sources || [];
}

export async function loadScenarioData(scenarioId) {
  if (cache.scenarios.has(scenarioId)) {
    return cache.scenarios.get(scenarioId);
  }

  const { manifest } = await initReleaseData();
  const fileMap = new Map(manifest.files.map(f => [f.id, f]));

  const scEntry = fileMap.get(`scenarios-${scenarioId}`);
  const evEntry = fileMap.get(`events-${scenarioId}`);
  const resEntry = fileMap.get(`results-${scenarioId}`);

  if (!scEntry || !evEntry || !resEntry) {
    throw new Error(`Scenario resources missing for ID: ${scenarioId}`);
  }

  const [scBytes, evBytes, resBytes] = await Promise.all([
    readBytes(scEntry.href),
    readBytes(evEntry.href),
    readBytes(resEntry.href)
  ]);

  const result = {
    scenario: JSON.parse(textDecoder.decode(scBytes)),
    events: JSON.parse(textDecoder.decode(evBytes)),
    results: JSON.parse(textDecoder.decode(resBytes))
  };

  cache.scenarios.set(scenarioId, result);
  return result;
}

export async function loadHorizonData(siteId) {
  if (cache.horizons.has(siteId)) {
    return cache.horizons.get(siteId);
  }

  const href = `horizons/geom-${siteId}.json`;
  const bytes = await readBytes(href);
  const data = JSON.parse(textDecoder.decode(bytes));
  cache.horizons.set(siteId, data);
  return data;
}

// Query terrain elevation from horizon bins (handles both numbers and { elevation: { value } } objects)
export function queryHorizonElevation(horizonPayload, azimuthDeg) {
  if (!horizonPayload || !horizonPayload.bins) return 0.0;
  const bins = horizonPayload.bins;
  const n = bins.length;
  let az = ((azimuthDeg % 360) + 360) % 360;
  const step = 360.0 / n;
  const idx = az / step;
  const i0 = Math.floor(idx) % n;
  const i1 = (i0 + 1) % n;
  const frac = idx - Math.floor(idx);

  const getVal = (b) => {
    if (b == null) return 0.0;
    if (typeof b === 'number') return b;
    if (typeof b.elevation === 'object' && b.elevation !== null) return b.elevation.value ?? 0.0;
    if (typeof b.elevation_deg === 'number') return b.elevation_deg;
    if (typeof b.value === 'number') return b.value;
    return 0.0;
  };

  const v0 = getVal(bins[i0]);
  const v1 = getVal(bins[i1]);
  return v0 + frac * (v1 - v0);
}

// Load real JPL DE440 ephemeris binary chunk (15,680 bytes)
export async function loadEphemerisChunk(chunkIndex) {
  const clamped = Math.max(0, Math.min(121, chunkIndex));
  if (cache.chunks.has(clamped)) {
    return cache.chunks.get(clamped);
  }

  const chunkId = `chunk-${String(clamped).padStart(4, '0')}`;
  const href = `ephemeris/${chunkId}.bin`;
  const bytes = await readBytes(href);
  const floats = new Float32Array(bytes.buffer, bytes.byteOffset, 245 * 8);

  cache.chunks.set(clamped, { chunkId, floats });
  return { chunkId, floats };
}

// Compute exact topocentric vector from body-fixed MOON_ME Cartesian position
export function computeTopocentric(targetUnit, targetDistKm, latDeg, lonDeg, heightKm = 0.0) {
  const phi = (latDeg * Math.PI) / 180.0;
  const lam = (lonDeg * Math.PI) / 180.0;

  // Local East, North, Up unit vectors in MOON_ME frame
  const up = [Math.cos(phi) * Math.cos(lam), Math.cos(phi) * Math.sin(lam), Math.sin(phi)];
  const east = [-Math.sin(lam), Math.cos(lam), 0.0];
  const north = [-Math.sin(phi) * Math.cos(lam), -Math.sin(phi) * Math.sin(lam), Math.cos(phi)];

  const rObs = MOON_RADIUS_KM + heightKm;
  const obs = [rObs * up[0], rObs * up[1], rObs * up[2]];

  const target = [targetUnit[0] * targetDistKm, targetUnit[1] * targetDistKm, targetUnit[2] * targetDistKm];
  const topo = [target[0] - obs[0], target[1] - obs[1], target[2] - obs[2]];

  const x = topo[0] * east[0] + topo[1] * east[1] + topo[2] * east[2];
  const y = topo[0] * north[0] + topo[1] * north[1] + topo[2] * north[2];
  const z = topo[0] * up[0] + topo[1] * up[1] + topo[2] * up[2];

  const horizDist = Math.sqrt(x * x + y * y);
  const elDeg = (Math.atan2(z, horizDist) * 180.0) / Math.PI;
  const azDeg = ((Math.atan2(x, y) * 180.0) / Math.PI + 360.0) % 360.0;

  return {
    azimuth_deg: azDeg,
    elevation_deg: elDeg,
    range_km: Math.sqrt(x * x + y * y + z * z)
  };
}

// Load and evaluate complete 30-day topocentric timeseries from real DE440 chunk
export async function loadMonthlyEphemerisTimeseries(year, monthIndex, site, horizonData, mastHeightM = 2.0) {
  const chunkIndex = Math.max(0, Math.min(121, (year - 2026) * 12 + monthIndex));
  const { chunkId, floats } = await loadEphemerisChunk(chunkIndex);

  const latDeg = site?.lat_deg ?? -89.44;
  const lonDeg = site?.lon_deg ?? -137.40;
  const groundElevationKm = (site?.terrain_height_m ?? 0.0) / 1000.0;
  const mastHeightKm = mastHeightM / 1000.0;
  const totalHeightKm = groundElevationKm + mastHeightKm;

  // Dip angle in degrees due to observer height above spherical moon
  const dipDeg = -Math.acos(MOON_RADIUS_KM / (MOON_RADIUS_KM + mastHeightKm)) * (180.0 / Math.PI);

  const numSamples = 240; // 30 days in 3-hour increments (240 steps)
  const timeseries = [];
  let sunlitSamples = 0;
  let dteActiveSamples = 0;
  let currentNightRun = 0;
  let maxNightRun = 0;

  for (let s = 0; s <= numSamples; s++) {
    const offset = s * 8;
    const sunUnit = [floats[offset], floats[offset + 1], floats[offset + 2]];
    const sunDist = floats[offset + 3];

    const earthUnit = [floats[offset + 4], floats[offset + 5], floats[offset + 6]];
    const earthDist = floats[offset + 7];

    const sunTopo = computeTopocentric(sunUnit, sunDist, latDeg, lonDeg, totalHeightKm);
    const earthTopo = computeTopocentric(earthUnit, earthDist, latDeg, lonDeg, totalHeightKm);

    // Query real ray-traced horizon obstruction at sun & earth azimuths
    const sunObstruction = queryHorizonElevation(horizonData, sunTopo.azimuth_deg) + dipDeg;
    const earthObstruction = queryHorizonElevation(horizonData, earthTopo.azimuth_deg) + dipDeg;

    const sunClearance = sunTopo.elevation_deg - sunObstruction;
    const isSunlit = sunClearance > 0.0;

    const earthClearance = earthTopo.elevation_deg - earthObstruction;
    const isDteActive = earthClearance > 0.0;

    // Power output model: 620W nominal scaled by grazing solar angle
    const powerWatts = isSunlit ? Math.max(0, Math.round(620 * Math.min(1.0, Math.max(0, sunTopo.elevation_deg / 1.5)))) : 0;

    if (isSunlit) {
      sunlitSamples++;
      if (currentNightRun > maxNightRun) maxNightRun = currentNightRun;
      currentNightRun = 0;
    } else {
      currentNightRun += 3; // 3 hours per sample
    }

    if (isDteActive) dteActiveSamples++;

    timeseries.push({
      sampleIndex: s,
      hourOffset: s * 3,
      sun: {
        azimuth_deg: Number(sunTopo.azimuth_deg.toFixed(2)),
        elevation_deg: Number(sunTopo.elevation_deg.toFixed(2)),
        clearance_deg: Number(sunClearance.toFixed(2)),
        state: isSunlit ? 'clear' : 'blocked'
      },
      earth: {
        azimuth_deg: Number(earthTopo.azimuth_deg.toFixed(2)),
        elevation_deg: Number(earthTopo.elevation_deg.toFixed(2)),
        clearance_deg: Number(earthClearance.toFixed(2)),
        state: isDteActive ? 'clear' : 'blocked'
      },
      power_watts: powerWatts,
      dte_active: isDteActive
    });
  }

  if (currentNightRun > maxNightRun) maxNightRun = currentNightRun;

  const sunlitPercent = (sunlitSamples / (numSamples + 1)) * 100.0;
  const dtePercent = (dteActiveSamples / (numSamples + 1)) * 100.0;

  return {
    chunkId,
    year,
    monthIndex,
    totalSteps: numSamples,
    timeseries,
    metrics: {
      sunlit_percent: Number(sunlitPercent.toFixed(1)),
      sunlit_hours: Number((sunlitSamples * 3).toFixed(1)),
      dte_percent: Number(dtePercent.toFixed(1)),
      longest_night_hours: maxNightRun
    }
  };
}