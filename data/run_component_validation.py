"""Validate an immutable numerical preview; default offline, network explicitly opt-in."""

import argparse
import os
import platform
import shutil
import sys
import traceback
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError

from lunar_pipeline.browser_validation import run_browser
from lunar_pipeline.component_validation import encoded_observers, reference_epochs
from lunar_pipeline.core import file_digest, json_bytes, require, strict_json
from lunar_pipeline.ephemeris import kernels
from lunar_pipeline.ephemeris_release import validate_preview
from lunar_pipeline.evidence import run_command
from lunar_pipeline.fixture import PROJECT
from lunar_pipeline.horizons import acquire, compare, replay, request_spec


DEFAULT_RELEASE = PROJECT/"generated"/"ephemeris-preview-d68aa79075433edddec0e443"


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def source_paths():
    return sorted([*PROJECT.joinpath("lunar_pipeline").glob("*.py"),
        *PROJECT.joinpath("tests").glob("*.py"), *PROJECT.joinpath("browser").glob("*.mjs"),
        *PROJECT.joinpath("browser").glob("*.html"), *PROJECT.joinpath("profiles").glob("*.json"),
        PROJECT/"run_component_validation.py", PROJECT/"VALIDATION_PLAN.md",
        PROJECT/"requirements-ephemeris.lock"])


