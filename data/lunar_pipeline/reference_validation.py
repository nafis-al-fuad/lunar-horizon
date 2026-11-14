"""Resumable reference matrix: verified copies, explicit network, no cache mutation."""

from urllib.error import URLError

from .core import disjoint_roots, json_bytes, require, strict_json
from .horizons import MAX_RESPONSE, acquire, bounded_read, compare, replay, request_spec


CACHE_FILES = ("request.json", "receipt.json", "response.json")


def snapshot_case(source, destination, spec):
    """Return False only for absent or demonstrably unfinished acquisition evidence."""
    disjoint_roots(source, destination)
    require(not source.is_symlink() and not source.is_junction(), "linked reference cache")
    if not source.exists():
        return False
    require(source.is_dir() and not source.is_symlink() and not source.is_junction(), "linked/non-directory reference cache")
    for name in (*CACHE_FILES, "acquisition-error.json"):
        path = source/name
        require(not path.is_symlink() and not path.is_junction(), "linked reference file")
    if not (source/"receipt.json").exists() and not (source/"response.json").exists():
        require(strict_json(bounded_read(source/"request.json", 65536)) == spec, "unfinished request mismatch")
        error = strict_json(bounded_read(source/"acquisition-error.json", 65536))
        require(isinstance(error, dict) and error.get("status") == "failed", "unfinished acquisition evidence required")
        return False
    parsed = replay(source, spec)
    destination.mkdir(parents=True, exist_ok=False)
    for name in CACHE_FILES:
        limit = MAX_RESPONSE if name == "response.json" else 65536
        (destination/name).write_bytes(bounded_read(source/name, limit))
    require(replay(destination, spec) == parsed, "reference snapshot changed during copy")
    require(all(bounded_read(source/name, MAX_RESPONSE if name == "response.json" else 65536) ==
                bounded_read(destination/name, MAX_RESPONSE if name == "response.json" else 65536) for name in CACHE_FILES),
            "reference bytes changed during copy")
    return True


def run_matrix(root, epochs, spice, cache=None, acquire_missing=False, record=None):
    """Every case is reported; corruption fails, never triggers replacement download."""
    if cache is not None:
        disjoint_roots(root, cache)
        require(cache.is_dir() and not cache.is_symlink() and not cache.is_junction(), "invalid reference cache root")
    output_cache = root/"reference-cache"
    require(not output_cache.exists(), "reference output cache already exists")
    results = []
    network_failed = False
    for target in ("SUN", "EARTH"):
        for correction in ("NONE", "LT+S"):
            name = target.lower()+"-"+("geometric" if correction == "NONE" else "apparent")
            spec = request_spec(target, correction, epochs)
            (root/("reference-request-"+name+".json")).write_bytes(json_bytes(spec))
            item = dict(case=name, status="blocked_missing_reference", origin="none")
            destination = output_cache/name
            phase = "replay"
            try:
                reused = cache is not None and snapshot_case(cache/name, destination, spec)
                if reused:
                    item["origin"] = "verified_cache"
                elif acquire_missing and not network_failed:
                    phase = "acquire"
                    item["origin"] = "network"
                    acquire(destination, spec)
                    phase = "replay"
                elif acquire_missing:
                    item.update(status="blocked_acquisition", reason="previous network failure; no automatic retry")
                if reused or item["origin"] == "network":
                    parsed = replay(destination, spec)
                    item.update(compare(parsed, spec, spice), offline_replay="passed")
            except Exception as exc:
                acquisition_failure = phase == "acquire" and isinstance(exc, (OSError, URLError))
                if acquisition_failure:
                    network_failed = True
                item.update(status=("blocked_acquisition" if acquisition_failure else
                    "failed_reference_validation" if phase == "acquire" else "failed_replay"),
                    error=f"{type(exc).__name__}: {exc}")
            results.append(item)
            (root/("reference-"+name+".json")).write_bytes(json_bytes(item))
            if record is not None:
                record(results)
    return results


def matrix_summary(results):
    expected = [t+"-"+p for t in ("sun", "earth") for p in ("geometric", "apparent")]
    require([r["case"] for r in results] == expected, "incomplete reference case accounting")
    valid = {"passed", "failed", "model_mismatch", "unmatched_corrections", "blocked_missing_reference",
             "blocked_acquisition", "failed_replay", "failed_reference_validation"}
    require(all(r["status"] in valid for r in results), "unknown reference status")
    verified = sum(r.get("offline_replay") == "passed" for r in results)
    failed = any(r["status"] in {"failed", "failed_replay", "failed_reference_validation"} for r in results)
    return dict(status="failed" if failed else "completed_with_open_gates",
        expected_cases=4, verified_response_cases=verified, matrix_complete=verified == 4,
        matched_inertial_cases=sum(r["status"] == "passed" for r in results),
        accepted_scientific_scopes=[], external_orientation="blocked_model_alignment",
        external_surface_observer="blocked_model_alignment")