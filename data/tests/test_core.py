"""Golden analytic cases and strict input rejection, not lunar science tests."""

import copy
import math
import struct
import unittest

from lunar_pipeline.core import (ValidationError, coordinates, disjoint_roots, enu_basis,
    estimate, json_bytes, number, safe_href, sampled_totals, strict_json, time_span,
    track_totals, utc_unix)
from lunar_pipeline.encoding import TimeConverter, decode_arrays, mask_values, validate_ephemeris
from lunar_pipeline.fixture import fixture_resources, load_profile


def resource(file_id):
    return next(item[-1] for item in fixture_resources("test-fixture") if item[0] == file_id)


class CoreTests(unittest.TestCase):
    def test_json_roundtrip(self):
        value = {"text": "Moon — example", "values": [None, 1, 2.5]}
        self.assertEqual(strict_json(json_bytes(value)), value)

    def test_bad_json(self):
        for value in (b'{"x":1,"x":2}', b'{"x":{"a":0,"a":1}}', b'{"x":NaN}',
                      b'{"x":Infinity}', b'{"x":1e999}', b'{"x":1,}', b'\xff', b'\xef\xbb\xbf{}'):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                strict_json(value)

    def test_non_numeric_values(self):
        for value in (True, False, None, "1", math.inf, -math.inf, math.nan):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                number(value)

    def test_safe_path(self):
        self.assertEqual(safe_href("ephemeris/fixture.bin"), "ephemeris/fixture.bin")

    def test_unsafe_paths(self):
        for path in ("../x", "/x", "a/../x", "a//x", "a/./x", "a/", "a\\x",
                     "https://x", "c:x", "%2e%2e/x", "x?y", "x#y", "con.json",
                     "a/nul", "a/lpt1.json", "a.", "raw/a.bin", "work/x", ".venv/x"):
            with self.subTest(path=path), self.assertRaises(ValidationError):
                safe_href(path)

    def test_storage_roots_must_be_disjoint(self):
        with self.assertRaises(ValidationError):
            disjoint_roots("C:/data", "C:/data/raw")
        with self.assertRaises(ValidationError):
            disjoint_roots("C:/data", "C:/data")
        self.assertEqual(len(disjoint_roots("C:/build", "C:/raw", "C:/publish")), 3)

    def test_coordinate_ranges(self):
        coordinates(0, -180)
        coordinates(90, 0, 0)
        coordinates(-90, 0, -180)
        for args in ((0, 180), (91, 0), (-91, 0), (90, 0), (0, 0, 0), (True, 0)):
            with self.subTest(args=args), self.assertRaises(ValidationError):
                coordinates(*args)

    def test_enu_golden_equator(self):
        self.assertEqual(enu_basis(0, 0), ((0.0, 1.0, 0.0), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0)))

    def test_enu_pole_meridian_and_orthogonality(self):
        tolerance = load_profile()["acceptance"]["coordinate_test_error"]
        east, north, up = enu_basis(90, 12, 90)
        for actual, expected in zip((east, north, up), ((-1, 0, 0), (0, -1, 0), (0, 0, 1))):
            for a, b in zip(actual, expected):
                self.assertLessEqual(abs(a - b), tolerance)
        for args in ((0, -180), (-89, 179), (45, 60), (-90, 0, 42)):
            basis = enu_basis(*args)
            for i in range(3):
                for j in range(3):
                    self.assertLessEqual(abs(sum(a * b for a, b in zip(basis[i], basis[j])) - (i == j)), tolerance)

    def test_valid_utc_calendar(self):
        self.assertEqual(utc_unix("2000-01-01T12:00:00Z"), 946728000)
        self.assertEqual(utc_unix("2000-02-29T00:00:00Z"), 951782400)

    def test_bad_utc(self):
        for value in ("2001-02-29T00:00:00Z", "2000-01-01T24:00:00Z", "2000-13-01T00:00:00Z",
                      "2000-01-01T00:00:00+06:00", "2016-12-31T23:59:60Z", "2000-01-01"):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                utc_unix(value)

    def test_spans_reject_empty_and_boolean(self):
        for span in (dict(start_et_s=0, end_et_s=0), dict(start_et_s=2, end_et_s=1),
                     dict(start_et_s=False, end_et_s=10)):
            with self.subTest(span=span), self.assertRaises(ValidationError):
                time_span(span)

    def test_estimate_unknown_and_bounds(self):
        value = resource("results")["metrics"][0]["estimate"]
        estimate(value)
        for changes in (dict(lower=0.9, upper=0.1), dict(lower=None), dict(value=True),
                        dict(value=1), dict(basis="unavailable"), dict(quality_flags=[])):
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                estimate(value | changes)

    def test_sample_last_endpoint_adds_no_time(self):
        totals = sampled_totals([0, 150, 300, 450, 600], ["clear", "blocked", "uncertain", "unknown", "clear"])
        self.assertEqual(totals, dict(clear=150, blocked=150, uncertain=150, unknown=150))

    def test_track_rejects_gap_overlap_and_missing_end(self):
        original = resource("events")["tracks"][0]["intervals"]
        for start, end in ((151, 300), (149, 300), (150, 150)):
            intervals = copy.deepcopy(original)
            intervals[1].update(start_et_s=start, end_et_s=end)
            with self.subTest(start=start, end=end), self.assertRaises(ValidationError):
                track_totals(intervals, dict(start_et_s=0, end_et_s=600))
        with self.assertRaises(ValidationError):
            track_totals(original[:-1], dict(start_et_s=0, end_et_s=600))

    def test_sample_invalid_state_and_time(self):
        for times, states in (([0, 1], ["clear"]), ([0, 0], ["clear", "clear"]),
                              ([0, 1], ["clear", "bad"]), ([True, 2], ["clear", "clear"])):
            with self.subTest(times=times, states=states), self.assertRaises(ValidationError):
                sampled_totals(times, states)


