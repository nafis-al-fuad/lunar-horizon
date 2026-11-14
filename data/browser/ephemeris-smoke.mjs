// Node parity/integrity tests, not an actual-browser or external-reference check.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { decodeChunk, interpolate, loadPreview, utcToEt } from './ephemeris.mjs';

const [root, parityPath] = process.argv.slice(2);
assert(root && parityPath, 'release and parity paths required');
const read = async href => new Uint8Array(await readFile(path.join(root, ...href.split('/'))));
let reads = 0;
const preview = await loadPreview(async href => { reads++; return read(href); });
assert.equal(reads, 2, 'startup must not eagerly load ephemerides');
const parity = JSON.parse(await readFile(parityPath, 'utf8'));
let comparisons = 0, maxError = 0, rejections = 0;
let previous = null;
for (let i = 0; i < preview.manifest.chunks.length; i++) {
  const loaded = await preview.chunk(i);
  for (const item of parity.filter(v => v.chunk === i)) {
    const row = preview.sample(loaded, item.profile, item.et_s);
    for (let j = 0; j < row.length; j++) {
      const error = Math.abs(row[j] - item.expected[j]);
      // Range arithmetic may differ by a few Float64 ulps across languages.
      assert(error <= (j === 3 || j === 7 ? 1e-6 : 1e-12), 'Python/JS interpolation mismatch');
      maxError = Math.max(maxError, error);
      comparisons++;
    }
  }
  if (previous) {
    for (const p of ['geometric', 'apparent']) assert.deepEqual(previous.arrays[p].slice(-40), loaded.arrays[p].slice(0,40));
  }
  previous = loaded;
}
const first = await preview.chunk(0);
for (const et of [NaN, Infinity, preview.manifest.usable_span.start_et_s-1]) {
  assert.throws(() => preview.sample(first, 'geometric', et)); rejections++;
}
const endpoint = preview.manifest.usable_span.end_et_s;
assert(previous.descriptor.usable_span.end_et_s > endpoint, 'endpoint isolation fixture');
assert(interpolate(previous.descriptor, previous.arrays.geometric, endpoint).every(Number.isFinite),
  'chunk-local interpolation must permit the padded endpoint control');
assert.throws(() => preview.sample(previous, 'geometric', endpoint), /ET outside release/); rejections++;
assert.throws(() => preview.sample(first, 'unknown', preview.manifest.usable_span.start_et_s)); rejections++;
for (const utc of ['2026-02-30T00:00:00Z', '2026-01-01T23:59:60Z', '2026-01-01T00:00:00+00:00', '2036-01-01T00:00:00Z']) {
  assert.throws(() => utcToEt(preview.time, utc)); rejections++;
}
assert.equal(utcToEt(preview.time, '2026-01-01T00:00:00Z'), preview.manifest.usable_span.start_et_s);
for (const segment of preview.time.segments) {
  for (const knot of segment.knots.slice(0,-1)) {
    const utc = new Date(knot.unix_s * 1000).toISOString();
    assert(Math.abs(utcToEt(preview.time, utc) - (knot.unix_s-946728000+knot.et_minus_unix_from_j2000_s)) <= 1e-7);
  }
}
const binaryHref = preview.manifest.chunks[0].binary;
const payload = await read(binaryHref);
assert.throws(() => decodeChunk(first.descriptor, payload.slice(1))); rejections++;
const corrupt = await loadPreview(async href => {
  const data = await read(href);
  if (href === binaryHref) data[0] ^= 1;
  return data;
});
await assert.rejects(corrupt.chunk(0)); rejections++;
await assert.rejects(preview.chunk(-1)); rejections++;
console.log(JSON.stringify({status: 'passed', chunks: preview.manifest.chunks.length, comparisons,
  max_absolute_parity_error: maxError, rejection_cases: rejections, actual_browser: 'not_run'}));