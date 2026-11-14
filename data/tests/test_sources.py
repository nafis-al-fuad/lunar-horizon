"""Source acquisition tests use in-memory HTTP responses, never remote downloads."""

import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from lunar_pipeline.core import ValidationError, digest, strict_json
from lunar_pipeline.sources import HTTPSOnlyRedirect, acquire


class Response(io.BytesIO):
    status = 200

    def geturl(self):
        return "https://example.invalid/source.bin"


class SourceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / "raw"
        self.data = b"local mocked source only"
        self.spec = dict(id="test-source", url="https://example.invalid/source.bin", filename="source.bin",
            bytes=len(self.data), sha256=digest(self.data), product_version="test-v1", citation="Local unit test",
            license="Test-only input", redistribution_status="permitted", retrieved_at_utc="2026-11-13T00:00:00Z",
            native_frame=None, units="1", time_coverage=None)

    def test_download_receipt_and_idempotent_reuse(self):
        opener = Mock(return_value=Response(self.data))
        path = acquire(self.spec, self.root, opener)
        self.assertEqual(path.read_bytes(), self.data)
        receipt = strict_json((path.parent / "acquisition.json").read_bytes())
        self.assertEqual(receipt["sha256"], digest(self.data))
        self.assertIn("received_at_utc", receipt)
        self.assertEqual(acquire(self.spec, self.root, opener), path)
        opener.assert_called_once()

    def test_corrupt_or_oversized_download_not_promoted(self):
        for data in (b"wrong", self.data + b"extra", self.data[:-1] + b"!"):
            with self.subTest(data=data), self.assertRaises(ValidationError):
                acquire(self.spec, self.root, Mock(return_value=Response(data)))
            self.assertEqual(list(self.root.iterdir()), [])

    def test_existing_corruption_and_conflicting_evidence_rejected(self):
        path = acquire(self.spec, self.root, Mock(return_value=Response(self.data)))
        with self.assertRaises(ValidationError):
            acquire(self.spec | dict(license="changed"), self.root)
        path.write_bytes(b"bad")
        with self.assertRaises(ValidationError):
            acquire(self.spec, self.root)

    def test_missing_receipt_rejected(self):
        path = acquire(self.spec, self.root, Mock(return_value=Response(self.data)))
        (path.parent / "acquisition.json").unlink()
        with self.assertRaises(ValidationError):
            acquire(self.spec, self.root)

    def test_unsafe_or_unreviewed_source_rejected(self):
        for changes in (dict(url="http://example.invalid/x"), dict(url="https://user:pass@example.invalid/x"),
                        dict(filename="../x"), dict(filename="acquisition.json"), dict(sha256=""),
                        dict(redistribution_status="unresolved"), dict(bytes=True), dict(license="")):
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                acquire(self.spec | changes, self.root)

    def test_non_200_or_non_https_response_rejected(self):
        response = Response(self.data)
        response.status = 206
        with self.assertRaises(ValidationError):
            acquire(self.spec, self.root, Mock(return_value=response))
        response = Response(self.data)
        response.geturl = lambda: "http://example.invalid/x"
        with self.assertRaises(ValidationError):
            acquire(self.spec, self.root, Mock(return_value=response))

    def test_https_downgrade_redirect_rejected(self):
        with self.assertRaises(ValidationError):
            HTTPSOnlyRedirect().redirect_request(None, None, 302, "redirect", {}, "http://example.invalid/x")