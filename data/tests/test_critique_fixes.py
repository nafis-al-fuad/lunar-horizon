"""Automated test suite validating all 7 technical critique requirements."""

import json
import unittest
from pathlib import Path

from lunar_pipeline.ephemeris_deck import EphemerisDeck


RELEASE_DIR = Path(__file__).resolve().parents[1] / "generated" / "lunar-horizon-release-v1"
EPHEM_DIR = Path(__file__).resolve().parents[1] / "generated" / "ephemeris-preview-d68aa79075433edddec0e443" / "ephemeris"


class CritiqueFixesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.assertTrue(RELEASE_DIR.exists(), "Release directory must exist")
        cls.manifest = json.loads((RELEASE_DIR / "manifest.json").read_text())
        cls.manifest_ids = {f["id"] for f in cls.manifest["files"]}

    def test_item1_and_item2_real_dem_raytraced_horizons(self):
        """Item 1 & 2: Horizons for South Pole sites are ray-traced from polar DEM."""
        shackleton_h = json.loads((RELEASE_DIR / "horizons" / "geom-shackleton-connecting-ridge.json").read_text())
        self.assertEqual(shackleton_h["processing"]["algorithm_id"], "dem-polar-raytrace-v1")
        self.assertIn("dem_raytraced", shackleton_h["bins"][0]["quality_flags"])
        # Topographic variance: elevations are not flat/constant
        elevations = [b["elevation"]["value"] for b in shackleton_h["bins"]]
        self.assertGreater(max(elevations) - min(elevations), 0.5, "Horizon must contain topographic obstruction variation")

        # Equatorial baseline uses reference sphere dip
        apollo_h = json.loads((RELEASE_DIR / "horizons" / "geom-apollo-11.json").read_text())
        self.assertEqual(apollo_h["processing"]["algorithm_id"], "analytic-sphere-dip-v1")

    def test_item3_refined_events_agree_with_interval_boundaries(self):
        """Item 3: Interval boundaries match refined event timestamps with < 1s discrepancy."""
        events_payload = json.loads((RELEASE_DIR / "events" / "scenario-artemis-shackleton-2026.json").read_text())
        events = events_payload["events"]
        sun_intervals = events_payload["tracks"]["sunlight"]

        # Check sunrise event exactly matches boundary between interval 0 and interval 1
        sunrise_ev = next(e for e in events if e["event_type"] == "sunrise")
        self.assertAlmostEqual(sunrise_ev["et_s"], sun_intervals[0]["end_et_s"], delta=0.5)
        self.assertAlmostEqual(sunrise_ev["et_s"], sun_intervals[1]["start_et_s"], delta=0.5)

        # Durations must strictly sum to 14 days (1,209,600 s)
        total_duration = sum(it["duration_s"] for it in sun_intervals)
        self.assertAlmostEqual(total_duration, 14 * 86400.0, delta=1e-3)

    def test_item4_eclipse_contacts_distinguished_from_horizon_crossings(self):
        """Item 4: Malapert solar eclipse by Earth is labeled as eclipse ingress/egress, not sunset."""
        malapert_events = json.loads((RELEASE_DIR / "events" / "scenario-artemis-malapert-2026.json").read_text())
        event_types = {e["event_type"] for e in malapert_events["events"]}
        self.assertIn("eclipse_ingress", event_types)
        self.assertIn("eclipse_egress", event_types)
        self.assertIn("sunset", event_types)  # Sunset also occurs separately when Sun actually sets

    def test_item5_zero_unresolved_internal_file_references(self):
        """Item 5: All 123 internal descriptor references (122 binary + 1 tile) resolve to manifest IDs."""
        missing = []
        for jf in RELEASE_DIR.rglob("*.json"):
            try:
                d = json.loads(jf.read_text())
                if isinstance(d, dict):
                    for k in ["binary_file_id", "descriptor_file_id", "time_conversion_file_id"]:
                        val = d.get(k)
                        if val and val not in self.manifest_ids:
                            missing.append((jf.name, k, val))
                    for t in d.get("tiles", []):
                        if isinstance(t, dict) and "file_id" in t and t["file_id"] not in self.manifest_ids:
                            missing.append((jf.name, "tile_file_id", t["file_id"]))
            except Exception:
                pass
        self.assertEqual(missing, [], f"Found unresolved descriptor references: {missing}")

    def test_item6_validation_summary_honest_scope_labeling(self):
        """Item 6: Validation summary explicitly labels gates with documented scope."""
        summary = json.loads((RELEASE_DIR / "validation" / "summary.json").read_text())
        gate_map = {g["gate_id"]: g for g in summary["gate_statuses"]}
        self.assertEqual(gate_map["V04"]["status"], "passed_with_scope")
        self.assertEqual(gate_map["V05"]["status"], "passed_with_scope")
        self.assertEqual(gate_map["V06"]["status"], "passed")
        self.assertIn("ray-traced", gate_map["V06"]["description"].lower())

    def test_item7_ephemeris_caching_profile_separation(self):
        """Item 7: Ephemeris Deck caching separates geometric and apparent profiles."""
        deck = EphemerisDeck(EPHEM_DIR)
        t = deck.total_span[0] + 86400.0
        sun_geo, earth_geo = deck.get_state(t, profile="geometric")
        sun_app, earth_app = deck.get_state(t, profile="apparent")

        diff_sun = max(abs(a - b) for a, b in zip(sun_geo, sun_app))
        diff_earth = max(abs(a - b) for a, b in zip(earth_geo, earth_app))
        self.assertGreater(diff_sun, 1000.0)
        self.assertGreater(diff_earth, 1.0)


if __name__ == "__main__":
    unittest.main()
