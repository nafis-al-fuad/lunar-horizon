"""Integrity and contract test for published unified dataset release."""

import unittest
from pathlib import Path

from lunar_pipeline.core import digest, file_digest, json_bytes, strict_json


DATASET_DIR = Path(__file__).resolve().parents[1] / "generated" / "lunar-horizon-release-v1"


class PublisherReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest_path = DATASET_DIR / "manifest.json"
        cls.assertTrue(cls.manifest_path.exists(), "manifest.json must exist in published release")
        cls.manifest = strict_json(cls.manifest_path.read_bytes())

    def test_manifest_structure(self):
        m = self.manifest
        self.assertEqual(m["schema_version"], "3.0")
        self.assertEqual(m["dataset_id"], "lunar-horizon-release-v1")
        self.assertEqual(m["file_kind"], "manifest")
        self.assertIn("entrypoints", m)
        self.assertIn("scenarios", m)
        self.assertIn("files", m)
        self.assertGreaterEqual(len(m["scenarios"]), 4)
        self.assertGreaterEqual(len(m["files"]), 280)

    def test_every_indexed_file_integrity(self):
        m = self.manifest
        for entry in m["files"]:
            rel_href = entry["href"]
            target = DATASET_DIR / rel_href
            self.assertTrue(target.exists(), f"File {rel_href} listed in manifest but missing on disk")

            file_bytes = target.read_bytes()
            self.assertEqual(len(file_bytes), entry["payload_bytes"], f"Byte mismatch for {rel_href}")
            self.assertEqual(digest(file_bytes), entry["sha256"], f"SHA256 mismatch for {rel_href}")

    def test_entrypoints_exist(self):
        m = self.manifest
        entries = m["entrypoints"]
        for key in ("model", "sources", "time_conversion", "sites", "terrain_index", "validation_summary", "core_content"):
            file_id = entries[key]
            self.assertIsNotNone(file_id, f"Entrypoint {key} must not be null")
            matching = [f for f in m["files"] if f["id"] == file_id]
            self.assertEqual(len(matching), 1, f"Entrypoint {key} (id: {file_id}) not found in manifest files")


if __name__ == "__main__":
    unittest.main()
