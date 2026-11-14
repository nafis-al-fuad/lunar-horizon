"""One-command offline foundation verification, packaging and evidence capture."""

import os
import platform
import re
import shutil
import subprocess
import sys
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from lunar_pipeline.core import disjoint_roots, file_digest, json_bytes, require, strict_json
from lunar_pipeline.fixture import PROJECT, PROFILE_PATH, generator_identity, load_profile
from lunar_pipeline.release import build_fixture, package_release, validate_release


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def main():
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    report_root = PROJECT / "reports" / stamp
    report_root.mkdir(parents=True)
    report_path = report_root / "report.json"
    report = dict(report_format="foundation-run-v1", started_at_utc=utc_now(),
                  status="running", release_decision="synthetic_only", scientific_gates="not_run",
                  actual_browser_test="not_run", working_directory=str(PROJECT),
                  generator=generator_identity(), configuration_sha256=file_digest(PROFILE_PATH),
                  dependency_lock_sha256=file_digest(PROJECT / "requirements.lock"), commands=[],
                  acceptance_targets=load_profile()["acceptance"])

    def execute(name, arguments):
        started = utc_now()
        process = subprocess.run([str(a) for a in arguments], cwd=PROJECT, capture_output=True,
                                 text=True, encoding="utf-8", errors="replace", timeout=180,
                                 env=os.environ | {"PYTHONUTF8": "1"})
        log = report_root / (name + ".log")
        log.write_text(process.stdout + process.stderr, encoding="utf-8")
        report["commands"].append(dict(argv=[str(a) for a in arguments], working_directory=str(PROJECT),
            started_at_utc=started, finished_at_utc=utc_now(), exit_code=process.returncode, log=str(log)))
        require(process.returncode == 0, f"{name} failed; see {log}")
        return process.stdout, process.stderr

    try:
        require(platform.python_version() == "3.12.2" and sys.prefix != sys.base_prefix,
                "run with the isolated CPython 3.12.2 environment")
        node = shutil.which("node")
        require(node is not None, "Node is required for the JavaScript smoke test")
        raw = Path(os.environ.get("LUNAR_RAW_ROOT", str(Path.home() / "lunar-navigator-raw")))
        build_root, publish_root, raw = disjoint_roots(PROJECT / "work", PROJECT / "generated", raw)
        disjoint_roots(PROJECT, raw)
        report["storage_roots"] = dict(build=str(build_root), publish=str(publish_root), raw=str(raw))
        version, _ = execute("node-version", [node, "--version"])
        report["javascript_runtime"] = version.strip()
        execute("compile", [sys.executable, "-m", "compileall", "-q", str(PROJECT / "lunar_pipeline"), str(PROJECT / "tests"), str(PROJECT / "run_pipeline.py")])
        _, test_log = execute("python-tests", [sys.executable, "-m", "unittest", "discover", "-s", str(PROJECT / "tests"), "-v"])
        match = re.search(r"Ran (\d+) tests", test_log)
        require(match is not None and "\nOK" in test_log, "test result not recognized")
        report["python_tests_passed"] = int(match.group(1))
        release = build_fixture(build_root)
        report["build_validation"] = validate_release(release)
        smoke, _ = execute("javascript-build", [node, str(PROJECT / "browser" / "smoke.mjs"), str(release)])
        report["javascript_build"] = strict_json(smoke.encode("utf-8"))
        published = package_release(release, publish_root, raw)
        report["published_path"] = str(published)
        report["published_validation"] = validate_release(published)
        smoke, _ = execute("javascript-published", [node, str(PROJECT / "browser" / "smoke.mjs"), str(published)])
        report["javascript_published"] = strict_json(smoke.encode("utf-8"))
        require(report["javascript_published"]["track_totals"] == report["published_validation"]["track_totals"], "Python/JavaScript totals differ")
        require(report["javascript_published"]["decoded_values"] == [1, 0, 0, 150000000, 0, 1, 0, 384000] * 9, "encoded fixture parity mismatch")
        # Retain a small source/config snapshot outside the published release.
        paths = [*PROJECT.joinpath("lunar_pipeline").glob("*.py"), *PROJECT.joinpath("tests").glob("*.py"),
                 *PROJECT.joinpath("browser").glob("*.mjs"), *PROJECT.joinpath("browser").glob("*.html"),
                 *PROJECT.joinpath("profiles").glob("*.json"), PROJECT / "requirements.lock",
                 PROJECT / "run_pipeline.py", PROJECT / "IMPLEMENTATION.md"]
        archive = report_root / "source-snapshot.zip"
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as output:
            for path in sorted(paths):
                output.write(path, path.relative_to(PROJECT).as_posix())
        report["source_archive"] = dict(path=str(archive), sha256=file_digest(archive))
        require(generator_identity() == report["generator"], "source changed during run; rerun against a stable snapshot")
        report["status"] = "passed"
    except Exception as exc:
        report["status"] = "failed"
        report["error"] = f"{type(exc).__name__}: {exc}"
    finally:
        report["finished_at_utc"] = utc_now()
        report_path.write_bytes(json_bytes(report))
    print(f"{report['status'].upper()}: {report_path}")
    if report["status"] == "passed":
        print(f"Synthetic release: {report['published_path']}")
        print(f"Python: {report['python_tests_passed']} tests; JavaScript: {report['javascript_published']['negative_cases_passed']} rejection cases + golden parity.")
        print("Scientific gates and actual-browser testing: NOT RUN.")
        return 0
    print(report["error"], file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())