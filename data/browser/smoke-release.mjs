// End-to-end smoke verification for the unified release package
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadReleasePackage, safeHref } from './consumer.mjs';

assert.ok(process.argv[2], 'absolute release directory argument is required');
const root = path.resolve(process.argv[2]);
const readBytes = async href => new Uint8Array(await readFile(path.join(root, safeHref(href))));

console.log('Loading release package from:', root);
const release = await loadReleasePackage(readBytes);

console.log('Manifest loaded successfully:');
console.log('  Dataset ID:', release.manifest.dataset_id);
console.log('  Total indexed files:', release.manifest.files.length);
console.log('  Default scenario:', release.manifest.default_scenario_id);

assert.equal(release.manifest.dataset_id, 'lunar-horizon-release-v1');
assert.ok(release.entrypoints.model, 'model entrypoint missing');
assert.ok(release.entrypoints.sources, 'sources entrypoint missing');
assert.ok(release.entrypoints.sites, 'sites entrypoint missing');
assert.equal(release.entrypoints.sites.sites.length, 16, 'expected 16 curated sites');

console.log('Verified 16 curated sites in startup catalog.');

// Load default scenario
const defaultSc = await release.loadScenario(release.manifest.default_scenario_id);
assert.equal(defaultSc.scenario.scenario_id, release.manifest.default_scenario_id);
assert.ok(defaultSc.events.tracks, 'events missing tracks');
assert.ok(defaultSc.results.metrics, 'results missing metrics');
console.log('Loaded default scenario:', defaultSc.scenario.title);
console.log('  Outcome:', defaultSc.results.outcome);

// Load date-slip scenario
const slipSc = await release.loadScenario('scenario-shackleton-winter-date-slip');
assert.equal(slipSc.results.outcome, 'fails_selected_thresholds');
console.log('Loaded date slip scenario:', slipSc.scenario.title);
console.log('  Outcome:', slipSc.results.outcome);
console.log('  Violations:', slipSc.results.violated_thresholds);

console.log('All browser loading tests passed successfully!');
