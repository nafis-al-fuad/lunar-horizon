"""End-to-end synthetic release checks and deliberate corruption cases."""

import copy
import tempfile
import unittest
from pathlib import Path

from lunar_pipeline.core import ValidationError, digest, json_bytes, strict_json
from lunar_pipeline.release import (MAX_FILE, build_fixture, compressed, decode_file,
                                    inventory, package_release, validate_graph, validate_release)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.release = build_fixture(self.root / "build")

    def manifest(self):
        return strict_json((self.release / "manifest.json").read_bytes())

    def save_manifest(self, manifest):
        (self.release / "manifest.json").write_bytes(json_bytes(manifest))

    def mutate_resource(self, file_id, mutate):
        manifest = self.manifest()
        entry = next(e for e in manifest["files"] if e["id"] == file_id)
        path = self.release / entry["href"]
        resource = strict_json(path.read_bytes())
        mutate(resource)
        data = json_bytes(resource)
        path.write_bytes(data)
        entry.update(payload_bytes=len(data), decoded_bytes=len(data), sha256=digest(data), decoded_sha256=digest(data))
        self.save_manifest(manifest)

    def test_build_validate_package(self):
        report = validate_release(self.release)
        self.assertEqual(report["release_decision"], "synthetic_only")
        self.assertEqual(report["indexed_files"], 11)
        self.assertEqual(report["decoded_ephemeris_values"], 72)
        self.assertEqual(report["track_totals"], dict(clear=150, blocked=150, uncertain=150, unknown=150))
        self.assertLess(report["estimated_startup_gzip_bytes"], 3_000_000)
        published = package_release(self.release, self.root / "publish", self.root / "raw")
        self.assertEqual(validate_release(published), report)
        self.assertFalse((self.root / "raw").exists())
        self.assertEqual(package_release(self.release, self.root / "publish", self.root / "raw"), published)

    def test_rebuild_bytes_are_deterministic(self):
        other = build_fixture(self.root / "second-build")
        self.assertEqual(other.name, self.release.name)
        self.assertEqual(inventory(other), inventory(self.release))
        for href in inventory(other):
            self.assertEqual((other / href).read_bytes(), (self.release / href).read_bytes())
        self.assertEqual(build_fixture(self.root / "build"), self.release)

    def test_unsafe_manifest_href(self):
        original = self.manifest()
        for href in ("../raw/input.bin", "%2e%2e/input.bin", "C:/input", "https://example.invalid/x"):
            manifest = copy.deepcopy(original)
            manifest["files"][0]["href"] = href
            self.save_manifest(manifest)
            with self.subTest(href=href), self.assertRaises(ValidationError):
                validate_release(self.release)

    def test_missing_resource(self):
        (self.release / "ephemeris" / "fixture.bin").unlink()
        with self.assertRaises(ValidationError):
            validate_release(self.release)

    def test_changed_payload_hash(self):
        path = self.release / "model.json"
        path.write_bytes(path.read_bytes() + b" ")
        with self.assertRaises(ValidationError):
            validate_release(self.release)

    def test_reformatted_resource_cannot_reuse_identity(self):
        path = self.release / "sources.json"
        data = path.read_bytes() + b" "
        path.write_bytes(data)
        manifest = self.manifest()
        entry = next(e for e in manifest["files"] if e["id"] == "sources")
        entry.update(payload_bytes=len(data), decoded_bytes=len(data), sha256=digest(data), decoded_sha256=digest(data))
        self.save_manifest(manifest)
        with self.assertRaises(ValidationError):
            validate_release(self.release)

    def test_reformatted_manifest_cannot_reuse_identity(self):
        path = self.release / "manifest.json"
        path.write_bytes(path.read_bytes() + b" ")
        with self.assertRaises(ValidationError):
            validate_release(self.release)

    def test_extra_raw_file_blocks_publication(self):
        (self.release / "kernel.bsp").write_bytes(b"must stay offline")
        with self.assertRaises(ValidationError):
            package_release(self.release, self.root / "publish", self.root / "raw")
        self.assertFalse((self.root / "publish").exists())

    def test_overlapping_publish_and_raw_roots(self):
        with self.assertRaises(ValidationError):
            package_release(self.release, self.root / "publish", self.root / "publish" / "raw")
        with self.assertRaises(ValidationError):
            package_release(self.release, self.release / "published", self.root / "raw")

    def test_corrupt_existing_publication_not_overwritten(self):
        published = package_release(self.release, self.root / "publish", self.root / "raw")
        path = published / "model.json"
        path.write_bytes(b"corrupt")
        with self.assertRaises(ValidationError):
            package_release(self.release, self.root / "publish", self.root / "raw")
        self.assertEqual(path.read_bytes(), b"corrupt")

    def test_computed_claim_rejected(self):
        manifest = self.manifest()
        manifest["data_kind"] = "computed"
        self.save_manifest(manifest)
        with self.assertRaises(ValidationError):
            validate_release(self.release)

    def test_enabled_capability_rejected(self):
        manifest = self.manifest()
        manifest["capabilities"][0]["enabled"] = True
        self.save_manifest(manifest)
        with self.assertRaises(ValidationError):
            validate_release(self.release)

    def test_broken_scenario_reference_despite_matching_hash(self):
        self.mutate_resource("scenario", lambda r: r["location"].update(site_id="missing-site"))
        with self.assertRaises(ValidationError):
            validate_release(self.release)

    def test_unknown_nested_semantics_rejected(self):
        self.mutate_resource("model", lambda r: r["parameter_defaults"][0].update(unreviewed=True))
        with self.assertRaises(ValidationError):
            validate_release(self.release)

    def test_false_gate_pass_rejected(self):
        self.mutate_resource("summary", lambda r: r["gate_statuses"][0].update(status="passed"))
        with self.assertRaises(ValidationError):
            validate_release(self.release)

    def test_numeric_boolean_not_equivalent(self):
        self.mutate_resource("scenario", lambda r: r["location"].update(lat_deg=False))
        with self.assertRaises(ValidationError):
            validate_release(self.release)

    def test_wrong_interval_totals_rejected(self):
        self.mutate_resource("results", lambda r: r["track_totals"][0].update(clear_s=600))
        with self.assertRaises(ValidationError):
            validate_release(self.release)

    def test_dependency_cycle_missing_and_duplicate(self):
        for entries in ([dict(id="a", depends_on=["b"]), dict(id="b", depends_on=["a"])],
                        [dict(id="a", depends_on=["missing"])],
                        [dict(id="a", depends_on=[]), dict(id="a", depends_on=[])],
                        [dict(id="a", depends_on=["b", "b"]), dict(id="b", depends_on=[])]):
            with self.subTest(entries=entries), self.assertRaises(ValidationError):
                validate_graph(entries)
        validate_graph([dict(id="descriptor", depends_on=["binary"]), dict(id="binary", depends_on=[])])

    def test_gzip_integrity_and_size_limits(self):
        data = b"decoded test content"
        payload = compressed(data)
        entry = dict(payload_bytes=len(payload), sha256=digest(payload), storage_encoding="gzip",
                     decoded_bytes=len(data), decoded_sha256=digest(data))
        self.assertEqual(decode_file(entry, payload), data)
        for changes in (dict(decoded_bytes=1), dict(decoded_bytes=MAX_FILE + 1), dict(payload_bytes=True),
                        dict(decoded_sha256="0" * 64), dict(storage_encoding="brotli")):
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                decode_file(entry | changes, payload)
        bad = payload[:-3]
        with self.assertRaises(ValidationError):
            decode_file(entry | dict(payload_bytes=len(bad), sha256=digest(bad)), bad)

    def test_duplicate_json_in_resource(self):
        path = self.release / "sources.json"
        manifest = self.manifest()
        entry = next(e for e in manifest["files"] if e["id"] == "sources")
        data = path.read_bytes().replace(b'"sources": []', b'"sources": [], "sources": []')
        path.write_bytes(data)
        entry.update(payload_bytes=len(data), decoded_bytes=len(data), sha256=digest(data), decoded_sha256=digest(data))
        self.save_manifest(manifest)
        with self.assertRaises(ValidationError):
            validate_release(self.release)