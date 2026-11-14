"""Synthetic protocol and fail-closed tests, not external scientific evidence."""

import math
import subprocess
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from lunar_pipeline.browser_validation import DiagnosticServer, run_browser
from lunar_pipeline.component_validation import altitude, chunk_epochs, et_to_jd, jd_to_et
from lunar_pipeline.core import ValidationError, digest, json_bytes, strict_json
from lunar_pipeline.horizons import acquire, compare, parse_response, replay, request_spec
from lunar_pipeline.evidence import run_command


def synthetic_response(correction="NONE", model="DE440"):
    kind = "GEOMETRIC" if correction == "NONE" else "LT+S CORRECTED"
    return json_bytes(dict(signature=dict(source="NASA/JPL Horizons API", version="1.3"), result=f"""
Target body name: Sun (10) {{source: {model}}}
Center body name: Moon (301) {{source: {model}}}
Center-site name: BODY CENTER
Reference frame : ICRF
Output units : KM-S
Output type : {kind} cartesian states
JDTDB, Calendar Date (TDB), X, Y, Z,
$$SOE
2451545.000000000000000, A.D. 2000-Jan-01 12:00:00.0000, 1.0, 0.0, 0.0,
$$EOE
Synthetic footer; not a JPL response.
"""))


class ProtocolTests(unittest.TestCase):
    def test_decimal_epoch_roundtrip(self):
        for et in (0., 820497669.184, 1136030469.1839, math.nextafter(1136030469.1839, 0)):
            self.assertEqual(jd_to_et(et_to_jd(et)), et)

    def test_clipped_epoch_excludes_end(self):
        desc = dict(usable_span=dict(start_et_s=100., end_et_s=10900.), grid=dict(step_s=10800))
        values = chunk_epochs(desc, 10899.9)
        self.assertEqual(values[:2], (100, 4150))
        self.assertLess(values[-1], 10899.9)
        with self.assertRaises(ValidationError):
            chunk_epochs(desc, 100)
        with self.assertRaises(ValidationError):
            chunk_epochs(desc, 200)

    def test_altitude_golden(self):
        self.assertEqual(altitude([0, 0, 2], [0, 0, 1]), 90)
        self.assertEqual(altitude([1, 0, 0], [0, 0, 1]), 0)
        self.assertEqual(altitude([0, 0, -1], [0, 0, 1]), -90)
        with self.assertRaises(ValidationError):
            altitude([0, 0, 0], [0, 0, 1])

    def test_nonfinite_or_nonunit_inputs_fail_closed(self):
        for vector, up in (([math.nan, 0, 0], [0, 0, 1]), ([1, 0, 0], [0, 0, 2]),
                           ([1, 0], [0, 1]), ([1, 0, 0], [0, math.inf, 0])):
            with self.assertRaises(ValidationError):
                altitude(vector, up)
        for et in (math.nan, math.inf, True):
            with self.assertRaises(ValidationError):
                et_to_jd(et)


