"""Unit tests for topocentric projections, horizon masks, and event timeline metrics."""

import math
import unittest

from lunar_pipeline.core import ValidationError, json_bytes, strict_json
from lunar_pipeline.events import compute_metrics, evaluate_instant, partition_track
from lunar_pipeline.horizon import (
    build_horizon_payload,
    query_horizon_elevation,
    sphere_horizon_bins,
    validate_horizon_payload,
)
from lunar_pipeline.topocentric import (
    EARTH_RADIUS_KM,
    MOON_RADIUS_KM,
    SUN_RADIUS_KM,
    earth_phase,
    eclipse_geometry,
    target_angular_radius,
    topocentric_vector,
)


class TopocentricTests(unittest.TestCase):
    def test_overhead_target_elevation(self):
        # Observer at (0, 0), target at (10000, 0, 0) in Moon-fixed coordinates
        res = topocentric_vector((10000.0, 0.0, 0.0), lat_deg=0.0, lon_deg=0.0)
        self.assertAlmostEqual(res["elevation_deg"], 90.0, places=5)
        self.assertAlmostEqual(res["range_km"], 10000.0 - MOON_RADIUS_KM, places=5)

    def test_equatorial_cardinal_directions(self):
        # Target in local East direction (+Y in body frame for (0, 0))
        res_east = topocentric_vector((MOON_RADIUS_KM, 1000.0, 0.0), lat_deg=0.0, lon_deg=0.0)
        self.assertAlmostEqual(res_east["azimuth_deg"], 90.0, places=4)
        self.assertAlmostEqual(res_east["elevation_deg"], 0.0, places=4)

        # Target in local North direction (+Z in body frame for (0, 0))
        res_north = topocentric_vector((MOON_RADIUS_KM, 0.0, 1000.0), lat_deg=0.0, lon_deg=0.0)
        self.assertAlmostEqual(res_north["azimuth_deg"], 0.0, places=4)
        self.assertAlmostEqual(res_north["elevation_deg"], 0.0, places=4)

    def test_south_pole_observer(self):
        # Observer at South Pole (-90 lat, 0 ref meridian). Up is -Z.
        # Target at (1000, 0, -MOON_RADIUS_KM): in local horizontal plane
        res = topocentric_vector((1000.0, 0.0, -MOON_RADIUS_KM), lat_deg=-90.0, lon_deg=0.0, reference_meridian_deg=0.0)
        self.assertAlmostEqual(res["elevation_deg"], 0.0, places=4)

    def test_angular_radii(self):
        # Sun at 1 AU (~149.6 million km)
        r_sun = target_angular_radius(SUN_RADIUS_KM, 149597870.0)
        self.assertAlmostEqual(r_sun, 0.2664, places=3)  # semi-diameter ~0.266 deg (diameter ~0.533 deg)

        # Earth at average lunar distance (~384,400 km)
        r_earth = target_angular_radius(EARTH_RADIUS_KM, 384400.0)
        self.assertAlmostEqual(r_earth, 0.950, places=2)  # semi-diameter ~0.95 deg (diameter ~1.9 deg)

    def test_earth_phase(self):
        # Full Earth: Sun and Earth in opposite directions
        u_sun = (1.0, 0.0, 0.0)
        u_earth = (-1.0, 0.0, 0.0)
        phase_full = earth_phase(u_sun, u_earth)
        self.assertAlmostEqual(phase_full["phase_angle_deg"], 0.0, places=5)
        self.assertAlmostEqual(phase_full["illuminated_fraction"], 1.0, places=5)

        # New Earth: Sun and Earth in same direction
        phase_new = earth_phase(u_sun, u_sun)
        self.assertAlmostEqual(phase_new["phase_angle_deg"], 180.0, places=5)
        self.assertAlmostEqual(phase_new["illuminated_fraction"], 0.0, places=5)

    def test_eclipse_geometry(self):
        # Total solar eclipse by Earth
        u_sun = (1.0, 0.0, 0.0)
        u_earth = (1.0, 0.0, 0.0)
        ecl_total = eclipse_geometry(u_sun, u_earth, sun_radius_deg=0.266, earth_radius_deg=0.950)
        self.assertEqual(ecl_total["eclipse_state"], "total")
        self.assertEqual(ecl_total["unocculted_fraction"], 0.0)

        # No eclipse (separated by 10 degrees)
        u_sep = (math.cos(math.radians(10)), math.sin(math.radians(10)), 0.0)
        ecl_none = eclipse_geometry(u_sun, u_sep, sun_radius_deg=0.266, earth_radius_deg=0.950)
        self.assertEqual(ecl_none["eclipse_state"], "none")
        self.assertEqual(ecl_none["unocculted_fraction"], 1.0)


