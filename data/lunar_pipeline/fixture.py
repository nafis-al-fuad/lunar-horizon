"""The complete, deliberately fixed foundation-v1 synthetic fixture.

This is a wire-format exercise, not a celestial calculation. No resource is
advertised as computed, and no scientific capability or gate is enabled.
"""

import platform
import struct
from pathlib import Path

from .core import digest, fields, file_digest, json_bytes, require, strict_json


PROJECT = Path(__file__).resolve().parents[1]
PROFILE_PATH = PROJECT / "profiles" / "foundation.json"
FRAME = "SYNTHETIC_MOON_FIXED"
KINDS = ("interpolation", "horizon", "disc", "events", "power", "slope", "uncertainty")
LIMITATIONS = [
    "Hand-authored synthetic fixture, not lunar predictions or a sourced study point.",
    "UTC mapping is fictional (zero offset), not SPICE UTC/TDB conversion.",
    "Intervals are independent test inputs, not derived from the ephemeris arrays.",
    "No terrain, disc, event search, phase, power, custom settings or science acceptance.",
]
FLAGS = [
    {"code": "synthetic", "meaning": "Hand-authored numerical fixture, not lunar measurements."},
    {"code": "missing_terrain", "meaning": "Required terrain unavailable in this test interval."},
    {"code": "incomplete_search", "meaning": "No continuous event search was performed."},
]


def load_profile():
    profile = strict_json(PROFILE_PATH.read_bytes())
    fields(profile, ("profile_id", "model_version", "data_kind", "generated_at_utc", "window", "sample_step_s", "site", "acceptance", "computed_release"), "foundation profile")
    require(profile["profile_id"] == "foundation-v1" and profile["data_kind"] == "synthetic", "unsupported profile")
    require(profile["model_version"] == "synthetic-foundation-v1", "unsupported fixture model")
    require(profile["window"] == {"start_et_s": 0, "end_et_s": 600} and profile["sample_step_s"] == 150, "foundation-v1 has fixed coverage")
    require(profile["site"] == {"id": "fictional-equator", "lat_deg": 0, "lon_deg": 0}, "foundation-v1 has a fixed fictional site")
    require(profile["computed_release"]["decision"] == "withheld" and not profile["computed_release"]["site_ids"] and not profile["computed_release"]["time_spans"], "computed release must remain withheld")
    return profile


def generator_identity():
    """Content fingerprint identifies generator inputs independently of Git metadata."""
    paths = [*PROJECT.joinpath("lunar_pipeline").glob("*.py"),
             *PROJECT.joinpath("tests").glob("*.py"),
             *PROJECT.joinpath("browser").glob("*.mjs"),
             *PROJECT.joinpath("browser").glob("*.html"),
             *PROJECT.joinpath("profiles").glob("*.json"),
             PROJECT / "requirements.lock", PROJECT / "run_pipeline.py"]
    records = [{"path": path.relative_to(PROJECT).as_posix(), "sha256": file_digest(path)}
               for path in sorted(paths) if path.is_file()]
    return {
        "revision": "sha256-" + digest(json_bytes(records)),
        "config_sha256": file_digest(PROFILE_PATH),
        "software": [{"name": "CPython", "version": platform.python_version()}],
    }


def dataset_id(generator):
    return "synthetic-foundation-" + digest(json_bytes(generator))[:24]


def resource(kind, identity, **payload):
    return dict(schema_version="3.0", dataset_id=identity,
                model_version="synthetic-foundation-v1", data_kind="synthetic",
                file_kind=kind, source_ids=[], validation_check_ids=[],
                limitations=LIMITATIONS.copy(), **payload)


