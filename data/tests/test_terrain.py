"""Unit tests for lunar terrain, polar stereographic projections, and slope tiles."""

import math
import struct
import unittest

from lunar_pipeline.core import ValidationError, json_bytes, strict_json
from lunar_pipeline.terrain import (
    REFERENCE_RADIUS_M,
    build_terrain_descriptors,
    generate_polar_dem,
    lat_lon_to_polar_stereo,
    polar_stereo_to_lat_lon,
)


class TerrainTests(unittest.TestCase):
    def test_polar_stereographic_roundtrip(self):
        test_coords = [
            (-90.0, 0.0),
            (-89.5, 45.0),
            (-85.0, -120.0),
            (-82.0, 175.0),
            (-80.0, -179.0)
        ]
        for lat, lon in test_coords:
            x, y = lat_lon_to_polar_stereo(lat, lon)
            lat_inv, lon_inv = polar_stereo_to_lat_lon(x, y)
            self.assertAlmostEqual(lat, lat_inv, places=5)
            # Longitude at exact pole is arbitrary; elsewhere check lon
            if abs(lat + 90.0) > 1e-4:
                self.assertAlmostEqual(lon, lon_inv, places=4)

    def test_south_pole_is_origin(self):
        x, y = lat_lon_to_polar_stereo(-90.0, 0.0)
        self.assertAlmostEqual(x, 0.0, places=5)
        self.assertAlmostEqual(y, 0.0, places=5)

    def test_generate_polar_dem_dimensions_and_payloads(self):
        rows, cols = 31, 31
        dem = generate_polar_dem(rows=rows, cols=cols, resolution_m=20000.0)
        self.assertEqual(dem["rows"], rows)
        self.assertEqual(dem["columns"], cols)

        # Float32 heights (rows*cols*4) + uint8 valid (rows*cols)
        expected_t_bytes = rows * cols * 4 + rows * cols
        self.assertEqual(len(dem["terrain_binary"]), expected_t_bytes)

        # uint8 slope (rows*cols)
        expected_s_bytes = rows * cols
        self.assertEqual(len(dem["slope_binary"]), expected_s_bytes)

    def test_build_terrain_descriptors(self):
        dem = generate_polar_dem(rows=21, cols=21, resolution_m=30000.0)
        descriptors = build_terrain_descriptors(dem_data=dem)

        t_idx = descriptors["terrain_index"]
        t_tile = descriptors["terrain_tile"]
        s_tile = descriptors["slope_tile"]

        self.assertEqual(t_idx["file_kind"], "terrain_index")
        self.assertEqual(t_tile["file_kind"], "terrain_tile")
        self.assertEqual(s_tile["file_kind"], "slope_tile")

        # Canonical json checks
        for d in (t_idx, t_tile, s_tile):
            raw = json_bytes(d)
            parsed = strict_json(raw)
            self.assertEqual(parsed, d)


if __name__ == "__main__":
    unittest.main()
