"""Unit tests for curated sites catalog and P02 validation."""

import unittest

from lunar_pipeline.core import ValidationError, json_bytes, strict_json
from lunar_pipeline.sites import (
    CURATED_SITES,
    SITE_TYPES,
    SUPPORTED_FRAME,
    build_sites_payload,
    validate_site,
    validate_site_catalog,
)


class SitesTests(unittest.TestCase):
    def test_curated_sites_are_valid(self):
        self.assertGreaterEqual(len(CURATED_SITES), 15)
        ids = set()
        for site in CURATED_SITES:
            validate_site(site)
            self.assertNotIn(site["id"], ids)
            ids.add(site["id"])
            self.assertIn(site["site_type"], SITE_TYPES)
            self.assertEqual(site["frame"], SUPPORTED_FRAME)
            self.assertGreater(site["default_mast_height_m"], 0)

    def test_build_sites_payload(self):
        payload = build_sites_payload()
        validate_site_catalog(payload)
        self.assertEqual(payload["schema_version"], "3.0")
        self.assertEqual(payload["file_kind"], "sites")
        self.assertEqual(payload["data_kind"], "computed")

        # Canonical json roundtrip
        serialized = json_bytes(payload)
        deserialized = strict_json(serialized)
        self.assertEqual(deserialized, payload)

    def test_duplicate_site_id_rejected(self):
        site1 = dict(CURATED_SITES[0])
        site2 = dict(CURATED_SITES[0])
        with self.assertRaises(ValidationError):
            validate_site_catalog(build_sites_payload(sites=[site1, site2]))

    def test_invalid_coordinates_rejected(self):
        bad_lat = dict(CURATED_SITES[0], lat_deg=-95.0)
        with self.assertRaises(ValidationError):
            validate_site(bad_lat)

        bad_lon = dict(CURATED_SITES[0], lon_deg=185.0)
        with self.assertRaises(ValidationError):
            validate_site(bad_lon)

    def test_pole_reference_meridian_requirement(self):
        south_pole_no_meridian = dict(
            CURATED_SITES[0],
            lat_deg=-90.0,
            lon_deg=0.0,
            reference_meridian_deg=None,
        )
        with self.assertRaises(ValidationError):
            validate_site(south_pole_no_meridian)

        south_pole_with_meridian = dict(
            CURATED_SITES[0],
            lat_deg=-90.0,
            lon_deg=0.0,
            reference_meridian_deg=0.0,
        )
        validate_site(south_pole_with_meridian)

    def test_invalid_mast_height(self):
        bad_mast = dict(CURATED_SITES[0], default_mast_height_m=0)
        with self.assertRaises(ValidationError):
            validate_site(bad_mast)

        bad_mast_neg = dict(CURATED_SITES[0], default_mast_height_m=-2.5)
        with self.assertRaises(ValidationError):
            validate_site(bad_mast_neg)

    def test_invalid_site_type(self):
        bad_type = dict(CURATED_SITES[0], site_type="unknown_type")
        with self.assertRaises(ValidationError):
            validate_site(bad_type)


if __name__ == "__main__":
    unittest.main()
