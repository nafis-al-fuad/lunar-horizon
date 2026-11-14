"""Analytic and rejection tests; temporary synthetic previews are NOT science evidence."""

import math
import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from lunar_pipeline.core import ValidationError, digest, json_bytes, strict_json, utc_unix
from lunar_pipeline.encoding import TimeConverter, validate_ephemeris
from lunar_pipeline.ephemeris import (PROFILES, SOURCE_LOCK, check_coverage, chunk_descriptors, descriptor,
                                      load_config, time_payload)
from lunar_pipeline.ephemeris_math import angular_error, catmull_rom, interpolate
from lunar_pipeline.ephemeris_release import (make_manifest, package_preview, preview_identity,
                                             validate_preview, write_resource)


class MathTests(unittest.TestCase):
    def test_chunk_plan_full_and_partial_cells(self):
        config = load_config()
        step = config['step_s']
        start = 820497669.184
        for cells, padding in ((480, 0), (481, 0), (480.25, step*0.75)):
            end = start+cells*step
            chunks = chunk_descriptors(config, start, end)
            self.assertEqual(len(chunks), math.ceil(cells/240))
            self.assertEqual(chunks[-1]['grid']['count']-5, math.ceil(cells)-240*(len(chunks)-1))
            self.assertAlmostEqual(chunks[-1]['usable_span']['end_et_s']-end, padding)
            for a, b in zip(chunks, chunks[1:]):
                self.assertEqual(a['usable_span']['end_et_s'], b['usable_span']['start_et_s'])
                self.assertEqual(a['grid']['t0_et_s']+(a['grid']['count']-5)*step, b['grid']['t0_et_s'])
        for intervals in (0, 241, True):
            with self.assertRaises(ValidationError):
                descriptor(config, 'chunk-0000', start, intervals)
        with self.assertRaises(ValidationError):
            chunk_descriptors(config, start, start)

    def test_linear_cubic_and_knots(self):
        self.assertEqual(catmull_rom(0, 1, 2, 3, 0.25), 1.25)
        self.assertEqual(catmull_rom(3, 8, 9, 15, 0), 8)
        self.assertEqual(catmull_rom(3, 8, 9, 15, 1), 9)
        for t in (-1, 2, math.nan, True):
            with self.assertRaises(ValidationError):
                catmull_rom(0, 1, 2, 3, t)

    def test_angular_residual(self):
        self.assertEqual(angular_error([1, 0, 0], [0, 2, 0]), 90)
        self.assertEqual(angular_error([1, 0, 0], [-1, 0, 0]), 180)
        self.assertAlmostEqual(angular_error([1, 0, 0], [1, 1e-12, 0]), math.degrees(1e-12))
        for a in ([0, 0, 0], [math.nan, 1, 0], [1, 2]):
            with self.assertRaises(ValidationError):
                angular_error(a, [1, 0, 0])

    def test_constant_interpolation_and_rejection(self):
        desc = descriptor(load_config(), "chunk-0000", 0., 4)
        row = [1., 0., 0., 150000000., 0., 1., 0., 384000.]
        values = row*9
        for t in (0, 1350, 30000, math.nextafter(43200., 0)):
            self.assertEqual(interpolate(desc, values, t), row)
        for t in (-1, 43200, math.inf, True):
            with self.assertRaises(ValidationError):
                interpolate(desc, values, t)
        with self.assertRaises(ValidationError):
            interpolate(desc, values[:-1], 0)

    def test_binary_two_profiles(self):
        desc = descriptor(load_config(), "chunk-0000", 0., 4)
        row = [1., 0., 0., 150000000., 0., 1., 0., 384000.]
        payload = struct.pack('<'+'f'*144, *(row*18))
        arrays = validate_ephemeris(desc, payload)
        self.assertEqual(arrays['geometric-states'], arrays['apparent-states'])
        self.assertEqual(len(arrays['apparent-states']), 72)

    def test_missing_and_short_coverage(self):
        with self.assertRaises(ValidationError):
            check_coverage([], 0, 1)
        evidence = [dict(specification=dict(id='moon-pa-de421'), coverage_et_s={'31006': [-1e6, 1e6]}),
                    dict(specification=dict(id='de440s'), coverage_et_s={k: [-1e6, 1e6] for k in ('3', '10', '301', '399')})]
        check_coverage(evidence, 0, 1)
        evidence[1]['coverage_et_s']['399'] = [0, 1]
        with self.assertRaises(ValidationError):
            check_coverage(evidence, 0, 1)

    def test_time_refinement_and_new_leap_rejection(self):
        class AnalyticClock:
            def gdpool(self, *args):
                return [37., 536500800.]

            def str2et(self, utc):
                unix = utc_unix(utc)
                return unix-946728000+69.184+0.001*math.sin((unix-1767225600)/86400)

        config = load_config()
        config['end_utc'] = '2026-01-08T00:00:00Z'
        times, result = time_payload(AnalyticClock(), config)
        self.assertGreater(len(times['segments'][0]['knots']), 2)
        self.assertLessEqual(result['max_forward_error_s'], config['acceptance']['time_error_s'])
        converter = TimeConverter(times)
        with self.assertRaises(ValueError):
            converter.to_et(config['end_utc'])
        clock = AnalyticClock()
        clock.gdpool = lambda *args: [38., 1e10]
        with self.assertRaises(ValidationError):
            time_payload(clock, config)


class PreviewTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.release = self.root/'build'
        self.release.mkdir()
        self.config = load_config()
        self.config['end_utc'] = '2026-01-02T00:00:00Z'
        self.config['chunk_intervals'] = 4
        start = utc_unix(self.config['start_utc'])-946728000+69.
        end = start+86400
        self.start, self.end = start, end
        patcher = patch('lunar_pipeline.ephemeris_release.load_config', return_value=self.config)
        patcher.start()
        self.addCleanup(patcher.stop)
        knots = [dict(unix_s=utc_unix(self.config[k]), et_minus_unix_from_j2000_s=69.) for k in ('start_utc', 'end_utc')]
        time = dict(method='segmented_linear_et_offset', lsk_source_id='naif0012', unix_origin_utc='1970-01-01T00:00:00Z',
                    j2000_noon_unix_s=946728000, future_leap_second_assumption='Synthetic test only', max_measured_error_s=0.,
                    positive_leaps=[], unsupported_intervals=[], segments=[dict(utc_start=self.config['start_utc'],
                    utc_end=self.config['end_utc'], unix_start_s=knots[0]['unix_s'], unix_end_s=knots[1]['unix_s'], knots=knots)])
        evidence = []
        for spec in strict_json(SOURCE_LOCK.read_bytes())['sources']:
            item = dict(specification=spec, acquisition=dict(sha256=spec['sha256'], bytes=spec['bytes'], note='Fabricated test-only receipt'))
            if spec['id'] in ('moon-pa-de421', 'de440s'):
                keys = ['31006'] if spec['id'] == 'moon-pa-de421' else ['3', '10', '301', '399']
                item['coverage_et_s'] = {k: [-1e10, 1e10] for k in keys}
            evidence.append(item)
        files = [write_resource(self.release, 'time.json', json_bytes(time)),
                 write_resource(self.release, 'sources.json', json_bytes(dict(evidence=evidence, kernel_load_order=[s['specification']['id'] for s in evidence])))]
        chunks, checks = [], []
        for i in range(2):
            desc = descriptor(self.config, f'chunk-{i:04d}', start+i*43200, 4)
            row = [1., 0., 0., 150000000., 0., 1., 0., 384000.]
            payload = struct.pack('<'+'f'*144, *(row*18))
            href = 'ephemeris/'+desc['chunk_id']
            files.extend([write_resource(self.release, href+'.json', json_bytes(desc)), write_resource(self.release, href+'.bin', payload)])
            chunks.append(dict(descriptor=href+'.json', binary=href+'.bin'))
            checks.append(dict(chunk_id=desc['chunk_id'], status='passed', epochs=13,
                residuals={p: {t: dict(float64_angular_deg=0., encoded_angular_deg=0., range_error_km=0.) for t in ('SUN', 'EARTH')} for p in PROFILES}))
        validation = dict(status='passed', external_reference='not_run', actual_browser='not_run', chunks=checks,
            time=dict(status='passed', samples=1, max_forward_error_s=0., max_inverse_error_s=0.),
            observer=dict(status='passed', comparisons=1, angular_errors_deg={p: dict(SUN=0., EARTH=0.) for p in PROFILES}))
        files.append(write_resource(self.release, 'validation.json', json_bytes(validation)))
        self.manifest = make_manifest(dict(revision='synthetic-test-only'), self.config, dict(start_et_s=start, end_et_s=end), chunks, files)
        self.save()

    def save(self):
        self.manifest['dataset_id'] = preview_identity(self.manifest)
        (self.release/'manifest.json').write_bytes(json_bytes(self.manifest))

    def mutate(self, href, mutate):
        path = self.release/href
        value = strict_json(path.read_bytes())
        mutate(value)
        payload = json_bytes(value)
        path.write_bytes(payload)
        entry = next(e for e in self.manifest['files'] if e['href'] == href)
        entry.update(bytes=len(payload), sha256=digest(payload))
        self.save()

    def test_package_and_repeat(self):
        self.assertEqual(validate_preview(self.release)['chunks'], 2)
        destination = package_preview(self.release, self.root/'publish', self.root/'raw')
        self.assertEqual(validate_preview(destination), validate_preview(self.release))
        self.assertEqual(package_preview(self.release, self.root/'publish', self.root/'raw'), destination)
        self.assertFalse((self.root/'raw').exists())

    def test_corrupt_package_not_overwritten(self):
        destination = package_preview(self.release, self.root/'publish', self.root/'raw')
        path = destination/'ephemeris/chunk-0000.bin'
        path.write_bytes(b'corrupted')
        with self.assertRaises(ValidationError):
            package_preview(self.release, self.root/'publish', self.root/'raw')
        self.assertEqual(path.read_bytes(), b'corrupted')

    def test_overlapping_roots(self):
        with self.assertRaises(ValidationError):
            package_preview(self.release, self.release/'publish', self.root/'raw')

    def test_noncanonical_manifest(self):
        path = self.release/'manifest.json'
        path.write_bytes(path.read_bytes()+b'\n')
        with self.assertRaises(ValidationError):
            validate_preview(self.release)

    def test_missing_observer_target(self):
        self.mutate('validation.json', lambda v: v['observer']['angular_errors_deg']['apparent'].pop('EARTH'))
        with self.assertRaises(ValidationError):
            validate_preview(self.release)

    def test_unsupported_chunk_layout(self):
        self.mutate('ephemeris/chunk-0000.json', lambda v: v['arrays'][0].update(invalid_code=0))
        with self.assertRaises(ValidationError):
            validate_preview(self.release)

    def test_identity_rejects_changes(self):
        self.manifest['generator']['revision'] = 'changed'
        (self.release/'manifest.json').write_bytes(json_bytes(self.manifest))
        with self.assertRaises(ValidationError):
            validate_preview(self.release)

    def test_false_science_acceptance(self):
        self.manifest['accepted_scientific_scopes'] = ['landing-safe']
        self.save()
        with self.assertRaises(ValidationError):
            validate_preview(self.release)

    def test_hash_mismatch(self):
        path = self.release/'ephemeris/chunk-0000.bin'
        path.write_bytes(b'x'+path.read_bytes()[1:])
        with self.assertRaises(ValidationError):
            validate_preview(self.release)

    def test_unlisted_raw_file(self):
        (self.release/'unapproved.bsp').write_bytes(b'raw')
        with self.assertRaises(ValidationError):
            validate_preview(self.release)

    def test_out_of_budget_time(self):
        self.mutate('validation.json', lambda v: v['time'].update(max_inverse_error_s=1))
        with self.assertRaises(ValidationError):
            validate_preview(self.release)

    def test_out_of_budget_observer(self):
        self.mutate('validation.json', lambda v: v['observer']['angular_errors_deg']['apparent'].update(EARTH=1))
        with self.assertRaises(ValidationError):
            validate_preview(self.release)

    def test_bad_source(self):
        self.mutate('sources.json', lambda v: v['evidence'][0]['specification'].update(sha256='0'*64))
        with self.assertRaises(ValidationError):
            validate_preview(self.release)

    def test_gap(self):
        self.mutate('ephemeris/chunk-0001.json', lambda v: v['usable_span'].update(start_et_s=self.start))
        with self.assertRaises(ValidationError):
            validate_preview(self.release)

    def test_seam_mismatch_after_rehash(self):
        path = self.release/'ephemeris/chunk-0001.bin'
        payload = bytearray(path.read_bytes())
        struct.pack_into('<f', payload, 12, 140000000.)
        path.write_bytes(payload)
        entry = next(e for e in self.manifest['files'] if e['href'] == 'ephemeris/chunk-0001.bin')
        entry['sha256'] = digest(payload)
        self.save()
        with self.assertRaises(ValidationError):
            validate_preview(self.release)

    def test_unsafe_href(self):
        self.manifest['files'][0]['href'] = '../outside'
        self.save()
        with self.assertRaises(ValidationError):
            validate_preview(self.release)