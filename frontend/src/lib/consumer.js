// Browser dataset consumer for Lunar Horizon release package

const BASE_PATH = '/data/release-v1/';

const textDecoder = new TextDecoder('utf-8');

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
  return bins[i0] + frac * (bins[i1] - bins[i0]);
}
