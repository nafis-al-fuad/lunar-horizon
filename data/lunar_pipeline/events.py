"""Visibility analysis, timeline tracks, and mission metrics (P07/P08/P09)."""

import math

from .core import ValidationError, estimate, json_bytes, number, require
from .horizon import make_estimate, query_horizon_elevation
from .topocentric import (
    EARTH_RADIUS_KM,
    SUN_RADIUS_KM,
    earth_phase,
    eclipse_geometry,
    target_angular_radius,
    topocentric_vector,
)


def evaluate_instant(
    sun_center_km,
    earth_center_km,
    lat_deg,
    lon_deg,
    horizon_payload,
    height_km=0.002,
    earth_margin_deg=0.0,
    et_s=0.0,
    utc_str=None
):
    """Compute instantaneous topocentric visibility for Sun and Earth against horizon mask."""
    sun_topo = topocentric_vector(sun_center_km, lat_deg, lon_deg, height_km)
    earth_topo = topocentric_vector(earth_center_km, lat_deg, lon_deg, height_km)

    sun_rad = target_angular_radius(SUN_RADIUS_KM, sun_topo["range_km"])
    earth_rad = target_angular_radius(EARTH_RADIUS_KM, earth_topo["range_km"])

    sun_horizon = query_horizon_elevation(horizon_payload, sun_topo["azimuth_deg"])
    earth_horizon = query_horizon_elevation(horizon_payload, earth_topo["azimuth_deg"])

    sun_clearance = sun_topo["elevation_deg"] - sun_horizon
    earth_clearance = earth_topo["elevation_deg"] - earth_horizon

    # Solar terrain disc visibility
    if sun_clearance >= sun_rad:
        terrain_vis_state = "clear"
        terrain_vis_frac = 1.0
    elif sun_clearance <= -sun_rad:
        terrain_vis_state = "blocked"
        terrain_vis_frac = 0.0
    else:
        terrain_vis_state = "partial"
        # Linear geometric disc projection fraction approximation
        terrain_vis_frac = (sun_clearance + sun_rad) / (2.0 * sun_rad)

    # Eclipse calculation
    eclipse = eclipse_geometry(
        sun_topo["direction_unit"],
        earth_topo["direction_unit"],
        sun_rad,
        earth_rad
    )
    joint_vis_frac = min(terrain_vis_frac, eclipse["unocculted_fraction"])
    joint_state = "clear" if joint_vis_frac >= 0.99 else ("blocked" if joint_vis_frac <= 0.01 else "partial")

    # Earth direct-to-Earth (DTE) communication visibility
    dte_clear = (earth_clearance - earth_margin_deg) >= 0.0
    dte_state = "clear" if dte_clear else "blocked"

    # Earth lit phase
    phase = earth_phase(sun_topo["direction_unit"], earth_topo["direction_unit"])

    return dict(
        et_s=et_s,
        utc=utc_str,
        sun=dict(
            azimuth_deg=sun_topo["azimuth_deg"],
            elevation_deg=sun_topo["elevation_deg"],
            range_km=sun_topo["range_km"],
            angular_radius_deg=sun_rad,
            horizon_deg=sun_horizon,
            clearance_deg=sun_clearance,
            clearance_estimate=make_estimate(sun_clearance),
            terrain_visible_fraction=terrain_vis_frac,
            eclipse_state=eclipse["eclipse_state"],
            eclipse_unocculted_fraction=eclipse["unocculted_fraction"],
            joint_visible_fraction=joint_vis_frac,
            joint_state=joint_state
        ),
        earth=dict(
            azimuth_deg=earth_topo["azimuth_deg"],
            elevation_deg=earth_topo["elevation_deg"],
            range_km=earth_topo["range_km"],
            angular_radius_deg=earth_rad,
            horizon_deg=earth_horizon,
            clearance_deg=earth_clearance,
            clearance_estimate=make_estimate(earth_clearance),
            phase_angle_deg=phase["phase_angle_deg"],
            illuminated_fraction=phase["illuminated_fraction"],
            dte_state=dte_state
        ),
        simultaneous_state="clear" if (joint_state == "clear" and dte_state == "clear") else "blocked"
    )


def partition_track(samples, state_key):
    """Partition uniform or non-uniform sequence of states into half-open intervals."""
    if not samples:
        return []
    intervals = []
    current_state = samples[0][state_key]
    interval_start_et = samples[0]["et_s"]

    for i in range(1, len(samples)):
        s = samples[i]
        st = s[state_key]
        if st != current_state:
            intervals.append(dict(
                start_et_s=interval_start_et,
                end_et_s=s["et_s"],
                duration_s=s["et_s"] - interval_start_et,
                state=current_state
            ))
            current_state = st
            interval_start_et = s["et_s"]

    # Final interval
    intervals.append(dict(
        start_et_s=interval_start_et,
        end_et_s=samples[-1]["et_s"],
        duration_s=samples[-1]["et_s"] - interval_start_et,
        state=current_state
    ))
    return intervals


def compute_metrics(samples):
    """Extract standard mission metrics from evaluated sample timeline."""
    require(len(samples) >= 2, "minimum 2 samples required for interval metrics")
    total_window_s = samples[-1]["et_s"] - samples[0]["et_s"]
    require(total_window_s > 0, "positive timeline duration required")

    # Extract sample series
    sun_states = [s["sun"]["joint_state"] for s in samples]
    dte_states = [s["earth"]["dte_state"] for s in samples]
    simul_states = [s["simultaneous_state"] for s in samples]

    peak_sun_el = max(s["sun"]["elevation_deg"] for s in samples)
    min_sun_clearance = min(s["sun"]["clearance_deg"] for s in samples)

    # Track intervals
    sun_intervals = partition_track(
        [dict(et_s=s["et_s"], state=s["sun"]["joint_state"]) for s in samples],
        "state"
    )
    dte_intervals = partition_track(
        [dict(et_s=s["et_s"], state=s["earth"]["dte_state"]) for s in samples],
        "state"
    )
    simul_intervals = partition_track(
        [dict(et_s=s["et_s"], state=s["simultaneous_state"]) for s in samples],
        "state"
    )

    total_sunlit_s = sum(it["duration_s"] for it in sun_intervals if it["state"] == "clear")
    total_dte_s = sum(it["duration_s"] for it in dte_intervals if it["state"] == "clear")
    total_simul_s = sum(it["duration_s"] for it in simul_intervals if it["state"] == "clear")

    longest_sunlit_s = max([it["duration_s"] for it in sun_intervals if it["state"] == "clear"] or [0.0])
    longest_night_s = max([it["duration_s"] for it in sun_intervals if it["state"] in ("blocked", "partial")] or [0.0])
    longest_dte_gap_s = max([it["duration_s"] for it in dte_intervals if it["state"] == "blocked"] or [0.0])

    return dict(
        window_duration_s=total_window_s,
        metrics=dict(
            sunlit_time_fraction=make_estimate(total_sunlit_s / total_window_s),
            dte_time_fraction=make_estimate(total_dte_s / total_window_s),
            simultaneous_time_fraction=make_estimate(total_simul_s / total_window_s),
            longest_sunlit_s=make_estimate(longest_sunlit_s),
            longest_night_s=make_estimate(longest_night_s),
            longest_dte_gap_s=make_estimate(longest_dte_gap_s),
            peak_sun_elevation_deg=make_estimate(peak_sun_el),
            min_sun_clearance_deg=make_estimate(min_sun_clearance)
        ),
        tracks=dict(
            sunlight=sun_intervals,
            dte=dte_intervals,
            simultaneous=simul_intervals
        )
    )
