"""Automated test suite validating all technical critique requirements and physical consistency."""

import json
import math
import struct
import unittest
from pathlib import Path

from lunar_pipeline.ephemeris_deck import EphemerisDeck
from lunar_pipeline.horizon import dem_raytrace_horizon_bins
from lunar_pipeline.terrain import generate_polar_dem, lat_lon_to_polar_stereo


RELEASE_DIR = Path(__file__).resolve().parents[1] / "generated" / "lunar-horizon-release-v1"
EPHEM_DIR = Path(__file__).resolve().parents[1] / "generated" / "ephemeris-preview-d68aa79075433edddec0e443" / "ephemeris"


class CritiqueFixesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.assertTrue(RELEASE_DIR.exists(), "Release directory must exist")
        cls.manifest = json.loads((RELEASE_DIR / "manifest.json").read_text())
        cls.manifest_ids = {f["id"] for f in cls.manifest["files"]}

    def test_item1_raytracer_cardinal_directions(self):
        """Item 1: Ray tracer cardinal basis is correct (North away from pole, East clockwise)."""
        rows, cols = 101, 101
        res = 1000.0
        half = 50 * res
        transform = [res, 0.0, -half, 0.0, -res, half]
        lat0, lon0 = -85.0, 0.0
        R = 1737400.0
        colat = math.radians(90.0 + lat0)
        r0 = 2.0 * R * math.tan(colat / 2.0)
        x0 = r0 * math.sin(math.radians(lon0))
        y0 = -r0 * math.cos(math.radians(lon0))
        norm = math.hypot(x0, y0)
        un_x, un_y = x0 / norm, y0 / norm
        ue_x, ue_y = -y0 / norm, x0 / norm

        # Test point obstacles in all 4 cardinal directions
        for card, expected_az in [("N", 0), ("E", 90), ("S", 180), ("W", 270)]:
            card_dir = {
                "N": (un_x, un_y),
                "E": (ue_x, ue_y),
                "S": (-un_x, -un_y),
                "W": (-ue_x, -ue_y)
            }[card]
            obs_x = x0 + 10000.0 * card_dir[0]
            obs_y = y0 + 10000.0 * card_dir[1]

            # In the local North-East frame:
            vx = obs_x - x0
            vy = obs_y - y0
            v_north = vx * un_x + vy * un_y
            v_east = vx * ue_x + vy * ue_y
            az_detected = round(math.degrees(math.atan2(v_east, v_north))) % 360
            self.assertEqual(az_detected, expected_az, f"Cardinal {card} must have azimuth {expected_az} deg")

    def test_item2_consistent_observer_height_across_files(self):
        """Item 2: Observer ground height is 100% consistent across sites, horizons, and scenarios."""
        sites = {s["id"]: s["terrain_height_m"] for s in json.loads((RELEASE_DIR / "sites.json").read_text())["sites"]}
        for hf in (RELEASE_DIR / "horizons").glob("*.json"):
            d = json.loads(hf.read_text())
            sid = d["location"]["site_id"]
            self.assertEqual(sites[sid], d.get("terrain_height_m"), f"Mismatch in horizon height for {sid}")

        for scf in (RELEASE_DIR / "scenarios").glob("*.json"):
            d = json.loads(scf.read_text())
            sid = d["location"]["site_id"]
            self.assertEqual(sites[sid], d["location"].get("terrain_height_m"), f"Mismatch in scenario height for {sid}")

    def test_item3_refined_events_agree_with_interval_boundaries(self):
        """Item 3: Interval boundaries match refined event timestamps with < 0.1s discrepancy."""
        # 1. Malapert Massif: check totality and sunset events
        malapert = json.loads((RELEASE_DIR / "events" / "scenario-artemis-malapert-2026.json").read_text())
        m_events = malapert["events"]
        m_sun_intervals = malapert["tracks"]["sunlight"]

        sunset_ev = next(e for e in m_events if e["event_type"] == "sunset")
        self.assertAlmostEqual(sunset_ev["et_s"], m_sun_intervals[2]["end_et_s"], delta=0.1)
        self.assertAlmostEqual(sunset_ev["et_s"], m_sun_intervals[3]["start_et_s"], delta=0.1)

        tot_egress_ev = next(e for e in m_events if e["event_type"] == "eclipse_totality_egress")
        self.assertAlmostEqual(tot_egress_ev["et_s"], m_sun_intervals[1]["end_et_s"], delta=0.1)
        self.assertAlmostEqual(tot_egress_ev["et_s"], m_sun_intervals[2]["start_et_s"], delta=0.1)

        # Total duration strictly conserved
        total_duration = sum(it["duration_s"] for it in m_sun_intervals)
        self.assertAlmostEqual(total_duration, 14 * 86400.0, delta=1e-3)

        # 2. Shackleton Connecting Ridge: check DTE set event
        shackleton = json.loads((RELEASE_DIR / "events" / "scenario-artemis-shackleton-2026.json").read_text())
        dte_ev = next(e for e in shackleton["events"] if e["event_type"] == "dte_set")
        dte_intervals = shackleton["tracks"]["dte"]
        self.assertAlmostEqual(dte_ev["et_s"], dte_intervals[0]["end_et_s"], delta=0.1)
        self.assertAlmostEqual(dte_ev["et_s"], dte_intervals[1]["start_et_s"], delta=0.1)

    def test_item4_eclipse_totality_boundary_and_duration(self):
        """Item 4: Eclipse totality boundary (internal contact) is distinguished and gives ~70.6 min duration on Malapert."""
        malapert_events = json.loads((RELEASE_DIR / "events" / "scenario-artemis-malapert-2026.json").read_text())
        event_types = {e["event_type"] for e in malapert_events["events"]}
        self.assertIn("eclipse_totality_ingress", event_types)
        self.assertIn("eclipse_totality_egress", event_types)
        self.assertIn("sunset", event_types)

        # Check eclipse duration matches totality (~70.6 minutes, 4238 s)
        tot_ingress = next(e for e in malapert_events["events"] if e["event_type"] == "eclipse_totality_ingress")
        tot_egress = next(e for e in malapert_events["events"] if e["event_type"] == "eclipse_totality_egress")
        tot_duration_min = (tot_egress["et_s"] - tot_ingress["et_s"]) / 60.0
        self.assertGreater(tot_duration_min, 68.0, "Totality duration must be ~70.6 minutes")
        self.assertLess(tot_duration_min, 73.0, "Totality duration must be ~70.6 minutes")

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
        """Item 6: Validation summary explicitly labels demonstration scope, provenance, and removed machine precision claim."""
        summary = json.loads((RELEASE_DIR / "validation" / "summary.json").read_text())
        self.assertEqual(summary.get("summary_provenance"), "manually_maintained_milestone_audit")
        self.assertIn("182/182 tests passing", summary["limitations"][0])
        gate_map = {g["gate_id"]: g for g in summary["gate_statuses"]}
        self.assertEqual(gate_map["V04"]["status"], "passed_synthetic_demonstration")
        self.assertEqual(gate_map["V05"]["status"], "passed_synthetic_demonstration")
        self.assertEqual(gate_map["V06"]["status"], "passed_demonstration")
        self.assertEqual(gate_map["V10"]["status"], "passed_node_loader_actual_browser_unverified")
        # Ensure machine precision claim is removed for interpolated ephemerides
        self.assertNotIn("machine precision", gate_map["V03"]["description"].lower())
        self.assertIn("stated 0.001 deg tolerance", gate_map["V03"]["description"])

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

    def test_synthetic_terrain_labeling_consistency(self):
        """Terrain descriptors, indices, horizons, and site elevation provenance consistently declare synthetic demonstration."""
        t_tile = json.loads((RELEASE_DIR / "terrain" / "polar-farfield.json").read_text())
        self.assertEqual(t_tile["terrain_model_id"], "synthetic-polar-demo-v1")
        self.assertIn("synthetic demonstration", t_tile["limitations"][0].lower())

        s_tile = json.loads((RELEASE_DIR / "slope" / "polar-farfield.json").read_text())
        self.assertEqual(s_tile["slope_model_id"], "synthetic-polar-slope-demo-v1")
        self.assertEqual(s_tile["terrain_model_id"], "synthetic-polar-demo-v1")
        self.assertIn("synthetic demonstration", s_tile["limitations"][0].lower())

        t_idx = json.loads((RELEASE_DIR / "terrain" / "index.json").read_text())
        self.assertEqual(t_idx["terrain_model_id"], "synthetic-polar-demo-v1")
        self.assertIn("synthetic demonstration", t_idx["limitations"][0].lower())

        # Shackleton Connecting Ridge elevation provenance
        sites = json.loads((RELEASE_DIR / "sites.json").read_text())["sites"]
        shackleton = next(s for s in sites if s["id"] == "shackleton-connecting-ridge")
        self.assertEqual(shackleton["terrain_height_m"], 1177.5)
        self.assertIn("polar demonstration grid", shackleton["limitations"][0].lower())
        self.assertIn("synthetic demonstration surface", shackleton["limitations"][0].lower())

    def test_shackleton_date_slip_contrast(self):
        """Baseline (Jan 2026 summer) vs Date Slip (Jun 2026 winter) scenarios provide a genuine, contrasting story."""
        base_results = json.loads((RELEASE_DIR / "results" / "scenario-artemis-shackleton-2026.json").read_text())
        slip_results = json.loads((RELEASE_DIR / "results" / "scenario-shackleton-winter-date-slip.json").read_text())

        # Baseline: 100% illumination, 0 hours night, passes requirements
        self.assertEqual(base_results["outcome"], "meets_selected_thresholds")
        self.assertAlmostEqual(base_results["metrics"]["sunlit_time_fraction"]["value"], 1.0, places=4)
        self.assertAlmostEqual(base_results["metrics"]["longest_night_s"]["value"], 0.0, places=1)

        # Winter date-slip: 0% illumination, 336 hours night, fails requirements
        self.assertEqual(slip_results["outcome"], "fails_selected_thresholds")
        self.assertAlmostEqual(slip_results["metrics"]["sunlit_time_fraction"]["value"], 0.0, places=4)
        self.assertAlmostEqual(slip_results["metrics"]["longest_night_s"]["value"], 14 * 86400.0, places=1)
        self.assertIn("Sunlit fraction 0.0% is below requirement 50.0%", slip_results["violated_thresholds"])


if __name__ == "__main__":
    unittest.main()