def fingerprint():
    return [dict(path=p.relative_to(PROJECT).as_posix(), sha256=file_digest(p)) for p in source_paths()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", type=Path, default=DEFAULT_RELEASE)
    parser.add_argument("--raw-root", type=Path, default=Path(os.environ.get("LUNAR_RAW_ROOT", str(Path.home()/"lunar-navigator-raw"))))
    reference = parser.add_mutually_exclusive_group()
    reference.add_argument("--acquire-reference", action="store_true")
    reference.add_argument("--reference-cache", type=Path)
    args = parser.parse_args()
    root = PROJECT/"reports"/(datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")+"-component-"+uuid.uuid4().hex[:8])
    root.mkdir(parents=True)
    report = dict(format="ephemeris-component-validation-v1", status="running", started_at_utc=now(),
        release=str(args.release.resolve()), python=sys.version, platform=platform.platform(),
        commands=[], stages={}, accepted_scientific_scopes=[], external_orientation="blocked_model_alignment",
        external_surface_observer="blocked_model_alignment")

    def save():
        temp = root/"report.tmp"
        temp.write_bytes(json_bytes(report))
        temp.replace(root/"report.json")

    def execute(name, argv):
        return run_command(name, argv, root, report, save)

    print("Report:", root/"report.json", flush=True)
    save()
    try:
        require(sys.prefix != sys.base_prefix, "use isolated environment")
        report["sources"] = fingerprint()
        archive = root/"source-snapshot.zip"
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as output:
            for path in source_paths():
                output.write(path, path.relative_to(PROJECT).as_posix())
        report["source_archive_sha256"] = file_digest(archive)
        node = shutil.which("node")
        require(node is not None, "Node required for syntax/regression checks")
        report["node_version"] = execute("node-version", [node, "--version"]).strip()
        execute("python-tests", [sys.executable, "-B", "-m", "unittest", "discover", "-s", PROJECT/"tests", "-v"])
        for path in sorted((PROJECT/"browser").glob("*.mjs")):
            execute(path.stem+"-syntax", [node, "--check", path])
        report["stages"]["publication_before"] = validate_preview(args.release)
        report["manifest_sha256"] = file_digest(args.release/"manifest.json")
        manifest = strict_json((args.release/"manifest.json").read_bytes())
        save()
        with kernels(args.raw_root) as (spice, evidence):
            report["kernel_sources"] = evidence
            observers, parity = encoded_observers(args.release, manifest, spice)
            (root/"encoded-observers.json").write_bytes(json_bytes(observers))
            parity_path = root/"javascript-parity.json"
            parity_path.write_bytes(json_bytes(parity))
            report["stages"]["encoded_observers"] = {k: v for k, v in observers.items() if k != "cases"}
            save()
            print("Encoded observers:", observers["status"], observers["comparisons"], flush=True)
            epochs = reference_epochs(spice, manifest)
            report["reference_epochs_jd_tdb"] = epochs
            results = []
            cache_root = args.reference_cache or root/"reference-cache"
            report["reference_cache"] = str(cache_root)
            # Requests are serial, with no automatic retry after a network failure.
            network_failed = False
            for target in ("SUN", "EARTH"):
                for correction in ("NONE", "LT+S"):
                    name = target.lower()+"-"+("geometric" if correction == "NONE" else "apparent")
                    spec = request_spec(target, correction, epochs)
                    (root/("reference-request-"+name+".json")).write_bytes(json_bytes(spec))
                    item = dict(case=name, status="not_run")
                    if network_failed:
                        item.update(status="blocked_acquisition", reason="previous acquisition failed; no automatic retry")
                    elif args.acquire_reference or args.reference_cache:
                        try:
                            parsed = acquire(cache_root/name, spec) if args.acquire_reference else replay(cache_root/name, spec)
                            item = dict(case=name, **compare(parsed, spec, spice))
                            # Replay independently verifies the exact cached request and raw response hash.
                            require(replay(cache_root/name, spec) == parsed, "offline replay mismatch")
                            item["offline_replay"] = "passed"
                        except Exception as exc:
                            acquisition_failure = args.acquire_reference and isinstance(exc, (OSError, URLError))
                            item.update(status=("blocked_acquisition" if acquisition_failure else
                                "failed_reference_validation" if args.acquire_reference else "failed_replay"),
                                error=f"{type(exc).__name__}: {exc}")
                            (root/("reference-"+name+"-error.log")).write_text(traceback.format_exc(), encoding="utf-8")
                            network_failed = acquisition_failure
                    results.append(item)
                    (root/("reference-"+name+".json")).write_bytes(json_bytes(item))
                    report["stages"]["external_inertial"] = results
                    save()
                    print("Reference", name, item["status"], flush=True)
        execute("node-published-parity", [node, PROJECT/"browser"/"ephemeris-smoke.mjs", args.release, parity_path])
        report["stages"]["actual_browser"] = {}
        for name in ("chrome", "edge"):
            result = run_browser(name, args.release, parity_path, manifest, root/name)
            report["stages"]["actual_browser"][name] = dict(status=result["status"], evidence=str(root/name/"result.json"))
            save()
            print("Browser", name, result["status"], flush=True)
        report["stages"]["publication_after"] = validate_preview(args.release)
        require(report["manifest_sha256"] == file_digest(args.release/"manifest.json"), "publication changed")
        require(report["sources"] == fingerprint(), "validation sources changed during run")
        require(report["stages"]["publication_before"] == report["stages"]["publication_after"], "publication validation changed")
        failed = observers["status"] != "passed" or any(v["status"] == "failed" for v in report["stages"]["actual_browser"].values())
        failed = failed or any(v["status"] in ("failed", "failed_replay", "failed_reference_validation") for v in results)
        # External orientation/observer alignment remains open even if inertial checks pass.
        report["status"] = "failed" if failed else "completed_with_open_gates"
    except Exception as exc:
        report.update(status="failed", error=f"{type(exc).__name__}: {exc}")
        (root/"error.log").write_text(traceback.format_exc(), encoding="utf-8")
    finally:
        report["finished_at_utc"] = now()
        artifacts = [p for p in root.rglob("*") if p.is_file() and p.name not in ("report.json", "report.tmp")]
        report["artifacts"] = [dict(path=p.relative_to(root).as_posix(), sha256=file_digest(p), bytes=p.stat().st_size) for p in sorted(artifacts)]
        save()
    print(report["status"].upper(), root/"report.json", flush=True)
    return 1 if report["status"] == "failed" else 0


if __name__ == "__main__":
    raise SystemExit(main())