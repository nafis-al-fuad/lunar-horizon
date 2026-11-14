"""Separate preview envelope, not a general v3 release or science approval badge.

The preview is content-addressed, bounded, immutable and contains derived arrays
only. Structural validation checks integrity/consistency; it does not rerun SPICE
or authenticate an untrusted manifest. Use only locally generated trusted releases.
"""

import re
import tempfile
from pathlib import Path

from .core import (contained_file, digest, disjoint_roots, fields, integer, json_bytes,
                   number, require, strict_json, time_span)
from .encoding import TimeConverter, validate_ephemeris
from .ephemeris import PROFILES, SOURCE_LOCK, check_coverage, chunk_descriptors, load_config
from .release import inventory


FORMAT = "ephemeris-preview-v1"
MAX_FILE = 2_000_000
LIMITATIONS = ["Full contract v3 scientific acceptance withheld.",
               "External reference and actual-browser validation not run.",
               "No terrain, illumination, events, power or landing-safety claims."]


def preview_identity(manifest):
    return "ephemeris-preview-" + digest(json_bytes({k: v for k, v in manifest.items() if k != "dataset_id"}))[:24]


def write_resource(root, href, data):
    require(len(data) <= MAX_FILE, "preview file cap")
    target = contained_file(root, href)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("xb") as output:
        output.write(data)
    return dict(href=href, bytes=len(data), sha256=digest(data))


def make_manifest(generator, config, span, chunks, files):
    manifest = dict(format=FORMAT, dataset_id="", data_kind="computed",
        release_decision="numerical_preview_only", accepted_scientific_scopes=[],
        external_reference="not_run", actual_browser="not_run", limitations=LIMITATIONS,
        generator=generator, configuration=config, usable_span=span, chunks=chunks, files=files)
    manifest["dataset_id"] = preview_identity(manifest)
    return manifest


