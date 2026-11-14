"""Visibility analysis, root refinement, interval tracks, and threshold evaluation (P07/P08/P09)."""

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


def disc_area_fraction(clearance_deg, radius_deg):
    """Exact circular disc area fraction visible above a straight horizon tangent."""
    require(radius_deg > 0, "radius must be positive")
    x = clearance_deg / radius_deg
    if x <= -1.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    return 0.5 + (x * math.sqrt(max(0.0, 1.0 - x*x)) + math.asin(x)) / math.pi


def evaluate_instant(
    sun_center_km,
    earth_center_km,
    lat_deg,
    lon_deg,
    horizon_payload,
    height_km=0.002,
    earth_margin_deg=0.0,
    et_s=0.0,
    utc_str=None,
    visibility_mode="any_disc"
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

    # Exact circular disc area fraction
    terrain_vis_frac = disc_area_fraction(sun_clearance, sun_rad)

    # Classify solar visibility state based on declared mode
    if visibility_mode == "center":
        sunlit = sun_clearance >= 0.0
    elif visibility_mode == "full_disc":
        sunlit = sun_clearance >= sun_rad
    else:  # default "any_disc"
        sunlit = sun_clearance >= -sun_rad

    terrain_vis_state = "clear" if sunlit else "blocked"

    # Topocentric eclipse detection
    eclipse = eclipse_geometry(
        sun_topo["direction_unit"],
        earth_topo["direction_unit"],
        sun_rad,
        earth_rad
    )
    is_eclipsed = eclipse["eclipse_state"] == "total"
    if is_eclipsed:
        joint_state = "blocked"
        joint_vis_frac = 0.0
    else:
        joint_state = terrain_vis_state
        joint_vis_frac = min(terrain_vis_frac, eclipse["unocculted_fraction"])

    # Geometric Earth line-of-sight visibility (airless line of sight)
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
            dte_state=dte_state,
            description="Geometric airless line-of-sight above horizon; excludes RF link budget and antenna gain."
        ),
        simultaneous_state="clear" if (joint_state == "clear" and dte_state == "clear") else "blocked"
    )


def refine_transition(ephem_deck, lat_deg, lon_deg, horizon_payload, height_km, t0, t1, target="sun", event_cause="terrain", margin_deg=0.0, tol_s=30.0):
    """Bisection root refinement to find exact rise/set or eclipse event timestamp."""
    def eval_fn(t):
        sun_km, earth_km = ephem_deck.get_state(t)
        inst = evaluate_instant(sun_km, earth_km, lat_deg, lon_deg, horizon_payload, height_km, earth_margin_deg=margin_deg, et_s=t)
        if target == "earth":
            return inst["earth"]["clearance_deg"] - margin_deg
        elif event_cause == "eclipse":
            # Distance between Sun and Earth centers minus sum of angular radii
            sun_topo = topocentric_vector(sun_km, lat_deg, lon_deg, height_km)
            earth_topo = topocentric_vector(earth_km, lat_deg, lon_deg, height_km)
            dot = sum(a * b for a, b in zip(sun_topo["direction_unit"], earth_topo["direction_unit"]))
            dot = max(-1.0, min(1.0, dot))
            sep_deg = math.degrees(math.acos(dot))
            return sep_deg - (inst["sun"]["angular_radius_deg"] + inst["earth"]["angular_radius_deg"])
        else:
            # Terrain horizon crossing for any disc visible: clearance + sun_rad = 0
            return inst["sun"]["clearance_deg"] + inst["sun"]["angular_radius_deg"]

    f0 = eval_fn(t0)
    f1 = eval_fn(t1)

    # If both have same sign, no clean zero crossing bracketed in this interval
    if (f0 >= 0 and f1 >= 0) or (f0 <= 0 and f1 <= 0):
        return None, "sample_bounded", (t1 - t0)

    lo, hi = t0, t1
    for _ in range(50):
        if (hi - lo) <= tol_s:
            break
        mid = (lo + hi) / 2.0
        f_mid = eval_fn(mid)
        if (f0 >= 0 and f_mid >= 0) or (f0 < 0 and f_mid < 0):
            lo = mid
            f0 = f_mid
        else:
            hi = mid
    root = (lo + hi) / 2.0
    return root, "refined", tol_s


