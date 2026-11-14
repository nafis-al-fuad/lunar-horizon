// Run under Node; consumer.mjs itself uses browser APIs. No browser/device claim.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { decodeEphemeris, decodeFile, loadFixture, safeHref, trackTotals } from './consumer.mjs';

assert.ok(process.argv[2], 'absolute release directory argument is required');
const root = path.resolve(process.argv[2]);
const readBytes = async href => new Uint8Array(await readFile(path.join(root, safeHref(href))));
const result = await loadFixture(readBytes);
assert.equal(result.indexed_files, 11);
assert.deepEqual(result.decoded_values, Array.from({ length: 9 }, () => [1, 0, 0, 150000000, 0, 1, 0, 384000]).flat());
assert.deepEqual(result.track_totals, { clear: 150, blocked: 150, uncertain: 150, unknown: 150 });
let negativeCases = 0;
for (const href of ['../x', '%2e%2e/x', '/x', 'a\\x', 'a//x', 'a/./x', 'con.json', 'raw/x', 'x?y', 'https://x']) {
  assert.throws(() => safeHref(href)); negativeCases++;
}
await assert.rejects(loadFixture(async href => {
  if (href === 'ephemeris/fixture.bin') throw new Error('simulated missing file');
  return readBytes(href);
})); negativeCases++;
await assert.rejects(loadFixture(async href => {
  const bytes = await readBytes(href);
  if (href === 'ephemeris/fixture.bin') bytes[10] ^= 1;
  return bytes;
})); negativeCases++;
const manifest = JSON.parse(new TextDecoder().decode(await readBytes('manifest.json')));
const binaryEntry = manifest.files.find(e => e.id === 'ephemeris-binary');
const stored = await readBytes(binaryEntry.href);
await assert.rejects(decodeFile({ ...binaryEntry, decoded_bytes: 1 }, stored)); negativeCases++;
await assert.rejects(decodeFile({ ...binaryEntry, storage_encoding: 'unknown' }, stored)); negativeCases++;
const bytes = await decodeFile(binaryEntry, stored);
const descriptor = JSON.parse(new TextDecoder().decode(await readBytes('ephemeris/fixture.json')));
assert.throws(() => decodeEphemeris(descriptor, bytes.slice(1))); negativeCases++;
const badFloat = bytes.slice();
new DataView(badFloat.buffer).setFloat32(0, NaN, true);
assert.throws(() => decodeEphemeris(descriptor, badFloat)); negativeCases++;
assert.throws(() => trackTotals([{ start_et_s: 1, end_et_s: 2, state: 'clear' }], { start_et_s: 0, end_et_s: 2 })); negativeCases++;
const cyclic = structuredClone(manifest);
cyclic.files[0].depends_on.push(cyclic.files[0].id);
await assert.rejects(loadFixture(async href => href === 'manifest.json'
  ? new TextEncoder().encode(JSON.stringify(cyclic)) : readBytes(href))); negativeCases++;
console.log(JSON.stringify({ ...result, javascript_runtime: process.version,
  negative_cases_passed: negativeCases, status: 'passed', scope: 'Node fixture decode/parity smoke; not an actual browser benchmark' }, null, 2));