def fixture_resources(identity):
    """Return the exact approved resource list, not a recursive folder copy.

    Each entry is (id, href, product, group, dependencies, descriptor, value).
    """
    profile = load_profile()
    result = []

    def add(file_id, href, product, group, kind, dependencies=(), **payload):
        result.append((file_id, href, product, group, list(dependencies), None,
                       resource(kind, identity, **payload)))

    algorithms = [{"id": "fixture-" + kind, "purpose": kind,
                   "producer_revision": "foundation-v1", "consumer_revision": "foundation-v1",
                   "specification": "Synthetic storage only; no algorithm execution. Parameters must be empty.",
                   "validation_check_ids": []} for kind in KINDS]
    add("model", "model.json", "P01", "startup", "model", ("time", "content"),
        coordinate_system=dict(body="Moon", surface_frame=FRAME, latitude_type="planetocentric",
                               longitude_positive="east", reference_radius_m=1737400,
                               height_reference="reference_sphere", azimuth_convention="north_clockwise_east"),
        profiles=[dict(id="fixture-geometric", aberration_correction="NONE", observer_method="moon_center_then_subtract",
                       frame_epoch="observation_et", phase_method="same_epoch_geometric", validation_check_ids=[])],
        body_radii_km=dict(sun=695700, earth=6371), reference_distance_km=149597870.7,
        time_conversion_file_id="time", algorithm_ids={k: "fixture-" + k for k in KINDS},
        parameter_defaults=[dict(field="mast_height_m", value=2, unit="m")],
        parameter_ranges=[dict(field="mast_height_m", min=2, max=2, allowed_values=None, unit="m")],
        threshold_definitions=[], assumption_ids=["synthetic-only"], algorithm_definitions=algorithms,
        configurations=[dict(id="fixture-" + k + "-config", kind=k, algorithm_id="fixture-" + k, parameters=[]) for k in KINDS])
    add("sources", "sources.json", "P01", "startup", "sources", sources=[])
    add("time", "time.json", "P01", "startup", "time_conversion",
        lsk_source_id=None, method="segmented_linear_et_offset", unix_origin_utc="1970-01-01T00:00:00Z",
        j2000_noon_unix_s=946728000, future_leap_second_assumption="Fictional offset; no real-time accuracy claim.",
        max_measured_error_s=None, segments=[dict(utc_start="2000-01-01T11:55:00Z", utc_end="2000-01-01T12:20:00Z",
            unix_start_s=946727700, unix_end_s=946729200,
            knots=[dict(unix_s=u, et_minus_unix_from_j2000_s=0) for u in (946727700, 946729200)])],
        positive_leaps=[], unsupported_intervals=[])
    add("sites", "sites.json", "P02", "startup", "sites", ("model",), sites=[dict(
        id=profile["site"]["id"], name="Fictional equatorial fixture", site_type="fictional",
        lat_deg=0, lon_deg=0, frame=FRAME, coordinate_source_id=None, coordinate_uncertainty_m=None,
        reference_meridian_deg=None, terrain_height_m=0, region_ids=[], default_mast_height_m=2,
        quality_flags=["synthetic"], limitations=["No measured coordinates or uncertainty; height is an invented reference-sphere value."])])
    add("content", "content/core.json", "P15", "startup", "content",
        labels=[dict(id="synthetic-label", text="Synthetic example — not lunar predictions", unit=None, state_code=None)],
        assumptions=[dict(id="synthetic-only", text="No physical safety, power, thermal or communications prediction. DSN, relays, link budgets and refraction excluded.",
                          applies_to_product_ids=[f"P{i:02}" for i in range(1, 16)], source_ids=[])],
        articles=[], guided_scenarios=[])
    add("summary", "validation/summary.json", "P14", "startup", "validation_summary",
        release_decision="synthetic_only", accepted_scopes=[],
        gate_statuses=[dict(gate_id=f"V{i:02}", status="not_run", report_file_id=None) for i in range(1, 13)],
        report_file_ids=[])
    settings = {k + "_config_id": "fixture-" + k + "-config" for k in ("horizon", "disc", "uncertainty")}
    settings.update(event_config_id="fixture-events-config", power_config_id=None,
                    sample_step_s=150, metric_method="sampled_left_hold")
    add("scenario", "scenarios/fixture-scenario.json", "P09", "selected", "scenario", ("model", "sites"),
        scenario_id="fixture-scenario", location=dict(site_id="fictional-equator", lat_deg=0, lon_deg=0, frame=FRAME, reference_meridian_deg=None),
        window=profile["window"], start_utc="2000-01-01T12:00:00Z", end_utc="2000-01-01T12:10:00Z",
        mast_height_m=2, horizon_mode="reference_sphere", terrain_model_id=None, geometry_id="fixture-geometry",
        profile_id="fixture-geometric", sun_visibility_mode="joint_disc_any", earth_visibility_mode="center_margin",
        earth_margin_deg=0, panel=None, power_dark_threshold_w=None, rules=[], algorithm_settings=settings,
        assumption_ids=["synthetic-only"])
    values = [1, 0, 0, 150000000, 0, 1, 0, 384000] * 9
    binary = struct.pack("<" + "f" * len(values), *values)
    result.append(("ephemeris-binary", "ephemeris/fixture.bin", "P03", "selected", [], "ephemeris", binary))
    add("ephemeris", "ephemeris/fixture.json", "P03", "selected", "ephemeris", ("ephemeris-binary", "model"),
        chunk_id="fixture-chunk", origin="moon_center", surface_frame=FRAME, frame_epoch="observation_et",
        profile_ids=["fixture-geometric"], grid=dict(t0_et_s=-300, step_s=150, count=9), usable_span=profile["window"],
        guard_samples_before=2, guard_samples_after=2, layout="interleaved_float32",
        channel_units=["1", "1", "1", "km", "1", "1", "1", "km"],
        interpolation="uniform_catmull_rom_components_then_normalize", binary_file_id="ephemeris-binary",
        arrays=[dict(name="fixture-geometric-states", dtype="float32", shape=[9, 8], byte_offset=0,
                     unit="mixed_channels", scale=1, offset=0, invalid_code=None)], decoded_bytes=len(binary),
        max_measured_angular_error_deg=None, max_measured_range_error_km=None)
    intervals = [dict(start_et_s=i * 150, end_et_s=(i + 1) * 150, state=state,
                      start_event_id=None, end_event_id=None, truncated_start=i == 0, truncated_end=i == 3,
                      quality_flags=["synthetic"] + (["missing_terrain"] if state == "unknown" else []))
                 for i, state in enumerate(("clear", "blocked", "uncertain", "unknown"))]
    add("events", "events/fixture-scenario.json", "P08", "selected", "events", ("scenario",),
        scenario_id="fixture-scenario", geometry_id="fixture-geometry", searched_span=profile["window"],
        search_status="partial", search_method="synthetic_left_hold", scan_step_s=150, root_tolerance_s=1,
        max_iterations=1, uncertainty_experiment_ids=[], events=[],
        tracks=[dict(id="sunlight", definition="Hand-authored sampled states, not predicted sunlight.",
                     method="sampled_left_hold", intervals=intervals)], quality_flags=["synthetic", "incomplete_search"])
    add("results", "results/fixture-scenario.json", "P09", "selected", "results", ("scenario", "events"),
        scenario_id="fixture-scenario", method="sampled_left_hold",
        metrics=[dict(id="sunlit_time_fraction", unit="1", estimate=dict(value=None, lower=0.25, upper=0.75,
            basis="numerical_only", experiment_ids=[], quality_flags=["synthetic", "missing_terrain"]),
            valid_duration_s=450, unknown_duration_s=150, truncated_start=True, truncated_end=True,
            quality_flags=["synthetic", "missing_terrain"])],
        track_totals=[dict(track_id="sunlight", clear_s=150, blocked_s=150, uncertain_s=150, unknown_s=150)],
        rule_results=[], outcome="metrics_only", quality_flags=["synthetic", "missing_terrain"])
    return result


def manifest_payload(identity, generator, files):
    return resource("manifest", identity, generated_at_utc=load_profile()["generated_at_utc"], generator=generator,
        entrypoints=dict(model="model", sources="sources", time_conversion="time", sites="sites",
                         terrain_index=None, validation_summary="summary", core_content="content", visuals=None),
        files=files, scenarios=[dict(id="fixture-scenario", file_id="scenario")], default_scenario_id="fixture-scenario",
        capabilities=[dict(id=f"feature-{i}", feature_ids=[f"F{i}"], enabled=False, dependency_file_ids=[],
                           required_gate_ids=[], accepted_scopes=[], reason="Synthetic contract fixture only; no scientific/application capability accepted.") for i in range(1, 17)],
        quality_flag_definitions=FLAGS)