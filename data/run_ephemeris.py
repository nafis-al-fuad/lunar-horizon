"""Offline full-decade ephemeris preview with persistent progress and test evidence."""

import argparse
import math
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import traceback
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from lunar_pipeline.core import (digest, disjoint_roots, file_digest, json_bytes,
                                 require, strict_json)
from lunar_pipeline.encoding import validate_ephemeris
from lunar_pipeline.ephemeris import (PROFILES, check_coverage, chunk_descriptors, dependencies,
    generate_chunk, kernels, load_config, observer_checks, time_payload)
from lunar_pipeline.ephemeris_math import interpolate
from lunar_pipeline.ephemeris_release import (make_manifest, package_preview,
                                             validate_preview, write_resource)
from lunar_pipeline.fixture import PROJECT


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def source_paths():
    return sorted([*PROJECT.joinpath("lunar_pipeline").glob("*.py"),
                   *PROJECT.joinpath("tests").glob("*.py"),
                   *PROJECT.joinpath("browser").glob("*.mjs"),
                   *PROJECT.joinpath("browser").glob("*.html"),
                   *PROJECT.joinpath("profiles").glob("*.json"),
                   PROJECT / "requirements-ephemeris.lock", PROJECT / "run_ephemeris.py"])


def fingerprint():
    records = [dict(path=p.relative_to(PROJECT).as_posix(), sha256=file_digest(p)) for p in source_paths()]
    return dict(revision="sha256-" + digest(json_bytes(records)), files=records,
                software=dict(python=platform.python_version(), numpy="2.2.6", spiceypy="7.0.0", cspice="N0067"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-root", type=Path, default=Path(os.environ.get("LUNAR_RAW_ROOT", str(Path.home()/"lunar-navigator-raw"))))
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-ephemeris-" + uuid.uuid4().hex[:8]
    report_root = PROJECT / "reports" / stamp
    report_root.mkdir(parents=True)
    report_path = report_root / "report.json"
    report = dict(format="ephemeris-run-v1", status="running", started_at_utc=now(),
        external_reference="not_run", actual_browser="not_run", commands=[], completed_chunks=0)

    def save():
        temporary = report_path.with_suffix(".tmp")
        temporary.write_bytes(json_bytes(report))
        temporary.replace(report_path)

    def execute(name, arguments):
        process = subprocess.run([str(a) for a in arguments], cwd=PROJECT, capture_output=True,
            text=True, encoding="utf-8", errors="replace", timeout=240,
            env=os.environ | {"PYTHONUTF8": "1"})
        log = report_root / (name + ".log")
        log.write_text(process.stdout + process.stderr, encoding="utf-8")
        report["commands"].append(dict(argv=[str(a) for a in arguments], exit_code=process.returncode, log=str(log)))
        save()
        require(process.returncode == 0, f"{name} failed; see {log}")
        return process.stdout

    save()
    print("Report:", report_path, flush=True)
    try:
        require(sys.prefix != sys.base_prefix, "use isolated environment")
        dependencies()
        build, publish, raw = disjoint_roots(PROJECT/"work", PROJECT/"generated", args.raw_root)
        disjoint_roots(PROJECT, raw)
        node = shutil.which("node")
        require(node is not None, "Node required for parity check")
        report["generator"] = fingerprint()
        config = load_config()
        report["acceptance_targets"] = config["acceptance"]
        execute("python-tests", [sys.executable, "-B", "-m", "unittest", "discover", "-s", PROJECT/"tests", "-v"])
        report["node_version"] = execute("node-version", [node, "--version"]).strip()
        for name in ("ephemeris", "ephemeris-smoke"):
            execute(name+"-syntax", [node, "--check", PROJECT/"browser"/(name+".mjs")])
        build.mkdir(parents=True, exist_ok=True)
        with kernels(raw) as (spice, evidence), tempfile.TemporaryDirectory(prefix=".ephemeris-", dir=build) as directory:
            stage = Path(directory)
            start, end = (float(spice.str2et(config[k])) for k in ("start_utc", "end_utc"))
            planned = chunk_descriptors(config, start, end)
            check_coverage(evidence, start-2*config["step_s"], planned[-1]["usable_span"]["end_et_s"]+2*config["step_s"])
            report["coverage"] = dict(start_utc=config["start_utc"], end_utc=config["end_utc"],
                start_et_s=start, end_et_s=end, chunks=len(planned),
                final_chunk_intervals=planned[-1]["grid"]["count"]-5,
                final_grid_padding_s=planned[-1]["usable_span"]["end_et_s"]-end)
            times, time_result = time_payload(spice, config)
            observers = observer_checks(spice, config, start, end)
            report.update(time=time_result, observer=observers, kernel_evidence=evidence)
            save()
            files = [write_resource(stage, "time.json", json_bytes(times)),
                     write_resource(stage, "sources.json", json_bytes(dict(evidence=evidence,
                         kernel_load_order=[i["specification"]["id"] for i in evidence],
                         transformations=["SPK J2000 Moon-center position with NONE or LT+S; rotate with pxform at observation ET.",
                                          "Direction/range Float64 -> little-endian Float32; separate profile arrays; no raw kernels shipped."]))) ]
            chunks, results, parity = [], [], []
            report["chunk_results"] = results
            for index, desc in enumerate(planned):
                payload, result = generate_chunk(spice, config, desc)
                href = "ephemeris/" + desc["chunk_id"]
                files.extend((write_resource(stage, href+".bin", payload), write_resource(stage, href+".json", json_bytes(desc))))
                chunks.append(dict(descriptor=href+".json", binary=href+".bin"))
                results.append(result)
                decoded = validate_ephemeris(desc, payload)
                a, b = (desc["usable_span"][k] for k in ("start_et_s", "end_et_s"))
                for et in (a, a+0.375*config["step_s"], math.nextafter(min(end, b), a)):
                    for profile in PROFILES:
                        parity.append(dict(chunk=index, profile=profile, et_s=et,
                                           expected=interpolate(desc, decoded[profile+"-states"], et)))
                report["completed_chunks"] = index+1
                save()
                if index % 10 == 0:
                    print(f"Validated {index+1} chunks", flush=True)
            validation = dict(status="passed", external_reference="not_run", actual_browser="not_run",
                              chunks=results, time=time_result, observer=observers)
            files.append(write_resource(stage, "validation.json", json_bytes(validation)))
            manifest = make_manifest(report["generator"], config, dict(start_et_s=start, end_et_s=end), chunks, files)
            write_resource(stage, "manifest.json", json_bytes(manifest))
            report["build_validation"] = validate_preview(stage)
            parity_path = report_root / "javascript-parity.json"
            parity_path.write_bytes(json_bytes(parity))
            report["javascript_build"] = strict_json(execute("javascript-build", [node, PROJECT/"browser"/"ephemeris-smoke.mjs", stage, parity_path]).encode())
            destination = build / manifest["dataset_id"]
            if destination.exists():
                validate_preview(destination)
                require((destination/"manifest.json").read_bytes() == (stage/"manifest.json").read_bytes(), "immutable build mismatch")
            else:
                stage.rename(destination)
        require(fingerprint() == report["generator"], "source changed before packaging; rerun")
        published = package_preview(destination, publish, raw)
        report["published_path"] = str(published)
        report["published_validation"] = validate_preview(published)
        report["javascript_published"] = strict_json(execute("javascript-published", [node, PROJECT/"browser"/"ephemeris-smoke.mjs", published, parity_path]).encode())
        require(fingerprint() == report["generator"], "source changed during run; rerun")
        archive = report_root / "source-snapshot.zip"
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as output:
            for path in source_paths():
                output.write(path, path.relative_to(PROJECT).as_posix())
        report["source_archive"] = dict(path=str(archive), sha256=file_digest(archive))
        report["status"] = "passed"
    except Exception as exc:
        report.update(status="failed", error=f"{type(exc).__name__}: {exc}")
        (report_root/"error.log").write_text(traceback.format_exc(), encoding="utf-8")
    finally:
        report["finished_at_utc"] = now()
        save()
    print(report["status"].upper(), report_path, flush=True)
    if report["status"] == "passed":
        print("Numerical preview only:", report["published_path"])
        return 0
    print(report["error"], file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())