class EncodingTests(unittest.TestCase):
    def test_ephemeris_binary_golden(self):
        decoded = validate_ephemeris(resource("ephemeris"), resource("ephemeris-binary"))
        self.assertEqual(decoded["fixture-geometric-states"], [1, 0, 0, 150000000, 0, 1, 0, 384000] * 9)

    def test_ephemeris_guards_and_units(self):
        for changes in (dict(guard_samples_before=1), dict(channel_units=["km"] * 8),
                        dict(layout="separate_channels"), dict(profile_ids=[])):
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                validate_ephemeris(resource("ephemeris") | changes, resource("ephemeris-binary"))

    def test_nonfinite_float_storage_rejected(self):
        for value in (math.nan, math.inf):
            payload = bytearray(resource("ephemeris-binary"))
            struct.pack_into("<f", payload, 0, value)
            with self.subTest(value=value), self.assertRaises(ValidationError):
                decode_arrays(resource("ephemeris"), payload)

    def test_wrong_endian_or_negative_range_rejected(self):
        values = [1, 0, 0, 150000000, 0, 1, 0, 384000] * 9
        for payload in (struct.pack(">72f", *values), struct.pack("<72f", *(values[:3] + [-1] + values[4:]))):
            with self.assertRaises(ValidationError):
                validate_ephemeris(resource("ephemeris"), payload)

    def test_array_offsets_shapes_overlap_and_truncation(self):
        for changes in (dict(byte_offset=1), dict(shape=[10, 8]), dict(shape=[True]),
                        dict(scale=0), dict(invalid_code=0), dict(dtype="float16")):
            descriptor = resource("ephemeris")
            descriptor["arrays"][0].update(changes)
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                decode_arrays(descriptor, resource("ephemeris-binary"))
        descriptor = resource("ephemeris")
        descriptor["arrays"].append(descriptor["arrays"][0] | dict(name="overlap"))
        with self.assertRaises(ValidationError):
            decode_arrays(descriptor, resource("ephemeris-binary"))
        with self.assertRaises(ValidationError):
            decode_arrays(resource("ephemeris"), resource("ephemeris-binary")[:-1])

    def test_integer_quantization_and_padding(self):
        array = dict(name="height", dtype="int16", shape=[3], byte_offset=2, unit="m", scale=0.5, offset=10, invalid_code=-32768)
        descriptor = dict(arrays=[array], decoded_bytes=8)
        payload = b"\0\0" + struct.pack("<3h", -2, 4, -32768)
        self.assertEqual(decode_arrays(descriptor, payload)["height"], [9, 12, None])
        with self.assertRaises(ValidationError):
            decode_arrays(descriptor, b"\1" + payload[1:])

    def test_float_mask_and_zero_invalid_slot(self):
        self.assertEqual(mask_values([1.5, 0], [1, 0]), [1.5, None])
        for values, mask in (([1.5, 2], [1, 0]), ([1], [2]), ([1], []), ([1], [True]), ([math.nan], [1])):
            with self.subTest(values=values, mask=mask), self.assertRaises(ValidationError):
                mask_values(values, mask)

    def test_time_golden_roundtrip_and_half_open_coverage(self):
        converter = TimeConverter(resource("time"))
        tolerance = load_profile()["acceptance"]["time_roundtrip_error_s"]
        for et in (-300, -0.125, 0, 150, 600, 1199.75):
            self.assertLessEqual(abs(converter.to_et(converter.to_utc(et)) - et), tolerance)
        self.assertEqual(converter.to_et("2000-01-01T12:10:00Z"), 600)
        for et in (-301, 1200):
            with self.assertRaises(ValueError):
                converter.to_utc(et)
        with self.assertRaises(ValueError):
            converter.to_et("2000-01-01T12:20:00Z")

    def test_time_nonmonotonic_or_missing_endpoint(self):
        for offset in (-1500, -1600):
            value = resource("time")
            value["segments"][0]["knots"][1]["et_minus_unix_from_j2000_s"] = offset
            with self.subTest(offset=offset), self.assertRaises(ValidationError):
                TimeConverter(value)
        value = resource("time")
        value["segments"][0]["knots"][0]["unix_s"] += 1
        with self.assertRaises(ValidationError):
            TimeConverter(value)

    def test_affine_offset_inversion(self):
        value = resource("time")
        value["segments"][0]["knots"][1]["et_minus_unix_from_j2000_s"] = 1.5
        converter = TimeConverter(value)
        self.assertAlmostEqual(converter.to_et("2000-01-01T12:00:00Z"), 0.3, places=10)
        self.assertEqual(converter.to_utc(0.3), "2000-01-01T12:00:00.000000Z")

    def test_positive_leap_output_and_input_rejection(self):
        value = resource("time")
        boundary = utc_unix("2017-01-01T00:00:00Z")
        def segment(start, end, offset):
            return dict(utc_start=start, utc_end=end, unix_start_s=utc_unix(start), unix_end_s=utc_unix(end),
                        knots=[dict(unix_s=utc_unix(t), et_minus_unix_from_j2000_s=offset) for t in (start, end)])
        value["segments"] = [segment("2016-12-31T23:59:59Z", "2017-01-01T00:00:00Z", 0),
                             segment("2017-01-01T00:00:00Z", "2017-01-01T00:00:02Z", 1)]
        leap_et = boundary - 946728000
        value["positive_leaps"] = [dict(utc_day="2016-12-31", et_start_s=leap_et, duration_s=1)]
        converter = TimeConverter(value)
        self.assertEqual(converter.to_utc(leap_et), "2016-12-31T23:59:60Z")
        self.assertEqual(converter.to_utc(leap_et + 0.25), "2016-12-31T23:59:60.250000Z")
        self.assertEqual(converter.to_utc(leap_et + 1), "2017-01-01T00:00:00.000000Z")
        self.assertEqual(converter.to_et("2017-01-01T00:00:00Z") - converter.to_et("2016-12-31T23:59:59Z"), 2)
        with self.assertRaises(ValidationError):
            converter.to_et("2016-12-31T23:59:60Z")
        value["positive_leaps"][0]["et_start_s"] -= 0.5
        with self.assertRaises(ValidationError):
            TimeConverter(value)