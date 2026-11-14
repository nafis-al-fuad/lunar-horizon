"""Bounded synthetic validator and immutable, allowlisted release packaging."""

import gzip
import io
import re
import tempfile
from pathlib import Path

from .core import (ValidationError, contained_file, coordinates, digest, disjoint_roots,
                   estimate, fields, integer, json_bytes, require, strict_json,
                   time_span, track_totals, utc_unix)
from .encoding import TimeConverter, validate_ephemeris
from .fixture import (dataset_id, fixture_resources, generator_identity, load_profile,
                      manifest_payload)


MAX_FILE = 1048576
FILE_FIELDS = ("id", "kind", "product_id", "href", "media_type", "payload_bytes", "sha256",
               "storage_encoding", "decoded_bytes", "decoded_sha256", "descriptor_file_id", "depends_on", "load_group")


def compressed(data):
    stream = io.BytesIO()
    with gzip.GzipFile(fileobj=stream, mode="wb", filename="", mtime=0, compresslevel=9) as writer:
        writer.write(data)
    return stream.getvalue()


def decode_file(entry, payload):
    for key in ("payload_bytes", "decoded_bytes"):
        require(integer(entry[key], key) <= MAX_FILE, "file exceeds foundation memory cap")
    for key in ("sha256", "decoded_sha256"):
        require(isinstance(entry[key], str) and re.fullmatch("[0-9a-f]{64}", entry[key]), "invalid SHA-256")
    require(len(payload) == entry["payload_bytes"] and digest(payload) == entry["sha256"], "payload integrity mismatch")
    if entry["storage_encoding"] == "identity":
        decoded = payload
    elif entry["storage_encoding"] == "gzip":
        try:
            with gzip.GzipFile(fileobj=io.BytesIO(payload)) as reader:
                decoded = reader.read(entry["decoded_bytes"] + 1)
        except (OSError, EOFError) as exc:
            raise ValidationError("invalid gzip payload") from exc
    else:
        raise ValidationError("unsupported storage encoding")
    require(len(decoded) == entry["decoded_bytes"] and digest(decoded) == entry["decoded_sha256"], "decoded integrity mismatch")
    return decoded


def validate_graph(entries):
    by_id = {entry["id"]: entry for entry in entries}
    require(len(by_id) == len(entries), "duplicate file ID")
    visiting, visited = set(), set()

    def visit(file_id):
        require(file_id in by_id, "unresolved dependency")
        require(file_id not in visiting, "dependency cycle")
        if file_id in visited:
            return
        visiting.add(file_id)
        dependencies = by_id[file_id]["depends_on"]
        require(type(dependencies) is list and len(dependencies) == len(set(dependencies)), "invalid dependency list")
        for dependency in dependencies:
            visit(dependency)
        visiting.remove(file_id)
        visited.add(file_id)

    for file_id in by_id:
        visit(file_id)


def inventory(root):
    result = set()
    for path in Path(root).rglob("*"):
        is_junc = path.is_junction() if hasattr(path, "is_junction") else False
        require(not path.is_symlink() and not is_junc, "linked release content")
        require(path.is_dir() or path.is_file(), "unsupported filesystem entry")
        if path.is_file():
            result.add(path.relative_to(root).as_posix())
    return result


