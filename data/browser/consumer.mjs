// Browser-native primitives only. This is a fixture smoke consumer, not a full
// v3 validator or a calculation worker. Python must approve the trusted manifest.

export function check(condition, message) {
  if (!condition) throw new Error(message);
}

const MAX_FILE = 1048576;
const textDecoder = new TextDecoder('utf-8', { fatal: true });
const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
  byte => byte.toString(16).padStart(2, '0')).join('');

export function safeHref(href) {
  check(typeof href === 'string' && /^[a-z0-9][a-z0-9/_.-]*$/.test(href), 'unsafe href');
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/;
  check(href.split('/').every(part => part && part !== '.' && part !== '..' &&
    !part.endsWith('.') && !reserved.test(part) && !['raw', 'work', '.venv'].includes(part)), 'unsafe path');
  return href;
}

export async function decodeFile(entry, payload) {
  for (const name of ['payload_bytes', 'decoded_bytes']) {
    check(Number.isSafeInteger(entry[name]) && entry[name] >= 0 && entry[name] <= MAX_FILE, 'size cap');
  }
  check(payload instanceof Uint8Array && payload.byteLength === entry.payload_bytes, 'payload length');
  check(await sha256(payload) === entry.sha256, 'payload hash');
  let decoded = payload;
  if (entry.storage_encoding === 'gzip') {
    const reader = new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks = [];
    let count = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        count += value.byteLength;
        check(count <= entry.decoded_bytes, 'decoded size cap');
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
    decoded = new Uint8Array(count);
    let offset = 0;
    for (const chunk of chunks) { decoded.set(chunk, offset); offset += chunk.byteLength; }
  } else {
    check(entry.storage_encoding === 'identity', 'unknown storage encoding');
  }
  check(decoded.byteLength === entry.decoded_bytes, 'decoded length');
  check(await sha256(decoded) === entry.decoded_sha256, 'decoded hash');
  return decoded;
}

export function decodeEphemeris(descriptor, payload) {
  check(descriptor.layout === 'interleaved_float32' && descriptor.arrays.length === 1, 'unsupported layout');
  const array = descriptor.arrays[0];
  check(array.dtype === 'float32' && array.scale === 1 && array.offset === 0 && array.invalid_code === null, 'unsupported encoding');
  check(array.shape.length === 2 && array.shape[1] === 8 && array.shape[0] === descriptor.grid.count, 'shape mismatch');
  check(Number.isSafeInteger(array.byte_offset) && array.byte_offset >= 0 && array.byte_offset % 4 === 0, 'unaligned array');
  check(payload.byteLength === descriptor.decoded_bytes && array.byte_offset + array.shape[0] * 32 === payload.byteLength, 'binary length');
  check(descriptor.guard_samples_before >= 2 && descriptor.guard_samples_after >= 2, 'missing guards');
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const values = [];
  for (let i = 0; i < array.shape[0] * 8; i++) {
    const value = view.getFloat32(array.byte_offset + i * 4, true);
    check(Number.isFinite(value), 'nonfinite float');
    values.push(value);
  }
  for (let row = 0; row < array.shape[0]; row++) {
    for (const column of [0, 4]) {
      const at = row * 8 + column;
      check(Math.abs(values.slice(at, at + 3).reduce((sum, v) => sum + v * v, 0) - 1) <= 1e-6, 'direction norm');
      check(values[at + 3] > 0, 'nonpositive range');
    }
  }
  return values;
}

export function trackTotals(intervals, window) {
  const totals = { clear: 0, blocked: 0, uncertain: 0, unknown: 0 };
  let cursor = window.start_et_s;
  check(Number.isFinite(cursor) && Number.isFinite(window.end_et_s) && cursor < window.end_et_s, 'invalid window');
  for (const item of intervals) {
    check(item.start_et_s === cursor && Number.isFinite(item.end_et_s) && item.end_et_s > cursor && item.end_et_s <= window.end_et_s, 'gap/overlap');
    check(Object.hasOwn(totals, item.state), 'invalid state');
    totals[item.state] += item.end_et_s - cursor;
    cursor = item.end_et_s;
  }
  check(cursor === window.end_et_s, 'incomplete window');
  return totals;
}

