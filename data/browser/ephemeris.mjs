// Browser-native preview consumer. Requires a trusted, Python-approved manifest.
// No SPICE, network service, terrain model, or scientific acceptance is implied.
import { check, safeHref } from './consumer.mjs';

const MAX_FILE = 2000000;
const decoder = new TextDecoder('utf-8', { fatal: true });
const profiles = ['geometric', 'apparent'];
const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
  byte => byte.toString(16).padStart(2, '0')).join('');

export function interpolate(descriptor, values, et) {
  const { start_et_s: start, end_et_s: end } = descriptor.usable_span;
  check(Number.isFinite(et) && start <= et && et < end, 'ET outside chunk');
  const { count, t0_et_s: t0, step_s: step } = descriptor.grid;
  check(values.length === count * 8 && step > 0, 'bad interpolation array');
  const x = (et - t0) / step;
  const i = Math.floor(x), t = x - i;
  check(i >= 1 && i + 2 < count, 'missing stencil');
  const result = [];
  for (let k = 0; k < 8; k++) {
    const [a, b, c, d] = [-1, 0, 1, 2].map(j => values[(i + j) * 8 + k]);
    check([a, b, c, d].every(Number.isFinite), 'nonfinite stencil');
    result.push(0.5 * (2*b + (-a+c)*t + (2*a-5*b+4*c-d)*t*t + (-a+3*b-3*c+d)*t*t*t));
  }
  for (const k of [0, 4]) {
    const norm = Math.hypot(...result.slice(k, k + 3));
    check(norm > 0 && result[k + 3] > 0, 'invalid interpolated row');
    for (let j = 0; j < 3; j++) result[k + j] /= norm;
  }
  return result;
}

export function decodeChunk(desc, payload) {
  check(desc.origin === 'moon_center' && desc.surface_frame === 'MOON_ME_DE421' &&
    desc.frame_epoch === 'observation_et', 'unsupported geometry');
  check(JSON.stringify(desc.profile_ids) === JSON.stringify(profiles), 'unsupported profiles');
  check(desc.layout === 'interleaved_float32' && desc.interpolation ===
    'uniform_catmull_rom_components_then_normalize', 'unsupported encoding/interpolation');
  const { count, t0_et_s: t0, step_s: step } = desc.grid;
  check(Number.isInteger(count) && count >= 6 && count <= 245 && Number.isFinite(t0) && step === 10800, 'invalid grid');
  check(desc.guard_samples_before === 2 && desc.guard_samples_after === 2 &&
    desc.usable_span.start_et_s === t0 + 2*step &&
    desc.usable_span.end_et_s === t0 + (count - 3)*step, 'incorrect guards');
  check(payload instanceof Uint8Array && payload.length === count * 64 && desc.decoded_bytes === payload.length, 'binary length');
  check(desc.arrays.length === 2, 'array count');
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const arrays = {};
  for (const [j, profile] of profiles.entries()) {
    const array = desc.arrays[j];
    check(array.name === profile + '-states' && array.dtype === 'float32' &&
      array.byte_offset === j*count*32 && JSON.stringify(array.shape) === JSON.stringify([count, 8]) &&
      array.unit === 'mixed_channels' && array.scale === 1 && array.offset === 0 && array.invalid_code === null, 'array metadata');
    const values = Array.from({ length: count*8 }, (_, i) => view.getFloat32(array.byte_offset + i*4, true));
    check(values.every(Number.isFinite), 'nonfinite storage');
    for (let row = 0; row < count; row++) {
      for (const k of [0, 4]) {
        const at = row*8+k;
        check(Math.abs(values.slice(at, at+3).reduce((s, v) => s+v*v, 0)-1) <= 1e-6 && values[at+3] > 0, 'invalid stored state');
      }
    }
    arrays[profile] = values;
  }
  return arrays;
}

export function utcToEt(time, utc) {
  check(time.method === 'segmented_linear_et_offset' && time.j2000_noon_unix_s === 946728000 &&
    time.positive_leaps.length === 0 && time.unsupported_intervals.length === 0, 'unsupported time profile');
  check(typeof utc === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(utc) && utc.slice(17,19) !== '60', 'unsupported UTC input');
  const base = utc.slice(0,19) + 'Z';
  const millis = Date.parse(base);
  check(Number.isFinite(millis) && new Date(millis).toISOString().slice(0,19) + 'Z' === base, 'invalid UTC calendar');
  const fraction = utc.length > 20 ? Number('0' + utc.slice(19,-1)) : 0;
  const unix = millis/1000 + fraction;
  for (const segment of time.segments) {
    if (segment.unix_start_s <= unix && unix < segment.unix_end_s) {
      for (let i = 0; i + 1 < segment.knots.length; i++) {
        const a = segment.knots[i], b = segment.knots[i+1];
        if (a.unix_s <= unix && unix < b.unix_s) {
          const e0 = a.unix_s - 946728000 + a.et_minus_unix_from_j2000_s;
          const e1 = b.unix_s - 946728000 + b.et_minus_unix_from_j2000_s;
          return e0 + (unix-a.unix_s)*(e1-e0)/(b.unix_s-a.unix_s);
        }
      }
    }
  }
  throw new Error('UTC outside coverage');
}

export async function loadPreview(readBytes) {
  const bytes = await readBytes('manifest.json');
  check(bytes.byteLength <= MAX_FILE, 'manifest cap');
  const manifest = JSON.parse(decoder.decode(bytes));
  check(manifest.format === 'ephemeris-preview-v1' && manifest.data_kind === 'computed' &&
    manifest.release_decision === 'numerical_preview_only' && manifest.accepted_scientific_scopes.length === 0 &&
    manifest.external_reference === 'not_run' && manifest.actual_browser === 'not_run', 'unsupported preview');
  check(manifest.chunks.length > 0 && manifest.chunks.length <= 256 && manifest.files.length <= 520, 'inventory cap');
  const entries = new Map();
  for (const entry of manifest.files) {
    safeHref(entry.href);
    check(!entries.has(entry.href) && Number.isInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= MAX_FILE &&
      /^[a-f0-9]{64}$/.test(entry.sha256), 'invalid file entry');
    entries.set(entry.href, entry);
  }
  async function resource(href) {
    safeHref(href);
    const entry = entries.get(href);
    check(entry, 'unindexed file');
    const payload = await readBytes(href);
    check(payload.byteLength === entry.bytes && await sha256(payload) === entry.sha256, 'file integrity mismatch');
    return payload;
  }
  // Only manifest + time are loaded at startup. Caller may cache individual chunks.
  const time = JSON.parse(decoder.decode(await resource('time.json')));
  async function chunk(index) {
    check(Number.isInteger(index) && index >= 0 && index < manifest.chunks.length, 'invalid chunk index');
    const entry = manifest.chunks[index];
    const desc = JSON.parse(decoder.decode(await resource(entry.descriptor)));
    return { descriptor: desc, arrays: decodeChunk(desc, await resource(entry.binary)) };
  }
  function sample(loaded, profile, et) {
    check(profiles.includes(profile), 'unsupported profile');
    check(Number.isFinite(et) && manifest.usable_span.start_et_s <= et && et < manifest.usable_span.end_et_s, 'ET outside release');
    return interpolate(loaded.descriptor, loaded.arrays[profile], et);
  }
  return { manifest, time, chunk, sample };
}