class HorizonTests(unittest.TestCase):
    def test_reference_sphere_dip(self):
        # 2m mast on smooth sphere: dip angle = acos(R / (R + 2m)) ≈ 0.0869 deg
        bins = sphere_horizon_bins(lat_deg=-89.0, lon_deg=0.0, mast_height_m=2.0, terrain_height_m=0.0, num_bins=360)
        self.assertEqual(len(bins), 360)
        expected_dip = -math.degrees(math.acos(1737400.0 / 1737402.0))
        for b in bins:
            self.assertAlmostEqual(b["elevation"]["value"], expected_dip, places=4)

    def test_build_and_validate_horizon_payload(self):
        payload = build_horizon_payload(
            geometry_id="shackleton-geom-001",
            site_id="shackleton-rim",
            lat_deg=-89.66,
            lon_deg=129.2,
            mast_height_m=2.0,
            terrain_height_m=1150.0,
            horizon_mode="reference_sphere"
        )
        validate_horizon_payload(payload)

        # Canonical json roundtrip
        raw = json_bytes(payload)
        parsed = strict_json(raw)
        self.assertEqual(parsed, payload)

    def test_query_horizon_interpolation(self):
        payload = build_horizon_payload(
            geometry_id="test-geom",
            site_id="test-site",
            lat_deg=0.0,
            lon_deg=0.0,
            num_bins=360
        )
        # Query at exact bin
        el_0 = query_horizon_elevation(payload, 0.0)
        el_1 = query_horizon_elevation(payload, 1.0)
        self.assertAlmostEqual(el_0, el_1, places=5)

        # Wrap-around query (359.5 deg)
        el_wrap = query_horizon_elevation(payload, 359.5)
        self.assertAlmostEqual(el_wrap, el_0, places=5)


class EventsTests(unittest.TestCase):
    def test_evaluate_instant_and_metrics(self):
        horizon = build_horizon_payload(
            geometry_id="site-geom",
            site_id="site-01",
            lat_deg=-89.0,
            lon_deg=0.0,
            mast_height_m=2.0
        )
        samples = []
        # Generate 10 hours of synthetic trajectory samples (step = 1 hr = 3600 s)
        for hour in range(10):
            et = hour * 3600.0
            # Rotate Sun around Z axis
            angle = math.radians(hour * 15.0)
            sun_dist = 149597870.0
            # Oscillate elevation between -1.0 and +1.0 deg
            z_sun = sun_dist * math.sin(math.radians(-1.0 + hour * 0.25))
            r_xy = math.sqrt(sun_dist**2 - z_sun**2)
            sun_km = (r_xy * math.cos(angle), r_xy * math.sin(angle), z_sun)

            # Earth positioned at ~60 deg elevation
            earth_dist = 384400.0
            earth_km = (0.0, earth_dist * math.cos(math.radians(60)), -earth_dist * math.sin(math.radians(60)))

            instant = evaluate_instant(
                sun_km, earth_km,
                lat_deg=-89.0, lon_deg=0.0,
                horizon_payload=horizon,
                et_s=et,
                utc_str=f"2026-01-01T{hour:02d}:00:00Z"
            )
            samples.append(instant)

        results = compute_metrics(samples)
        self.assertEqual(results["window_duration_s"], 9 * 3600.0)
        metrics = results["metrics"]
        self.assertGreaterEqual(metrics["sunlit_time_fraction"]["value"], 0.0)
        self.assertLessEqual(metrics["sunlit_time_fraction"]["value"], 1.0)
        self.assertGreaterEqual(metrics["dte_time_fraction"]["value"], 0.0)
        self.assertLessEqual(metrics["dte_time_fraction"]["value"], 1.0)
        self.assertGreaterEqual(metrics["longest_sunlit_s"]["value"], 0.0)
        self.assertGreaterEqual(metrics["longest_night_s"]["value"], 0.0)


if __name__ == "__main__":
    unittest.main()