class ReferenceTests(unittest.TestCase):
    def setUp(self):
        self.spec = request_spec("SUN", "NONE", [et_to_jd(0)])

    def test_exact_request_conventions(self):
        self.assertEqual(self.spec["parameters"]["CENTER"], "'500@301'")
        self.assertEqual(self.spec["parameters"]["TIME_TYPE"], "'TDB'")
        self.assertEqual(self.spec["parameters"]["REF_PLANE"], "'FRAME'")
        with self.assertRaises(ValidationError):
            request_spec("MOON", "NONE", [et_to_jd(0)])
        with self.assertRaises(ValidationError):
            request_spec("SUN", "NONE", ["nan"])

    def test_parse_synthetic_vector(self):
        parsed = parse_response(synthetic_response(), self.spec)
        self.assertEqual(parsed["rows"][0]["vector_km"], [1, 0, 0])
        self.assertEqual(parsed["models"], ["DE440", "DE440"])

    def test_reject_wrong_conventions_and_malformed_vectors(self):
        original = synthetic_response()
        changes = [(b"ICRF", b"ECLIPJ2000"), (b"Moon (301)", b"Earth (399)"),
            (b"Sun (10)", b"Earth (399)"), (b"KM-S", b"AU-D"), (b"JDTDB", b"JDUTC"),
            (b"BODY CENTER", b"SITE"), (b"GEOMETRIC", b"LT+S CORRECTED"),
            (b"2451545.000000000000000", b"2451546.000000000000000"),
            (b"1.0, 0.0, 0.0,", b"NaN, 0.0, 0.0,"),
            (b"1.0, 0.0, 0.0,", b"0.0, 0.0, 0.0,"), (b"$$EOE", b"missing"),
            (b'"1.3"', b'"9.9"')]
        for old, new in changes:
            with self.subTest(old=old), self.assertRaises(ValidationError):
                parse_response(original.replace(old, new), self.spec)

    def test_service_error_not_success(self):
        with self.assertRaises(ValidationError):
            parse_response(json_bytes(dict(error="bad request")), self.spec)

    def test_model_and_corrections_not_silently_matched(self):
        class Spice:
            @staticmethod
            def spkpos(*args):
                return [1., 0., 0.], 0.
        for model, correction, expected in (("DE440", "NONE", "passed"),
                ("DE441", "NONE", "model_mismatch"), ("DE440", "LT+S", "unmatched_corrections")):
            spec = request_spec("SUN", correction, [et_to_jd(0)])
            parsed = parse_response(synthetic_response(correction, model), spec)
            self.assertEqual(compare(parsed, spec, Spice())["status"], expected)

    def test_receipt_replay_hash_and_request(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            raw = synthetic_response()
            (root/"request.json").write_bytes(json_bytes(self.spec))
            (root/"response.json").write_bytes(raw)
            receipt = dict(request_sha256=digest(json_bytes(self.spec)), response_sha256=digest(raw),
                bytes=len(raw), status=200, final_url=self.spec["url"])
            (root/"receipt.json").write_bytes(json_bytes(receipt))
            self.assertEqual(replay(root, self.spec)["rows"][0]["et_s"], 0)
            with self.assertRaises(ValidationError):
                replay(root, request_spec("EARTH", "NONE", [et_to_jd(0)]))
            (root/"response.json").write_bytes(raw+b" ")
            with self.assertRaises(ValidationError):
                replay(root, self.spec)

    def test_network_failure_is_persisted_and_never_overwritten(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)/"cache"
            with patch("lunar_pipeline.horizons.urlopen", side_effect=URLError("offline")):
                with self.assertRaises(URLError):
                    acquire(root, self.spec)
            self.assertTrue((root/"request.json").is_file())
            self.assertEqual(strict_json((root/"acquisition-error.json").read_bytes())["status"], "failed")
            with self.assertRaises(FileExistsError):
                acquire(root, self.spec)


class ServerTests(unittest.TestCase):
    def test_browser_setup_failure_writes_failed_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            executable = root/"browser.exe"
            executable.touch()
            with patch.dict("lunar_pipeline.browser_validation.BROWSERS", {"test": executable}), \
                    patch("lunar_pipeline.browser_validation.DiagnosticServer", side_effect=OSError("setup failed")):
                result = run_browser("test", root, root, {}, root/"output")
            self.assertEqual(result["status"], "failed")
            self.assertIn("setup failed", result["error"])
            self.assertEqual(strict_json((root/"output"/"result.json").read_bytes()), result)

    def test_browser_profile_failure_closes_server_and_writes_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            executable = root/"browser.exe"
            executable.touch()
            server = MagicMock(requests=[])
            thread = MagicMock()
            thread.is_alive.side_effect = [True, False]
            with patch.dict("lunar_pipeline.browser_validation.BROWSERS", {"test": executable}), \
                    patch("lunar_pipeline.browser_validation.DiagnosticServer", return_value=server), \
                    patch("lunar_pipeline.browser_validation.threading.Thread", return_value=thread), \
                    patch("lunar_pipeline.browser_validation.tempfile.TemporaryDirectory", side_effect=OSError("profile failed")):
                result = run_browser("test", root, root, {}, root/"output")
            self.assertEqual(result["status"], "failed")
            self.assertIn("profile failed", result["error"])
            server.shutdown.assert_called_once()
            server.server_close.assert_called_once()
            thread.join.assert_called_once_with(timeout=5)
            self.assertEqual(strict_json((root/"output"/"result.json").read_bytes()), result)

    def test_missing_browser_writes_blocked_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with patch.dict("lunar_pipeline.browser_validation.BROWSERS", {"missing": root/"absent.exe"}):
                result = run_browser("missing", root, root, {}, root/"output")
            self.assertEqual(result["status"], "blocked_environment")
            self.assertEqual(strict_json((root/"output"/"result.json").read_bytes()), result)

    def test_server_cleanup_failure_still_writes_failed_evidence(self):
        for method in ("shutdown", "server_close"):
            with self.subTest(method=method), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                executable = root/"browser.exe"
                executable.touch()
                server, thread = MagicMock(requests=[]), MagicMock()
                thread.is_alive.side_effect = [True, False]
                getattr(server, method).side_effect = OSError("cleanup failed")
                with patch.dict("lunar_pipeline.browser_validation.BROWSERS", {"test": executable}), \
                        patch("lunar_pipeline.browser_validation.DiagnosticServer", return_value=server), \
                        patch("lunar_pipeline.browser_validation.threading.Thread", return_value=thread), \
                        patch("lunar_pipeline.browser_validation._browser_process"):
                    result = run_browser("test", root, root, {}, root/"output")
                self.assertEqual(result["status"], "failed")
                self.assertIn("cleanup failed", result["server_cleanup_error"])
                server.server_close.assert_called_once()
                self.assertEqual(strict_json((root/"output"/"result.json").read_bytes()), result)

    def test_server_thread_start_failure_closes_without_shutdown(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            executable = root/"browser.exe"
            executable.touch()
            server, thread = MagicMock(requests=[]), MagicMock()
            thread.start.side_effect = RuntimeError("thread failed")
            thread.is_alive.return_value = False
            with patch.dict("lunar_pipeline.browser_validation.BROWSERS", {"test": executable}), \
                    patch("lunar_pipeline.browser_validation.DiagnosticServer", return_value=server), \
                    patch("lunar_pipeline.browser_validation.threading.Thread", return_value=thread):
                result = run_browser("test", root, root, {}, root/"output")
            self.assertEqual(result["status"], "failed")
            self.assertIn("thread failed", result["error"])
            server.shutdown.assert_not_called()
            server.server_close.assert_called_once()
            self.assertEqual(strict_json((root/"output"/"result.json").read_bytes()), result)

    def test_allowlist_faults_and_authenticated_result(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root/"manifest.json").write_bytes(b"{}")
            (root/"binary.bin").write_bytes(b"abcd")
            (root/"secret.txt").write_bytes(b"must not serve")
            (root/"parity.json").write_bytes(b"[]")
            manifest = dict(files=[dict(href="binary.bin")], chunks=[dict(binary="binary.bin")])
            server = DiagnosticServer(root, root/"parity.json", manifest)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f"http://127.0.0.1:{server.server_port}"
            try:
                def get(path):
                    with urlopen(base+path, timeout=5) as response:
                        return response.read()
                self.assertEqual(get("/package/binary.bin"), b"abcd")
                self.assertNotEqual(get("/package/binary.bin?fault=corrupt"), b"abcd")
                for path in ("/package/secret.txt", "/package/../secret.txt", "/package/binary.bin?fault=missing"):
                    with self.assertRaises(HTTPError) as error:
                        get(path)
                    self.assertEqual(error.exception.code, 404)
                for token, code in (("wrong", 403), (server.token, 200)):
                    request = Request(base+"/result?token="+token, data=json_bytes(dict(status="passed")), method="POST")
                    if code == 403:
                        with self.assertRaises(HTTPError):
                            urlopen(request, timeout=5)
                    else:
                        with urlopen(request, timeout=5) as response:
                            self.assertEqual(response.status, 200)
                self.assertTrue(server.completed.wait(1))
                self.assertEqual((root/"binary.bin").read_bytes(), b"abcd")
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)


class CommandEvidenceTests(unittest.TestCase):
    def run_case(self, process=None, error=None):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            report, saved = dict(commands=[]), []
            def save():
                saved.append(strict_json(json_bytes(report)))
            with patch("lunar_pipeline.evidence.subprocess.run", return_value=process, side_effect=error):
                if error is not None or process.returncode != 0:
                    with self.assertRaises(type(error) if error is not None else ValidationError):
                        run_command("check", ["tool", root], root, report, save)
                else:
                    self.assertEqual(run_command("check", ["tool", root], root, report, save), process.stdout)
            self.assertEqual(len(saved), 2)
            self.assertEqual(saved[0]["commands"][0]["status"], "running")
            record = saved[-1]["commands"][0]
            self.assertIn("finished_at_utc", record)
            self.assertEqual(record["argv"], ["tool", str(root)])
            self.assertEqual(record["log"], "check.log")
            return record, (root/"check.log").read_text(encoding="utf-8")

    def test_success_records_output_and_exit_code(self):
        record, log = self.run_case(subprocess.CompletedProcess([], 0, "stdout", "stderr"))
        self.assertEqual((record["status"], record["exit_code"], log), ("passed", 0, "stdoutstderr"))

    def test_nonzero_records_failure_without_losing_output(self):
        record, log = self.run_case(subprocess.CompletedProcess([], 3, "partial", "failed"))
        self.assertEqual((record["status"], record["exit_code"], log), ("failed", 3, "partialfailed"))

    def test_timeout_records_partial_bytes_and_no_exit_code(self):
        record, log = self.run_case(error=subprocess.TimeoutExpired("tool", 240, output=b"partial\xff", stderr=b"timeout"))
        self.assertEqual(record["status"], "failed")
        self.assertIsNone(record["exit_code"])
        self.assertEqual(record["timeout_s"], 240)
        self.assertEqual(log, "partial\ufffdtimeout")

    def test_launch_failure_records_error_and_empty_log(self):
        record, log = self.run_case(error=FileNotFoundError("tool missing"))
        self.assertEqual(record["status"], "failed")
        self.assertIsNone(record["exit_code"])
        self.assertIn("tool missing", record["error"])
        self.assertEqual(log, "")


if __name__ == "__main__":
    unittest.main()