def partition_track(samples, state_key):
    """Partition uniform sequence of states into contiguous half-open intervals."""
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

    intervals.append(dict(
        start_et_s=interval_start_et,
        end_et_s=samples[-1]["et_s"],
        duration_s=samples[-1]["et_s"] - interval_start_et,
        state=current_state
    ))
    return intervals


def intersect_tracks(track_a, track_b):
    """Intersect two interval tracks to produce contiguous simultaneous intervals."""
    if not track_a or not track_b:
        return []
    cutpoints = sorted(set([it["start_et_s"] for it in track_a + track_b] + [it["end_et_s"] for it in track_a + track_b]))
    simul = []
    for i in range(len(cutpoints) - 1):
        t_mid = (cutpoints[i] + cutpoints[i + 1]) / 2.0
        s_a = next(it["state"] for it in track_a if it["start_et_s"] <= t_mid <= it["end_et_s"])
        s_b = next(it["state"] for it in track_b if it["start_et_s"] <= t_mid <= it["end_et_s"])
        st = "clear" if s_a == "clear" and s_b == "clear" else "blocked"
        if simul and simul[-1]["state"] == st:
            simul[-1]["end_et_s"] = cutpoints[i + 1]
            simul[-1]["duration_s"] = cutpoints[i + 1] - simul[-1]["start_et_s"]
        else:
            simul.append(dict(
                start_et_s=cutpoints[i],
                end_et_s=cutpoints[i + 1],
                duration_s=cutpoints[i + 1] - cutpoints[i],
                state=st
            ))
    return simul