def validate_preview(root):
    root = Path(root).resolve()
    manifest_path = contained_file(root, "manifest.json")
    require(manifest_path.stat().st_size <= MAX_FILE, "manifest cap")
    data = manifest_path.read_bytes()
    m = strict_json(data)
    fields(m, ("format", "dataset_id", "data_kind", "release_decision", "accepted_scientific_scopes",
               "external_reference", "actual_browser", "limitations", "generator", "configuration",
               "usable_span", "chunks", "files"), "preview manifest")
    require(data == json_bytes(m), "noncanonical manifest")
    require(m["format"] == FORMAT and m["data_kind"] == "computed", "not a supported preview")
    require(m["release_decision"] == "numerical_preview_only" and m["accepted_scientific_scopes"] == [], "unsupported science acceptance")
    require(m["external_reference"] == m["actual_browser"] == "not_run" and m["limitations"] == LIMITATIONS, "unsupported acceptance claims")
    require(m["dataset_id"] == preview_identity(m), "preview identity mismatch")
    require(m["configuration"] == load_config(), "unsupported preview configuration")
    require(1 <= len(m["chunks"]) <= 256 and 1 <= len(m["files"]) <= 520, "preview inventory cap")
    require(len(m["files"]) == 2*len(m["chunks"]) + 3, "unexpected resource count")
    files = {}
    total = 0
    for entry in m["files"]:
        fields(entry, ("href", "bytes", "sha256"), "preview entry")
        require(entry["href"] not in files, "duplicate resource")
        size = integer(entry["bytes"], minimum=1)
        require(size <= MAX_FILE, "preview file cap")
        require(isinstance(entry["sha256"], str) and re.fullmatch("[0-9a-f]{64}", entry["sha256"]), "bad digest")
        path = contained_file(root, entry["href"])
        require(path.stat().st_size == size, "preview length mismatch")
        payload = path.read_bytes()
        require(digest(payload) == entry["sha256"], "preview hash mismatch")
        total += size
        require(total <= 10_000_000, "preview total cap")
        files[entry["href"]] = payload
    require(inventory(root) == set(files) | {"manifest.json"}, "unlisted/missing file")

    def resource(href):
        require(href in files, "missing resource")
        value = strict_json(files[href])
        require(json_bytes(value) == files[href], "noncanonical resource")
        return value

    start, end = time_span(m["usable_span"])
    time_resource = resource("time.json")
    converter = TimeConverter(time_resource)
    require(len(time_resource["segments"]) == 1 and not time_resource["positive_leaps"], "unsupported time segmentation")
    require(time_resource["segments"][0]["utc_start"] == m["configuration"]["start_utc"] and
            time_resource["segments"][0]["utc_end"] == m["configuration"]["end_utc"], "UTC coverage mismatch")
    require(time_resource["lsk_source_id"] == "naif0012" and bool(time_resource["future_leap_second_assumption"]), "missing time provenance")
    require(converter.pieces[0][2] == start and converter.pieces[-1][3] == end, "time/ephemeris coverage mismatch")
    require(converter.to_et(m["configuration"]["start_utc"]) == start, "UTC start mismatch")
    expected = {"time.json", "sources.json", "validation.json"}
    planned = chunk_descriptors(m["configuration"], start, end)
    require(len(m["chunks"]) == len(planned), "unexpected chunk count")
    cursor, previous = start, None
    for index, chunk in enumerate(m["chunks"]):
        fields(chunk, ("descriptor", "binary"), "chunk index")
        chunk_id = f"chunk-{index:04d}"
        require(chunk == dict(descriptor=f"ephemeris/{chunk_id}.json", binary=f"ephemeris/{chunk_id}.bin"), "unexpected chunk path")
        expected.update(chunk.values())
        desc = resource(chunk["descriptor"])
        fields(desc, ("chunk_id", "origin", "surface_frame", "frame_epoch", "profile_ids", "grid", "usable_span",
            "guard_samples_before", "guard_samples_after", "layout", "channel_units", "interpolation", "binary_file_id",
            "arrays", "decoded_bytes", "max_measured_angular_error_deg", "max_measured_range_error_km"), "descriptor")
        measured = {"max_measured_angular_error_deg", "max_measured_range_error_km"}
        require(json_bytes({k: v for k, v in desc.items() if k not in measured}) ==
                json_bytes({k: v for k, v in planned[index].items() if k not in measured}), "unreviewed chunk layout")
        require(desc["chunk_id"] == desc["binary_file_id"] == chunk_id, "chunk identity mismatch")
        require(desc["surface_frame"] == m["configuration"]["surface_frame"] and desc["profile_ids"] == list(PROFILES), "frame/profile mismatch")
        require(desc["grid"]["step_s"] == m["configuration"]["step_s"], "sampling mismatch")
        a, b = time_span(desc["usable_span"])
        require(a == cursor, "chunk gap/overlap")
        require(a < end and (b <= end or index == len(m["chunks"])-1), "chunk beyond advertised scope")
        arrays = validate_ephemeris(desc, files[chunk["binary"]])
        # Both chunks contain identical five-row overlap: guards + boundary knot.
        if previous is not None:
            for p in PROFILES:
                require(previous[p+"-states"][-40:] == arrays[p+"-states"][:40], "chunk seam mismatch")
        previous, cursor = arrays, b
        require(0 <= number(desc["max_measured_angular_error_deg"]) <= m["configuration"]["acceptance"]["encoded_angular_deg"], "angular target claim invalid")
        require(0 <= number(desc["max_measured_range_error_km"]) <= max(m["configuration"]["acceptance"]["range_error_km"].values()), "range target claim invalid")
    require(end <= cursor < end + m["configuration"]["step_s"], "incomplete or oversized coverage")
    require(set(files) == expected, "unapproved resource path")
    sources = resource("sources.json")
    require(sources["kernel_load_order"] == ["naif0012", "pck00011", "moon-080317", "moon-pa-de421", "de440s"], "source load order mismatch")
    require(len(sources["evidence"]) == 5, "missing source evidence")
    locked = strict_json(SOURCE_LOCK.read_bytes())["sources"]
    for item, pinned in zip(sources["evidence"], locked):
        spec = item["specification"]
        require(spec == pinned and spec["redistribution_status"] == "permitted" and
                spec["sha256"] == item["acquisition"]["sha256"] and spec["bytes"] == item["acquisition"]["bytes"], "source evidence mismatch")
    check_coverage(sources["evidence"], start-2*m["configuration"]["step_s"], cursor+2*m["configuration"]["step_s"])
    validation = resource("validation.json")
    require(validation["status"] == "passed" and validation["external_reference"] == validation["actual_browser"] == "not_run", "invalid validation claims")
    require(len(validation["chunks"]) == len(m["chunks"]), "missing numerical checks")
    for index, result in enumerate(validation["chunks"]):
        require(result["status"] == "passed" and result["chunk_id"] == f"chunk-{index:04d}", "invalid chunk check")
        require(integer(result["epochs"], minimum=1) > 0, "missing samples")
        for p in PROFILES:
            for target in ("SUN", "EARTH"):
                metrics = result["residuals"][p][target]
                limits = m["configuration"]["acceptance"]
                for key, limit in (("float64_angular_deg", limits["interpolation_angular_deg"]),
                                   ("encoded_angular_deg", limits["encoded_angular_deg"]),
                                   ("range_error_km", limits["range_error_km"][target])):
                    require(0 <= number(metrics[key]) <= limit, "numerical target exceeded")
    require(validation["time"]["status"] == validation["observer"]["status"] == "passed", "missing time/observer validation")
    limits = m["configuration"]["acceptance"]
    for key in ("max_forward_error_s", "max_inverse_error_s"):
        require(0 <= number(validation["time"][key]) <= limits["time_error_s"], "time target exceeded")
    require(time_resource["max_measured_error_s"] == validation["time"]["max_forward_error_s"], "time result mismatch")
    require(integer(validation["time"]["samples"], minimum=1) > 0 and
            integer(validation["observer"]["comparisons"], minimum=1) > 0, "missing numerical samples")
    for p in PROFILES:
        limit = limits["geometric_observer_angular_deg" if p == "geometric" else "observer_approximation_angular_deg"]
        fields(validation["observer"]["angular_errors_deg"][p], ("SUN", "EARTH"), "observer residuals")
        for value in validation["observer"]["angular_errors_deg"][p].values():
            require(0 <= number(value) <= limit, "observer target exceeded")
    return dict(dataset_id=m["dataset_id"], release_decision=m["release_decision"], chunks=len(m["chunks"]),
                total_payload_bytes=total+len(data), accepted_scientific_scopes=[], external_reference="not_run", actual_browser="not_run")


def package_preview(source, publish_root, raw_root):
    source, publish_root, _ = disjoint_roots(source, publish_root, raw_root)
    report = validate_preview(source)
    publish_root.mkdir(parents=True, exist_ok=True)
    destination = contained_file(publish_root, report["dataset_id"])
    if destination.exists():
        validate_preview(destination)
        require(all((source/p).read_bytes() == (destination/p).read_bytes() for p in inventory(source)), "immutable preview differs")
        return destination
    with tempfile.TemporaryDirectory(prefix=".preview-", dir=publish_root) as directory:
        stage = Path(directory)
        for href in sorted(inventory(source)):
            target = contained_file(stage, href)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(contained_file(source, href).read_bytes())
        validate_preview(stage)
        stage.rename(destination)
    return destination