export async function loadFixture(readBytes) {
  const manifestBytes = await readBytes('manifest.json');
  check(manifestBytes.byteLength <= MAX_FILE, 'manifest too large');
  const manifest = JSON.parse(textDecoder.decode(manifestBytes));
  check(manifest.schema_version === '3.0' && manifest.data_kind === 'synthetic' && manifest.model_version === 'synthetic-foundation-v1', 'unsupported release');
  check(manifest.capabilities.every(c => c.enabled === false && c.accepted_scopes.length === 0), 'unexpected accepted capability');
  check(manifest.files.length === 11, 'unsupported fixture inventory');
  const ids = new Map(manifest.files.map(e => [e.id, e]));
  check(ids.size === manifest.files.length && new Set(manifest.files.map(e => e.href)).size === ids.size, 'duplicate index');
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    check(ids.has(id) && !visiting.has(id), 'missing/cyclic dependency');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of ids.get(id).depends_on) visit(dep);
    visiting.delete(id); visited.add(id);
  }
  for (const id of ids.keys()) visit(id);
  const resources = new Map(), binary = new Map();
  for (const entry of manifest.files) {
    safeHref(entry.href);
    const decoded = await decodeFile(entry, await readBytes(entry.href));
    if (entry.kind === 'binary') { binary.set(entry.id, decoded); continue; }
    const value = JSON.parse(textDecoder.decode(decoded));
    check(value.schema_version === '3.0' && value.dataset_id === manifest.dataset_id &&
      value.model_version === manifest.model_version && value.data_kind === 'synthetic' && value.file_kind === entry.kind, 'resource identity mismatch');
    resources.set(entry.id, value);
  }
  for (const id of Object.values(manifest.entrypoints)) check(id === null || resources.has(id), 'entrypoint missing');
  const summary = resources.get('summary');
  check(summary.release_decision === 'synthetic_only' && summary.gate_statuses.every(g => g.status === 'not_run'), 'false acceptance');
  const scenario = resources.get('scenario');
  const events = resources.get('events'), results = resources.get('results');
  check(events.scenario_id === scenario.scenario_id && results.scenario_id === scenario.scenario_id, 'scenario mismatch');
  const totals = trackTotals(events.tracks[0].intervals, scenario.window);
  for (const [state, value] of Object.entries(totals)) check(results.track_totals[0][state + '_s'] === value, 'totals mismatch');
  const estimate = results.metrics[0].estimate;
  check(estimate.value === null && estimate.lower === 0.25 && estimate.upper === 0.75, 'missing-data fraction mismatch');
  const descriptor = resources.get('ephemeris');
  const values = decodeEphemeris(descriptor, binary.get(descriptor.binary_file_id));
  return { dataset_id: manifest.dataset_id, indexed_files: ids.size, decoded_values: values, track_totals: totals,
    release_decision: summary.release_decision, actual_browser_test: 'not_run' };
}

export async function loadReleasePackage(readBytes) {
  const manifestBytes = await readBytes('manifest.json');
  check(manifestBytes.byteLength <= MAX_FILE, 'manifest too large');
  const manifest = JSON.parse(textDecoder.decode(manifestBytes));
  check(manifest.schema_version === '3.0', 'unsupported schema version');
  check(manifest.dataset_id === 'lunar-horizon-release-v1', 'unsupported release identity');
  check(manifest.data_kind === 'computed', 'release must be computed');

  const ids = new Map(manifest.files.map(e => [e.id, e]));
  check(ids.size === manifest.files.length, 'duplicate resource id');

  // Verify acyclic dependency graph
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    check(ids.has(id) && !visiting.has(id), 'missing or cyclic dependency: ' + id);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of ids.get(id).depends_on) visit(dep);
    visiting.delete(id); visited.add(id);
  }
  for (const id of ids.keys()) visit(id);

  // Load startup entrypoints
  const entrypoints = {};
  for (const [key, fileId] of Object.entries(manifest.entrypoints)) {
    if (!fileId) continue;
    const entry = ids.get(fileId);
    check(entry, 'missing entrypoint file: ' + fileId);
    const decoded = await decodeFile(entry, await readBytes(entry.href));
    entrypoints[key] = JSON.parse(textDecoder.decode(decoded));
  }

  // On-demand loader for scenarios, events, and results
  async function loadScenario(scenarioId) {
    const scEntry = ids.get('scenarios-' + scenarioId);
    check(scEntry, 'unknown scenario: ' + scenarioId);
    const scJson = JSON.parse(textDecoder.decode(await decodeFile(scEntry, await readBytes(scEntry.href))));

    const evEntry = ids.get('events-' + scenarioId);
    const evJson = JSON.parse(textDecoder.decode(await decodeFile(evEntry, await readBytes(evEntry.href))));

    const resEntry = ids.get('results-' + scenarioId);
    const resJson = JSON.parse(textDecoder.decode(await decodeFile(resEntry, await readBytes(resEntry.href))));

    return { scenario: scJson, events: evJson, results: resJson };
  }

  return { manifest, entrypoints, loadScenario };
}
