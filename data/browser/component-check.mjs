// Actual-browser Fetch/Web Crypto checks. No Node APIs and no dependencies.
import { check } from './consumer.mjs';
import { decodeChunk, interpolate, loadPreview, utcToEt } from './ephemeris.mjs';

const started = performance.now();
const requests = [], rejectionCases = [], chunkTimings = [];
const heap = () => performance.memory ? {
  used_js_heap_bytes: performance.memory.usedJSHeapSize,
  total_js_heap_bytes: performance.memory.totalJSHeapSize,
  js_heap_limit_bytes: performance.memory.jsHeapSizeLimit,
} : { status: 'unavailable' };
const initialHeap = heap();
async function read(href, fault = '') {
  const begin = performance.now();
  const url = '/package/' + href + (fault ? '?fault=' + fault : '');
  const response = await fetch(url, { cache: 'no-store' });
  const bytes = new Uint8Array(await response.arrayBuffer());
  requests.push({ href, fault, status: response.status, bytes: bytes.length, duration_ms: performance.now()-begin });
  check(response.ok, 'HTTP resource failure ' + response.status);
  return bytes;
}
async function rejects(name, action, expectedMessage = '') {
  let error = null;
  try { await action(); } catch (caught) { error = String(caught); }
  check(error !== null, 'expected rejection: ' + name);
  check(error.includes(expectedMessage), 'wrong rejection reason: ' + name);
  rejectionCases.push({ name, error });
}
let result;
try {
  const parityResponse = await fetch('/parity.json', { cache: 'no-store' });
  check(parityResponse.ok, 'parity fetch');
  const parity = await parityResponse.json();
  check(Array.isArray(parity) && parity.length === 732, 'frozen parity case count');
  const loadStart = performance.now();
  const preview = await loadPreview(read);
  const startupMs = performance.now()-loadStart;
  check(requests.length === 2 && requests[0].href === 'manifest.json' && requests[1].href === 'time.json', 'startup eager reads');
  const startupRequests = requests.slice();
  check(preview.manifest.chunks.length === 122, 'frozen chunk count');
  let previous = null, first = null, comparisons = 0, seams = 0, maxError = 0, maxValues = 0;
  function compare(loaded, item) {
    const row = preview.sample(loaded, item.profile, item.et_s);
    check(row.length === item.expected.length && row.length === 8, 'row length');
    for (let j = 0; j < 8; j++) {
      const error = Math.abs(row[j]-item.expected[j]);
      check(error <= (j === 3 || j === 7 ? 1e-6 : 1e-12), 'numerical parity');
      comparisons++;
      maxError = Math.max(maxError, error);
    }
  }
  for (let index = 0; index < preview.manifest.chunks.length; index++) {
    const begin = performance.now(), before = requests.length;
    const loaded = await preview.chunk(index);
    chunkTimings.push({ index, fetch_hash_decode_ms: performance.now()-begin });
    check(requests.length === before+2, 'chunk request count');
    if (index === 0) { first = loaded; check(requests.length === 4, 'first chunk requests'); }
    const cases = parity.filter(item => item.chunk === index);
    check(cases.length === 6, 'per-chunk parity coverage');
    for (const item of cases) compare(loaded, item);
    maxValues = Math.max(maxValues, loaded.arrays.geometric.length + loaded.arrays.apparent.length);
    if (previous) {
      for (const profile of ['geometric', 'apparent']) {
        const a = previous.arrays[profile].slice(-40), b = loaded.arrays[profile].slice(0,40);
        check(a.every((v, i) => v === b[i]), 'seam overlap');
      }
      seams++;
    }
    previous = loaded;
  }
  check(comparisons === 5856 && seams === 121 && maxValues === 3920, 'coverage/count regression');
  const mainComparisons = comparisons;
  const span = preview.manifest.usable_span;
  for (const [name, et] of [['NaN', NaN], ['infinity', Infinity], ['before-start', span.start_et_s-1], ['exclusive-end', span.end_et_s]]) {
    // The final descriptor extends beyond the release endpoint: use the last
    // chunk so this cannot pass merely because the first chunk rejects the time.
    const loaded = name === 'exclusive-end' ? previous : first;
    if (name === 'exclusive-end') {
      check(loaded.descriptor.usable_span.end_et_s > et, 'endpoint isolation fixture');
      check(interpolate(loaded.descriptor, loaded.arrays.geometric, et).every(Number.isFinite),
        'chunk-local interpolation must permit the padded endpoint control');
    }
    await rejects(name, () => preview.sample(loaded, 'geometric', et), 'ET outside release');
  }
  await rejects('wrong-chunk', () => preview.sample(first, 'geometric', previous.descriptor.usable_span.start_et_s));
  await rejects('unknown-profile', () => preview.sample(first, 'unknown', span.start_et_s));
  for (const index of [-1, 122, 0.5]) await rejects('chunk-index-' + index, () => preview.chunk(index));
  for (const utc of ['2026-02-30T00:00:00Z', '2026-01-01T23:59:60Z', '2026-01-01T00:00:00+00:00', '2036-01-01T00:00:00Z']) {
    await rejects(utc, () => utcToEt(preview.time, utc));
  }
  check(utcToEt(preview.time, '2026-01-01T00:00:00Z') === span.start_et_s, 'UTC start');
  let timeKnots = 0;
  for (const segment of preview.time.segments) {
    for (const knot of segment.knots.slice(0,-1)) {
      const utc = new Date(knot.unix_s*1000).toISOString();
      check(Math.abs(utcToEt(preview.time, utc)-(knot.unix_s-946728000+knot.et_minus_unix_from_j2000_s)) <= 1e-7, 'UTC knot');
      timeKnots++;
    }
  }
  const binary = preview.manifest.chunks[0].binary;
  const payload = await read(binary);
  await rejects('truncated', () => decodeChunk(first.descriptor, payload.slice(1)));
  const nonfinite = payload.slice();
  new DataView(nonfinite.buffer).setFloat32(0, NaN, true);
  await rejects('nonfinite-storage', () => decodeChunk(first.descriptor, nonfinite));
  const mismatch = structuredClone(first.descriptor);
  mismatch.surface_frame = 'IAU_MOON';
  await rejects('metadata-frame', () => decodeChunk(mismatch, payload));
  for (const fault of ['missing', 'corrupt']) {
    const faulty = await loadPreview(href => read(href, href === binary ? fault : ''));
    await rejects('HTTP-' + fault, () => faulty.chunk(0));
  }
  for (const index of [0, 121, 61, 0, 121, 61]) {
    const loaded = await preview.chunk(index);
    for (const item of parity.filter(item => item.chunk === index)) compare(loaded, item);
  }
  check(rejectionCases.length === 18, 'rejection coverage');
  result = { status: 'passed', dataset_id: preview.manifest.dataset_id, chunks: 122, seams,
    comparisons: mainComparisons, repeated_comparisons: comparisons-mainComparisons,
    max_absolute_parity_error: maxError, time_knots: timeKnots, rejection_cases: rejectionCases,
    startup_requests: startupRequests, startup_ms: startupMs, chunk_timings: chunkTimings,
    max_decoded_values_per_chunk: maxValues,
    endpoint_control: { chunk: 121, release_end_et_s: span.end_et_s,
      chunk_end_et_s: previous.descriptor.usable_span.end_et_s, chunk_local_interpolation: 'passed' },
    limitation: 'Headless Windows desktop component only; no performance budget, leak proof, UI or science acceptance.' };
} catch (error) {
  result = { status: 'failed', error: String(error), stack: error.stack, rejection_cases: rejectionCases };
}
Object.assign(result, { user_agent: navigator.userAgent, platform: navigator.platform,
  secure_context: isSecureContext, duration_ms: performance.now()-started,
  initial_heap: initialHeap, final_heap: heap(), package_requests: requests,
  package_response_bytes: requests.reduce((sum, item) => sum+item.bytes, 0) });
document.getElementById('result').textContent = JSON.stringify(result, null, 2);
const token = new URLSearchParams(location.search).get('token');
await fetch('/result?token=' + encodeURIComponent(token), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result),
});