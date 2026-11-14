"""Unit tests for the EphemerisDeck chunk reader and interpolator."""

import unittest
from pathlib import Path

from lunar_pipeline.core import ValidationError
from lunar_pipeline.ephemeris_deck import EphemerisDeck


EPHEMERIS_DIR = Path(__file__).resolve().parents[1] / "generated" / "ephemeris-preview-d68aa79075433edddec0e443" / "ephemeris"


class EphemerisDeckTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.assertTrue(EPHEMERIS_DIR.exists(), "Ephemeris directory must exist")
        cls.deck = EphemerisDeck(EPHEMERIS_DIR)

    def test_coverage_and_chunk_count(self):
        self.assertEqual(len(self.deck.chunks), 122)
        start, end = self.deck.total_span
        # Covers 2026-01-01 to 2036-01-01
        self.assertAlmostEqual(start, 820497669.18392, places=3)
        self.assertAlmostEqual(end, 1136030469.1839027, places=3)

    def test_evaluate_state_at_chunk_interior(self):
        # 1 day into 2026
        t = self.deck.total_span[0] + 86400.0
        sun_pos, earth_pos = self.deck.get_state(t)

        # Sun distance ~147 to 152 million km
        sun_dist = (sun_pos[0]**2 + sun_pos[1]**2 + sun_pos[2]**2)**0.5
        self.assertGreater(sun_dist, 145000000.0)
        self.assertLess(sun_dist, 153000000.0)

        # Earth distance ~355000 to 405000 km
        earth_dist = (earth_pos[0]**2 + earth_pos[1]**2 + earth_pos[2]**2)**0.5
        self.assertGreater(earth_dist, 350000.0)
        self.assertLess(earth_dist, 410000.0)

    def test_evaluate_at_chunk_boundary(self):
        # Pick the exact seam of chunk 0
        seam_t = self.deck.chunks[0][1] - 1.0  # 1 sec before chunk 0 ends
        sun_pos, earth_pos = self.deck.get_state(seam_t)
        self.assertTrue(all(isinstance(v, float) for v in sun_pos))
        self.assertTrue(all(isinstance(v, float) for v in earth_pos))

    def test_reject_out_of_coverage(self):
        # Before 2026
        with self.assertRaises(ValidationError):
            self.deck.get_state(self.deck.total_span[0] - 100.0)

        # After 2036
        with self.assertRaises(ValidationError):
            self.deck.get_state(self.deck.total_span[1] + 100.0)


if __name__ == "__main__":
    unittest.main()
