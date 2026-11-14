"""Audit cached Horizons cases offline; optionally acquire missing cases into a new report."""

import argparse
import os
import sys
import traceback
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from lunar_pipeline.component_validation import reference_epochs
from lunar_pipeline.core import file_digest, json_bytes, require, strict_json
from lunar_pipeline.ephemeris import kernels
from lunar_pipeline.ephemeris_release import validate_preview
from lunar_pipeline.evidence import run_command
from lunar_pipeline.fixture import PROJECT
from lunar_pipeline.reference_validation import matrix_summary, run_matrix


def source_paths():
    return sorted([*PROJECT.joinpath("lunar_pipeline").glob("*.py"),
        *PROJECT.joinpath("tests").glob("*.py"), *PROJECT.joinpath("profiles").glob("*.json"),
        *PROJECT.joinpath("browser").glob("*.mjs"), *PROJECT.joinpath("browser").glob("*.html"),
        PROJECT/"run_reference_validation.py", PROJECT/"requirements-ephemeris.lock",
        PROJECT/"VALIDATION_PLAN.md", PROJECT/"REFERENCE_ALIGNMENT.md"])


def fingerprint():
    return [dict(path=p.relative_to(PROJECT).as_posix(), sha256=file_digest(p)) for p in source_paths()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", type=Path,
        default=PROJECT/"generated/ephemeris-preview-d68aa79075433edddec0e443")
    parser.add_argument("--raw-root", type=Path,
        default=Path(os.environ.get("LUNAR_RAW_ROOT", str(Path.home()/"lunar-navigator-raw"))))
    parser.add_argument("--reference-cache", type=Path, help="read-only cache; missing cases are reported")
    parser.add_argument("--acquire-missing", action="store_true", help="explicit serial network access for missing cases only")
    args = parser.parse_args()
    root = PROJECT/"reports"/(datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")+"-reference-"+uuid.uuid4().hex[:8])
    root.mkdir(parents=True)
    report = dict(format="ephemeris-reference-validation-v1", status="running", commands=[],
        accepted_scientific_scopes=[], acquire_missing=args.acquire_missing,
        input_cache=str(args.reference_cache.resolve()) if args.reference_cache else None,
        started_at_utc=datetime.now(timezone.utc).isoformat())

    def save():
        temporary = root/"report.tmp"
        temporary.write_bytes(json_bytes(report))
        temporary.replace(root/"report.json")

    def record(results):
        report["cases"] = results
        save()
        print("Reference", results[-1]["case"], results[-1]["status"], flush=True)

    print("Report:", root/"report.json", flush=True)
    save()
    try:
        require(sys.prefix != sys.base_prefix, "use isolated environment")
        if args.reference_cache is not None:
            require(args.reference_cache.is_dir(), "input reference cache does not exist")
        report["sources"] = fingerprint()
        archive = root/"source-snapshot.zip"
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as output:
            for path in source_paths():
                output.write(path, path.relative_to(PROJECT).as_posix())
        report["source_archive_sha256"] = file_digest(archive)
        run_command("python-tests", [sys.executable, "-B", "-S", "-m", "unittest", "discover",
            "-s", PROJECT/"tests", "-v"], root, report, save)
        report["publication_before"] = validate_preview(args.release)
        report["manifest_sha256"] = file_digest(args.release/"manifest.json")
        manifest = strict_json((args.release/"manifest.json").read_bytes())
        with kernels(args.raw_root) as (spice, evidence):
            report["kernel_sources"] = evidence
            epochs = reference_epochs(spice, manifest)
            report["reference_epochs_jd_tdb"] = epochs
            results = run_matrix(root, epochs, spice, args.reference_cache, args.acquire_missing, record)
        report["publication_after"] = validate_preview(args.release)
        require(report["publication_before"] == report["publication_after"] and
                report["manifest_sha256"] == file_digest(args.release/"manifest.json"), "publication changed")
        require(report["sources"] == fingerprint(), "reference validation sources changed")
        report.update(matrix_summary(results))
    except Exception as exc:
        report.update(status="failed", error=f"{type(exc).__name__}: {exc}")
        (root/"error.log").write_text(traceback.format_exc(), encoding="utf-8")
    finally:
        report["finished_at_utc"] = datetime.now(timezone.utc).isoformat()
        report["artifacts"] = [dict(path=p.relative_to(root).as_posix(), sha256=file_digest(p), bytes=p.stat().st_size)
            for p in sorted(root.rglob("*")) if p.is_file() and p.name not in ("report.json", "report.tmp")]
        save()
    print(report["status"].upper(), root/"report.json", flush=True)
    return 1 if report["status"] == "failed" else 0


if __name__ == "__main__":
    raise SystemExit(main())