def compute_metrics_and_events(samples, ephem_deck=None, lat_deg=None, lon_deg=None, horizon_payload=None, height_km=0.002, margin_deg=0.0, thresholds=None):
    """Extract standard mission metrics and refine event transitions."""
    require(len(samples) >= 2, "minimum 2 samples required for interval metrics")
    total_window_s = samples[-1]["et_s"] - samples[0]["et_s"]
    require(total_window_s > 0, "positive timeline duration required")
    step_s = samples[1]["et_s"] - samples[0]["et_s"]

    peak_sun_el = max(s["sun"]["elevation_deg"] for s in samples)
    min_sun_clearance = min(s["sun"]["clearance_deg"] for s in samples)

    sun_intervals = partition_track(
        [dict(et_s=s["et_s"], state=s["sun"]["joint_state"]) for s in samples],
        "state"
    )
    dte_intervals = partition_track(
        [dict(et_s=s["et_s"], state=s["earth"]["dte_state"]) for s in samples],
        "state"
    )

    # Detect refined transition events and rebuild intervals to match event boundaries exactly
    events = []
    if ephem_deck and lat_deg is not None and lon_deg is not None and horizon_payload is not None:
        samples_by_et = {s["et_s"]: s for s in samples}

        # 1. Refine Sun transitions
        for i in range(1, len(sun_intervals)):
            it = sun_intervals[i]
            t_prev = sun_intervals[i - 1]["end_et_s"] - step_s
            t_curr = sun_intervals[i - 1]["end_et_s"]

            # Determine cause: terrain vs eclipse
            s_blocked = samples_by_et.get(t_prev) if it["state"] == "clear" else samples_by_et.get(t_curr)
            is_eclipse = False
            if s_blocked and s_blocked["sun"]["terrain_visible_fraction"] > 0 and s_blocked["sun"]["eclipse_state"] != "none":
                is_eclipse = True

            if is_eclipse:
                ev_type = "eclipse_egress" if it["state"] == "clear" else "eclipse_ingress"
                cause = "eclipse"
            else:
                ev_type = "sunrise" if it["state"] == "clear" else "sunset"
                cause = "terrain"

            root, status, timing_res = refine_transition(
                ephem_deck, lat_deg, lon_deg, horizon_payload, height_km,
                t_prev, t_curr, target="sun", event_cause=cause
            )

            if root is not None and t_prev <= root <= t_curr:
                # Update intervals to match refined event time
                sun_intervals[i - 1]["end_et_s"] = root
                sun_intervals[i - 1]["duration_s"] = root - sun_intervals[i - 1]["start_et_s"]
                sun_intervals[i]["start_et_s"] = root
                sun_intervals[i]["duration_s"] = sun_intervals[i]["end_et_s"] - root
                t_event = root
            else:
                t_event = it["start_et_s"]
                status = "sample_bounded"
                timing_res = step_s

            events.append(dict(
                id=f"{ev_type}-{int(t_event)}",
                target="sun",
                event_type=ev_type,
                et_s=round(t_event, 1),
                status=status,
                timing_resolution_s=timing_res
            ))

        # 2. Refine DTE transitions
        for i in range(1, len(dte_intervals)):
            it = dte_intervals[i]
            t_prev = dte_intervals[i - 1]["end_et_s"] - step_s
            t_curr = dte_intervals[i - 1]["end_et_s"]
            ev_type = "dte_rise" if it["state"] == "clear" else "dte_set"

            root, status, timing_res = refine_transition(
                ephem_deck, lat_deg, lon_deg, horizon_payload, height_km,
                t_prev, t_curr, target="earth", margin_deg=margin_deg
            )

            if root is not None and t_prev <= root <= t_curr:
                dte_intervals[i - 1]["end_et_s"] = root
                dte_intervals[i - 1]["duration_s"] = root - dte_intervals[i - 1]["start_et_s"]
                dte_intervals[i]["start_et_s"] = root
                dte_intervals[i]["duration_s"] = dte_intervals[i]["end_et_s"] - root
                t_event = root
            else:
                t_event = it["start_et_s"]
                status = "sample_bounded"
                timing_res = step_s

            events.append(dict(
                id=f"{ev_type}-{int(t_event)}",
                target="earth",
                event_type=ev_type,
                et_s=round(t_event, 1),
                status=status,
                timing_resolution_s=timing_res
            ))

    # Reconstruct simultaneous intervals from refined sun and dte tracks
    simul_intervals = intersect_tracks(sun_intervals, dte_intervals)

    # Metrics computed from refined intervals
    total_sunlit_s = sum(it["duration_s"] for it in sun_intervals if it["state"] == "clear")
    total_dte_s = sum(it["duration_s"] for it in dte_intervals if it["state"] == "clear")
    total_simul_s = sum(it["duration_s"] for it in simul_intervals if it["state"] == "clear")

    longest_sunlit_s = max([it["duration_s"] for it in sun_intervals if it["state"] == "clear"] or [0.0])
    longest_night_s = max([it["duration_s"] for it in sun_intervals if it["state"] in ("blocked", "partial")] or [0.0])
    longest_dte_gap_s = max([it["duration_s"] for it in dte_intervals if it["state"] == "blocked"] or [0.0])

    sunlit_fraction = total_sunlit_s / total_window_s
    dte_fraction = total_dte_s / total_window_s
    simul_fraction = total_simul_s / total_window_s

    # Evaluate thresholds
    thresholds = thresholds or {}
    violated = []

    min_sun_req = thresholds.get("min_sun_fraction", 0.0)
    if sunlit_fraction < min_sun_req:
        violated.append(f"Sunlit fraction {sunlit_fraction:.1%} is below requirement {min_sun_req:.1%}")

    max_night_h_req = thresholds.get("max_night_hours", 400.0)
    max_night_s_req = max_night_h_req * 3600.0
    if longest_night_s > max_night_s_req:
        violated.append(f"Longest continuous night ({longest_night_s/3600.0:.1f}h) exceeds maximum allowed ({max_night_h_req:.1f}h)")

    min_dte_req = thresholds.get("min_dte_fraction", 0.0)
    if dte_fraction < min_dte_req:
        violated.append(f"Direct-to-Earth visibility {dte_fraction:.1%} is below requirement {min_dte_req:.1%}")

    outcome = "meets_selected_thresholds" if not violated else "fails_selected_thresholds"

    return dict(
        window_duration_s=total_window_s,
        metrics=dict(
            sunlit_time_fraction=make_estimate(sunlit_fraction),
            dte_time_fraction=make_estimate(dte_fraction),
            simultaneous_time_fraction=make_estimate(simul_fraction),
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
        ),
        events=events,
        outcome=outcome,
        violated_thresholds=violated
    )


# Backward-compatible alias for pipeline callers
compute_metrics = compute_metrics_and_events