def validate_release(root):
    """Validate ONLY the fixed foundation-v1 fixture, never arbitrary v3 data.

    Exact canonical payload matching deliberately rejects unimplemented nested
    semantics and fabricated computed acceptance. Numeric checks are also run
    independently to exercise the shared helpers and cross-resource arithmetic.
    """
    root = Path(root).resolve()
    manifest_path = contained_file(root, "manifest.json")
    require(manifest_path.stat().st_size <= MAX_FILE, "manifest too large")
    manifest = strict_json(manifest_path.read_bytes())
    require(manifest_path.read_bytes() == json_bytes(manifest), "noncanonical fixture manifest bytes")
    generator = manifest["generator"]
    fields(generator, ("revision", "config_sha256", "software"), "generator")
    require(isinstance(generator["revision"], str) and re.fullmatch("sha256-[0-9a-f]{64}", generator["revision"]), "generator fingerprint required")
    require(generator["config_sha256"] == generator_identity()["config_sha256"], "unsupported configuration fingerprint")
    require(generator["software"] == [{"name": "CPython", "version": "3.12.2"}], "unsupported foundation runtime")
    identity = dataset_id(generator)
    expected = fixture_resources(identity)
    entries = manifest["files"]
    require(type(entries) is list and len(entries) == len(expected), "wrong fixture resource count")
    # Compare every envelope and advertised capability, not just schema_version.
    require(json_bytes(manifest) == json_bytes(manifest_payload(identity, generator, entries)), "unsupported manifest semantics")
    require(len({e["href"] for e in entries}) == len(entries), "duplicate resource path")
    validate_graph(entries)
    decoded = {}
    resources = {}
    for entry, spec in zip(entries, expected):
        fields(entry, FILE_FIELDS, "file entry")
        file_id, href, product, group, dependencies, descriptor, value = spec
        binary = isinstance(value, bytes)
        fixed = dict(id=file_id, kind="binary" if binary else value["file_kind"], product_id=product,
                     href=href, media_type="application/octet-stream" if binary else "application/json",
                     descriptor_file_id=descriptor, depends_on=dependencies, load_group=group)
        require(json_bytes({k: entry[k] for k in fixed}) == json_bytes(fixed), "unsupported file index semantics")
        path = contained_file(root, entry["href"])
        require(path.is_file() and path.stat().st_size <= MAX_FILE, "missing or oversized resource")
        data = decode_file(entry, path.read_bytes())
        # This fixed profile permits exactly one byte representation per identity.
        # Hashes alone would allow re-encoded/whitespace-modified resources to be
        # substituted under an unchanged dataset ID by editing the manifest.
        expected_data = value if binary else json_bytes(value)
        expected_payload = compressed(expected_data) if binary else expected_data
        require(entry["storage_encoding"] == ("gzip" if binary else "identity"), "noncanonical fixture storage")
        require(data == expected_data and path.read_bytes() == expected_payload, "noncanonical fixture resource bytes")
        decoded[file_id] = data
        if binary:
            require(data == value, "unsupported synthetic binary values")
        else:
            payload = strict_json(data)
            require(json_bytes(payload) == json_bytes(value), f"unsupported {file_id} fields or values")
            resources[file_id] = payload
    approved = {entry["href"] for entry in entries} | {"manifest.json"}
    require(inventory(root) == approved, "unapproved or missing release files")
    site = resources["sites"]["sites"][0]
    coordinates(site["lat_deg"], site["lon_deg"], site["reference_meridian_deg"])
    scenario = resources["scenario"]
    start, end = time_span(scenario["window"])
    converter = TimeConverter(resources["time"])
    require(converter.to_et(scenario["start_utc"]) == start and converter.to_et(scenario["end_utc"]) == end, "scenario UTC/ET mismatch")
    utc_unix(manifest["generated_at_utc"])
    arrays = validate_ephemeris(resources["ephemeris"], decoded["ephemeris-binary"])
    totals = track_totals(resources["events"]["tracks"][0]["intervals"], scenario["window"])
    result = resources["results"]
    require(result["track_totals"] == [dict(track_id="sunlight", **{k + "_s": v for k, v in totals.items()})], "result/interval totals differ")
    metric = result["metrics"][0]
    estimate(metric["estimate"])
    require(metric["valid_duration_s"] + metric["unknown_duration_s"] == end - start, "duration accounting mismatch")
    require(metric["estimate"]["lower"] == totals["clear"] / (end - start), "wrong fraction denominator")
    require(metric["estimate"]["upper"] == 1 - totals["blocked"] / (end - start), "wrong possible fraction")
    startup = [e for e in entries if e["load_group"] == "startup"]
    startup_ids = {e["id"] for e in startup}
    require(all(set(e["depends_on"]) <= startup_ids for e in startup), "startup graph is incomplete")
    # A reproducible gzip size estimate, not an HTTP cold-load/device measurement.
    startup_gzip = len(compressed(manifest_path.read_bytes())) + sum(len(compressed(decoded[e["id"]])) for e in startup)
    require(startup_gzip <= load_profile()["acceptance"]["initial_gzip_budget_bytes"], "synthetic startup budget exceeded")
    return dict(dataset_id=identity, release_decision="synthetic_only", indexed_files=len(entries),
                total_payload_bytes=sum(e["payload_bytes"] for e in entries) + manifest_path.stat().st_size,
                total_decoded_bytes=sum(e["decoded_bytes"] for e in entries),
                estimated_startup_gzip_bytes=startup_gzip, track_totals=totals,
                decoded_ephemeris_values=len(next(iter(arrays.values()))),
                scientific_gates="not_run", actual_browser_test="not_run")


def build_fixture(build_root):
    generator = generator_identity()
    require(generator["software"][0]["version"] == "3.12.2", "use pinned CPython 3.12.2")
    identity = dataset_id(generator)
    build_root = Path(build_root).resolve()
    build_root.mkdir(parents=True, exist_ok=True)
    destination = contained_file(build_root, identity)
    if destination.exists():
        validate_release(destination)
        return destination
    with tempfile.TemporaryDirectory(prefix=".stage-", dir=build_root) as directory:
        stage = Path(directory)
        entries = []
        for file_id, href, product, group, dependencies, descriptor, value in fixture_resources(identity):
            binary = isinstance(value, bytes)
            data = value if binary else json_bytes(value)
            # Exercise explicit file-level gzip on the binary; HTTP encoding is separate.
            payload = compressed(data) if binary else data
            path = contained_file(stage, href)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(payload)
            entries.append(dict(id=file_id, kind="binary" if binary else value["file_kind"], product_id=product,
                href=href, media_type="application/octet-stream" if binary else "application/json",
                payload_bytes=len(payload), sha256=digest(payload), storage_encoding="gzip" if binary else "identity",
                decoded_bytes=len(data), decoded_sha256=digest(data), descriptor_file_id=descriptor,
                depends_on=dependencies, load_group=group))
        (stage / "manifest.json").write_bytes(json_bytes(manifest_payload(identity, generator, entries)))
        validate_release(stage)
        stage.rename(destination)
    return destination


def package_release(source, publish_root, raw_root):
    """Copy only validated manifest entries; retain raw and build data unchanged."""
    source = Path(source).resolve()
    publish_root, raw_root = disjoint_roots(publish_root, raw_root)
    disjoint_roots(source, publish_root, raw_root)
    report = validate_release(source)
    publish_root.mkdir(parents=True, exist_ok=True)
    destination = contained_file(publish_root, report["dataset_id"])
    if destination.exists():
        validate_release(destination)
        require(all((source / p).read_bytes() == (destination / p).read_bytes() for p in inventory(source)), "immutable release already exists with different bytes")
        return destination
    with tempfile.TemporaryDirectory(prefix=".publish-", dir=publish_root) as directory:
        stage = Path(directory)
        for href in sorted(inventory(source) - {"manifest.json"}) + ["manifest.json"]:
            target = contained_file(stage, href)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(contained_file(source, href).read_bytes())
        validate_release(stage)
        stage.rename(destination)
    return destination