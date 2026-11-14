"""Synthetic reference/cache regressions; no service calls or scientific acceptance."""

import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import URLError

from lunar_pipeline.component_validation import et_to_jd
from lunar_pipeline.core import ValidationError, digest, json_bytes, strict_json
from lunar_pipeline.horizons import acquire, bounded_read, compare, parse_response, replay, request_spec
from lunar_pipeline.reference_validation import CACHE_FILES, matrix_summary, run_matrix, snapshot_case
from test_component_validation import synthetic_response


class SyntheticSpice:
    @staticmethod
    def spkpos(*args):
        return [1., 0., 0.], 0.


def write_case(root, target="SUN", correction="NONE", model="DE440"):
    spec = request_spec(target, correction, [et_to_jd(0)])
    raw = synthetic_response(correction, model)
    if target == "EARTH":
        raw = raw.replace(b"Sun (10)", b"Earth (399)")
    root.mkdir(parents=True)
    (root/"request.json").write_bytes(json_bytes(spec))
    (root/"response.json").write_bytes(raw)
    (root/"receipt.json").write_bytes(json_bytes(dict(request_sha256=digest(json_bytes(spec)),
        response_sha256=digest(raw), bytes=len(raw), status=200, final_url=spec["url"], truncated=False)))
    return spec


def tree_bytes(root):
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob("*") if p.is_file()}


class StrictReferenceTests(unittest.TestCase):
    def setUp(self):
        self.spec = request_spec("SUN", "NONE", [et_to_jd(0)])

    def test_epochs_reject_wrong_types_duplicates_and_order(self):
        for epochs in (None, (), [], [1], [True], [et_to_jd(0)]*2,
                       [et_to_jd(1), et_to_jd(0)], ["2451545.0"]):
            with self.subTest(epochs=epochs), self.assertRaises(ValidationError):
                request_spec("SUN", "NONE", epochs)

    def test_noncanonical_request_rejected_before_io(self):
        for field, replacement in (("url", "https://example.invalid/"), ("target", "EARTH"),
                                   ("parameters", {}), ("extra", True)):
            spec = copy.deepcopy(self.spec)
            spec[field] = replacement
            with tempfile.TemporaryDirectory() as temp, patch("lunar_pipeline.horizons.urlopen") as network:
                root = Path(temp)/"cache"
                with self.assertRaises(ValidationError):
                    acquire(root, spec)
                network.assert_not_called()
                self.assertFalse(root.exists())
                with self.assertRaises(ValidationError):
                    parse_response(synthetic_response(), spec)

    def test_conventions_reject_suffixes_and_duplicate_headers(self):
        original = strict_json(synthetic_response())
        for label in ("Target body name", "Center body name", "Center-site name", "Reference frame",
                      "Output units", "Output type", "Output format"):
            line = next(v for v in original["result"].splitlines() if v.startswith(label))
            for replacement in (line+" extra", line+"\n"+line):
                payload = copy.deepcopy(original)
                payload["result"] = payload["result"].replace(line, replacement)
                with self.subTest(label=label, replacement=replacement), self.assertRaises(ValidationError):
                    parse_response(json_bytes(payload), self.spec)

    def test_model_tags_must_belong_to_target_and_center(self):
        original = strict_json(synthetic_response())
        for label in ("Target body name", "Center body name"):
            line = next(v for v in original["result"].splitlines() if v.startswith(label))
            payload = copy.deepcopy(original)
            payload["result"] = payload["result"].replace(line, line.replace(" {source: DE440}", ""))
            payload["result"] = "Unrelated {source: DE440}\n" + payload["result"]
            with self.subTest(label=label), self.assertRaises(ValidationError):
                parse_response(json_bytes(payload), self.spec)

    def test_mixed_models_and_unknown_model_remain_unmatched(self):
        for model in ("DE441", "unknown"):
            raw = synthetic_response().replace(b"Moon (301) {source: DE440}",
                ("Moon (301) {source: "+model+"}").encode())
            result = compare(parse_response(raw, self.spec), self.spec, SyntheticSpice())
            self.assertEqual(result["reference_models"], ["DE440", model])
            self.assertEqual(result["status"], "model_mismatch")
            self.assertFalse(result["model_matched"])
            self.assertTrue(result["diagnostic_within_budgets"])

    def test_columns_and_numeric_fields_fail_closed(self):
        original = synthetic_response()
        for old, new in ((b"X, Y, Z,", b"Y, X, Z,"),
                         (b"JDTDB, Calendar Date (TDB)", b"JDUTC, Calendar Date (TDB)"),
                         (b"2451545.000000000000000", b"NaN"),
                         (b"1.0, 0.0, 0.0,", b"invalid, 0.0, 0.0,")):
            with self.subTest(new=new), self.assertRaises(ValidationError):
                parse_response(original.replace(old, new), self.spec)

    def test_crlf_service_response_supported(self):
        payload = strict_json(synthetic_response())
        payload["result"] = payload["result"].replace("\n", "\r\n")
        self.assertEqual(parse_response(json_bytes(payload), self.spec)["models"], ["DE440", "DE440"])

    def test_malformed_payload_and_signature_fail_closed(self):
        for payload in ([], None, {}, {"result": "text", "signature": []}):
            with self.subTest(payload=payload), self.assertRaises(ValidationError):
                parse_response(json_bytes(payload), self.spec)

    def test_simultaneous_model_and_correction_blockers_are_preserved(self):
        spec = request_spec("SUN", "LT+S", [et_to_jd(0)])
        parsed = parse_response(synthetic_response("LT+S", "DE441"), spec)
        result = compare(parsed, spec, SyntheticSpice())
        self.assertEqual(result["status"], "model_mismatch")
        self.assertEqual(result["acceptance_blockers"],
            ["dynamical_model_mismatch", "correction_semantics_unmatched"])
        self.assertEqual(result["service_footer"], parsed["footer"])

    def test_matched_geometric_residual_failure_stays_failed(self):
        spice = SyntheticSpice()
        spice.spkpos = lambda *args: ([0., 1., 0.], 0.)
        result = compare(parse_response(synthetic_response(), self.spec), self.spec, spice)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["maxima"]["angular_deg"], 90.)

    def test_receipt_errors_and_size_caps(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)/"cache"
            write_case(root)
            receipt = strict_json((root/"receipt.json").read_bytes())
            for changed in ([], {}, receipt | {"truncated": True}, receipt | {"status": 503},
                            receipt | {"final_url": "http://example.invalid/"}, receipt | {"bytes": 1}):
                (root/"receipt.json").write_bytes(json_bytes(changed))
                with self.subTest(changed=changed), self.assertRaises(ValidationError):
                    replay(root, self.spec)
            (root/"receipt.json").write_bytes(json_bytes(receipt))
            with patch("lunar_pipeline.horizons.MAX_RESPONSE", 10), self.assertRaises(ValidationError):
                replay(root, self.spec)
            for data in (b"", b"12345"):
                (root/"bounded").write_bytes(data)
                with self.assertRaises(ValidationError):
                    bounded_read(root/"bounded", 4)


class MatrixTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.cache = self.root/"input"
        self.cache.mkdir()
        self.output = self.root/"output"
        self.output.mkdir()
        self.epochs = [et_to_jd(0)]

    def run_matrix(self, acquire_missing=False):
        return run_matrix(self.output, self.epochs, SyntheticSpice(), self.cache, acquire_missing)

    def populate(self):
        for target in ("SUN", "EARTH"):
            for correction, profile in (("NONE", "geometric"), ("LT+S", "apparent")):
                write_case(self.cache/(target.lower()+"-"+profile), target, correction)

    def test_snapshot_exact_bytes_and_never_overwrites(self):
        source = self.cache/"sun-geometric"
        spec = write_case(source)
        (source/"unrelated.txt").write_text("not copied", encoding="utf-8")
        before = tree_bytes(source)
        destination = self.output/"snapshot"
        self.assertTrue(snapshot_case(source, destination, spec))
        self.assertEqual(set(tree_bytes(destination)), set(CACHE_FILES))
        self.assertEqual(tree_bytes(source), before)
        for name in CACHE_FILES:
            self.assertEqual((destination/name).read_bytes(), before[name])
        with self.assertRaises(FileExistsError):
            snapshot_case(source, destination, spec)

    def test_snapshot_missing_and_documented_failed_acquisition(self):
        source = self.cache/"sun-geometric"
        spec = request_spec("SUN", "NONE", self.epochs)
        destination = self.output/"snapshot"
        self.assertFalse(snapshot_case(source, destination, spec))
        source.mkdir()
        (source/"request.json").write_bytes(json_bytes(spec))
        with self.assertRaises(FileNotFoundError):
            snapshot_case(source, destination, spec)
        (source/"acquisition-error.json").write_bytes(json_bytes(dict(status="failed", error="timeout")))
        self.assertFalse(snapshot_case(source, destination, spec))
        self.assertFalse(destination.exists())
        (source/"request.json").write_bytes(json_bytes(request_spec("EARTH", "NONE", self.epochs)))
        with self.assertRaises(ValidationError):
            snapshot_case(source, destination, spec)

    def test_offline_partial_matrix_reports_missing_without_network(self):
        write_case(self.cache/"sun-geometric", model="DE441")
        before = tree_bytes(self.cache)
        with patch("lunar_pipeline.reference_validation.acquire") as network:
            results = self.run_matrix()
        network.assert_not_called()
        self.assertEqual([r["status"] for r in results], ["model_mismatch"]+["blocked_missing_reference"]*3)
        summary = matrix_summary(results)
        self.assertEqual(summary["verified_response_cases"], 1)
        self.assertFalse(summary["matrix_complete"])
        self.assertEqual(summary["status"], "completed_with_open_gates")
        self.assertEqual(tree_bytes(self.cache), before)

    def test_complete_matrix_still_withholds_scientific_acceptance(self):
        self.populate()
        results = self.run_matrix()
        self.assertEqual([r["status"] for r in results], ["passed", "unmatched_corrections"]*2)
        summary = matrix_summary(results)
        self.assertTrue(summary["matrix_complete"])
        self.assertEqual(summary["matched_inertial_cases"], 2)
        self.assertEqual(summary["accepted_scientific_scopes"], [])
        self.assertEqual(summary["external_orientation"], "blocked_model_alignment")

    def test_network_only_fetches_missing_into_new_cache(self):
        write_case(self.cache/"sun-geometric")
        before = tree_bytes(self.cache)

        def fetch(destination, spec):
            write_case(destination, spec["target"], spec["correction"])

        with patch("lunar_pipeline.reference_validation.acquire", side_effect=fetch) as network:
            results = self.run_matrix(acquire_missing=True)
        self.assertEqual(network.call_count, 3)
        self.assertEqual([r["origin"] for r in results], ["verified_cache"]+["network"]*3)
        self.assertTrue(matrix_summary(results)["matrix_complete"])
        self.assertEqual(tree_bytes(self.cache), before)

    def test_network_failure_stops_requests_but_still_reuses_later_cache(self):
        write_case(self.cache/"earth-geometric", target="EARTH")
        with patch("lunar_pipeline.horizons.urlopen", side_effect=URLError("offline")) as network:
            results = self.run_matrix(acquire_missing=True)
        network.assert_called_once()
        self.assertEqual([r["status"] for r in results],
            ["blocked_acquisition", "blocked_acquisition", "passed", "blocked_acquisition"])
        self.assertTrue((self.output/"reference-cache/sun-geometric/acquisition-error.json").is_file())

    def test_documented_network_failure_can_be_retried_in_new_report_only(self):
        spec = request_spec("SUN", "NONE", self.epochs)
        source = self.cache/"sun-geometric"
        source.mkdir()
        (source/"request.json").write_bytes(json_bytes(spec))
        (source/"acquisition-error.json").write_bytes(json_bytes(dict(status="failed", error="timeout")))
        before = tree_bytes(self.cache)

        def fetch(destination, request):
            write_case(destination, request["target"], request["correction"])

        with patch("lunar_pipeline.reference_validation.acquire", side_effect=fetch):
            results = self.run_matrix(acquire_missing=True)
        self.assertTrue(matrix_summary(results)["matrix_complete"])
        self.assertEqual(tree_bytes(self.cache), before)
        self.assertFalse((source/"response.json").exists())

    def test_replay_failure_after_download_is_not_network_block(self):
        with patch("lunar_pipeline.reference_validation.acquire"), \
                patch("lunar_pipeline.reference_validation.replay", side_effect=OSError("local read failed")):
            results = self.run_matrix(acquire_missing=True)
        self.assertTrue(all(r["status"] == "failed_replay" for r in results))

    def test_corrupt_cache_is_failure_never_replaced_by_download(self):
        self.populate()
        (self.cache/"sun-geometric/response.json").write_bytes(b"corrupted")
        before = tree_bytes(self.cache)
        with patch("lunar_pipeline.reference_validation.acquire") as network:
            results = self.run_matrix(acquire_missing=True)
        network.assert_not_called()
        self.assertEqual(results[0]["status"], "failed_replay")
        self.assertEqual(matrix_summary(results)["status"], "failed")
        self.assertEqual(tree_bytes(self.cache), before)

    def test_incomplete_receipt_is_not_missing_and_not_reacquired(self):
        self.populate()
        (self.cache/"sun-geometric/receipt.json").unlink()
        with patch("lunar_pipeline.reference_validation.acquire") as network:
            results = self.run_matrix(acquire_missing=True)
        network.assert_not_called()
        self.assertEqual(results[0]["status"], "failed_replay")

    def test_invalid_network_payload_is_validation_failure(self):
        self.populate()
        # Use a separate empty cache so no complete case is overwritten.
        empty = self.root/"empty"
        empty.mkdir()
        with patch("lunar_pipeline.reference_validation.acquire", side_effect=ValidationError("bad service header")):
            results = run_matrix(self.output, self.epochs, SyntheticSpice(), empty, True)
        self.assertTrue(all(r["status"] == "failed_reference_validation" for r in results))
        self.assertEqual(matrix_summary(results)["status"], "failed")

    def test_progress_records_all_cases_and_outputs(self):
        progress = []
        results = run_matrix(self.output, self.epochs, SyntheticSpice(), record=lambda r: progress.append(len(r)))
        self.assertEqual(progress, [1, 2, 3, 4])
        for item in results:
            self.assertEqual(strict_json((self.output/("reference-"+item["case"]+".json")).read_bytes()), item)

    def test_overlapping_or_missing_roots_rejected(self):
        for cache in (self.output, self.root, self.root/"missing"):
            with self.subTest(cache=cache), self.assertRaises(ValidationError):
                run_matrix(self.output, self.epochs, SyntheticSpice(), cache)

    def test_summary_rejects_omissions_duplicates_and_unknown_states(self):
        results = self.run_matrix()
        for bad in (results[:-1], [results[0]]*4, [results[0] | {"status": "unknown"}]+results[1:]):
            with self.subTest(bad=bad), self.assertRaises(ValidationError):
                matrix_summary(bad)


if __name__ == "__main__":
    unittest.main()