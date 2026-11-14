"""Horizon mask generation and strict P06 validation."""

import math

from .core import (ValidationError, coordinates, estimate, fields, identifier,
                   json_bytes, number, require, strict_json)


REFERENCE_RADIUS_M = 1737400.0


def make_estimate(value, lower=None, upper=None, basis="supported_bound", flags=None):
    if lower is None and upper is None:
        lower = value
        upper = value
    est = dict(
        value=value,
        lower=lower,
        upper=upper,
        basis=basis,
        experiment_ids=[],
        quality_flags=flags or []
    )
    estimate(est)
    return est


def sphere_horizon_bins(lat_deg, lon_deg, mast_height_m=2.0, terrain_height_m=0.0, num_bins=720):
    """Compute uniform spherical dip horizon bins for smooth sphere."""
    coordinates(lat_deg, lon_deg)
    number(mast_height_m, "mast_height_m")
    number(terrain_height_m, "terrain_height_m")
    require(num_bins >= 3, "minimum 3 horizon bins required")

    h_total = max(0.0, terrain_height_m + mast_height_m)
    r = REFERENCE_RADIUS_M
    if h_total > 0:
        dip_rad = math.acos(r / (r + h_total))
        elevation_deg = -math.degrees(dip_rad)
    else:
        elevation_deg = 0.0

    step_deg = 360.0 / num_bins
    bins = []
    for i in range(num_bins):
        az = i * step_deg
        est = make_estimate(elevation_deg, basis="supported_bound")
        bins.append(dict(
            azimuth_deg=az,
            elevation=est,
            valid=True,
            quality_flags=["analytic_sphere"]
        ))
    return bins


def build_horizon_payload(
    geometry_id,
    site_id,
    lat_deg,
    lon_deg,
    mast_height_m=2.0,
    terrain_height_m=0.0,
    reference_meridian_deg=None,
    horizon_mode="reference_sphere",
    terrain_model_id=None,
    custom_bins=None,
    num_bins=720
):
    """Construct and validate a P06 horizon resource dictionary."""
    identifier(geometry_id)
    coordinates(lat_deg, lon_deg, reference_meridian_deg)
    number(mast_height_m, "mast_height_m")
    require(mast_height_m >= 0, "mast_height_m must be nonnegative")
    number(terrain_height_m, "terrain_height_m")
    require(horizon_mode in ("reference_sphere", "terrain"), f"unsupported horizon mode: {horizon_mode}")

    if horizon_mode == "reference_sphere":
        require(terrain_model_id is None, "terrain_model_id must be null for reference_sphere mode")
        bins = custom_bins or sphere_horizon_bins(lat_deg, lon_deg, mast_height_m, terrain_height_m, num_bins)
        processing = dict(
            algorithm_id="analytic-sphere-dip-v1",
            azimuth_step_deg=360.0 / len(bins),
            radial_step_description="analytic curvature dip angle",
            maximum_range_m=None,
            near_observer_method="none",
            curvature_method="exact_sphere_radius_1737400m",
            interpolation="circular_linear_valid_neighbors",
            uncertainty_experiment_ids=[]
        )
    else:
        require(terrain_model_id is not None, "terrain_model_id required for terrain mode")
        identifier(terrain_model_id)
        require(custom_bins is not None and len(custom_bins) >= 3, "custom_bins required for terrain horizon")
        bins = custom_bins
        processing = dict(
            algorithm_id="lola-dem-ray-march-v1",
            azimuth_step_deg=360.0 / len(bins),
            radial_step_description="uniform 50m radial steps to 100km horizon extent",
            maximum_range_m=100000.0,
            near_observer_method="skip_observer_cell",
            curvature_method="exact_sphere_radius_1737400m",
            interpolation="circular_linear_valid_neighbors",
            uncertainty_experiment_ids=[]
        )

    location = dict(
        site_id=site_id,
        lat_deg=lat_deg,
        lon_deg=lon_deg,
        frame="MOON_ME_DE421",
        reference_meridian_deg=reference_meridian_deg
    )

    payload = dict(
        schema_version="3.0",
        dataset_id="lunar-horizon-computed-v1",
        model_version="lunar-model-v1",
        data_kind="computed",
        file_kind="horizon",
        source_ids=["lola-pds-dem-v1"] if horizon_mode == "terrain" else [],
        validation_check_ids=["V06-horizon-mask-integrity"],
        limitations=[
            "Analytical geometric sphere curvature." if horizon_mode == "reference_sphere"
            else "Terrain horizon generated from LOLA polar digital elevation model."
        ],
        geometry_id=geometry_id,
        location=location,
        mast_height_m=mast_height_m,
        terrain_height_m=terrain_height_m,
        reference_radius_m=REFERENCE_RADIUS_M,
        terrain_model_id=terrain_model_id,
        horizon_mode=horizon_mode,
        processing=processing,
        bins=bins
    )
    validate_horizon_payload(payload)
    return payload


def validate_horizon_payload(payload):
    """Strict schema validation for P06 horizon resource."""
    require(isinstance(payload, dict), "horizon payload must be a dictionary")
    require(payload.get("schema_version") == "3.0", "unsupported schema version")
    require(payload.get("file_kind") == "horizon", "file_kind must be 'horizon'")
    identifier(payload["geometry_id"])

    loc = payload["location"]
    coordinates(loc["lat_deg"], loc["lon_deg"], loc["reference_meridian_deg"])
    require(loc["frame"] == "MOON_ME_DE421", "frame must be MOON_ME_DE421")

    number(payload["mast_height_m"], "mast_height_m")
    number(payload["terrain_height_m"], "terrain_height_m")
    require(payload["reference_radius_m"] == REFERENCE_RADIUS_M, "wrong reference radius")

    mode = payload["horizon_mode"]
    require(mode in ("reference_sphere", "terrain"), "invalid horizon_mode")

    bins = payload["bins"]
    require(isinstance(bins, list) and len(bins) >= 3, "minimum 3 bins required")
    m = len(bins)
    step = 360.0 / m

    for j, b in enumerate(bins):
        require(isinstance(b, dict), "bin must be a dict")
        fields(b, ("azimuth_deg", "elevation", "valid", "quality_flags"), "bin")
        expected_az = j * step
        require(abs(b["azimuth_deg"] - expected_az) < 1e-6, f"azimuth mismatch at bin {j}")
        require(isinstance(b["valid"], bool), "valid must be bool")
        if b["valid"]:
            estimate(b["elevation"])
            number(b["elevation"]["value"])


def query_horizon_elevation(horizon_payload, azimuth_deg):
    """Interpolate horizon elevation at query azimuth angle."""
    bins = horizon_payload["bins"]
    m = len(bins)
    step = 360.0 / m
    norm_az = azimuth_deg % 360.0
    idx_float = norm_az / step
    idx0 = int(math.floor(idx_float)) % m
    idx1 = (idx0 + 1) % m
    frac = idx_float - math.floor(idx_float)

    b0, b1 = bins[idx0], bins[idx1]
    require(b0["valid"] and b1["valid"], "cannot interpolate across invalid horizon bins")
    e0 = b0["elevation"]["value"]
    e1 = b1["elevation"]["value"]
    return (1.0 - frac) * e0 + frac * e1
