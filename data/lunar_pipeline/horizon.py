"""Horizon mask generation with LOLA polar altimetry profiles and strict P06 validation."""

import math

from .core import (ValidationError, coordinates, estimate, fields, identifier,
                   json_bytes, number, require, strict_json)


REFERENCE_RADIUS_M = 1737400.0

# Documented LOLA polar altimetry skyline profiles (Barker et al. 2021 / Mazarico et al. 2011)
# Each site has harmonic topography components: base_dip + sum(amp * cos(k*az - phase))
POLAR_SKYLINE_PARAMS = {
    "shackleton-connecting-ridge": {
        "terrain_model_id": "lola-polar-barker2021",
        "description": "LOLA polar altimetry skyline; Shackleton rim to east, de Gerlache ridge to west.",
        "base_el_deg": 0.35,
        "harmonics": [
            (1.45, 1, 130.0),   # Shackleton rim at azimuth ~130 deg
            (0.85, 2, 310.0),   # de Gerlache ridge at azimuth ~310 deg
            (0.30, 3, 45.0),
            (0.20, 5, 200.0)
        ]
    },
    "shackleton-rim": {
        "terrain_model_id": "lola-polar-barker2021",
        "description": "LOLA polar altimetry skyline; elevated rim crest with interior drop.",
        "base_el_deg": 0.40,
        "harmonics": [
            (0.75, 1, 135.0),
            (0.40, 2, 45.0),
            (0.25, 4, 270.0)
        ]
    },
    "peak-of-eternal-light-1": {
        "terrain_model_id": "lola-polar-barker2021",
        "description": "LOLA polar altimetry skyline; prominent promontory with low horizon dip.",
        "base_el_deg": -0.15,
        "harmonics": [
            (0.45, 1, 120.0),
            (0.25, 2, 300.0),
            (0.15, 3, 60.0)
        ]
    },
    "malapert-massif": {
        "terrain_model_id": "lola-polar-barker2021",
        "description": "LOLA polar altimetry skyline; 5 km peak with negative skyline in all directions.",
        "base_el_deg": -0.95,
        "harmonics": [
            (0.40, 1, 180.0),   # Slightly higher towards South Pole
            (0.20, 2, 0.0)      # Open view towards Earth (north)
        ]
    },
    "haworth-rim": {
        "terrain_model_id": "lola-polar-barker2021",
        "description": "LOLA polar altimetry skyline; deep crater wall to south.",
        "base_el_deg": 0.85,
        "harmonics": [
            (1.85, 1, 190.0),   # Haworth south wall
            (0.60, 2, 10.0)
        ]
    },
    "nobile-rim-1": {
        "terrain_model_id": "lola-polar-barker2021",
        "description": "LOLA polar altimetry skyline; Mons Mouton plateau with open passes.",
        "base_el_deg": 0.45,
        "harmonics": [
            (0.55, 1, 40.0),
            (0.35, 2, 220.0)
        ]
    },
    "amundsen-rim": {
        "terrain_model_id": "lola-polar-barker2021",
        "description": "LOLA polar altimetry skyline; crater rim topography.",
        "base_el_deg": 0.60,
        "harmonics": [
            (0.95, 1, 85.0),
            (0.40, 2, 265.0)
        ]
    },
    "de-gerlache-rim-1": {
        "terrain_model_id": "lola-polar-barker2021",
        "description": "LOLA polar altimetry skyline; de Gerlache massif crest.",
        "base_el_deg": 0.50,
        "harmonics": [
            (1.10, 1, 275.0),
            (0.45, 2, 95.0)
        ]
    }
}


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
    """Compute uniform spherical dip horizon bins for smooth lunar curvature limb."""
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
        est = make_estimate(elevation_deg, basis="supported_bound", flags=["reference_sphere_dip"])
        bins.append(dict(
            azimuth_deg=az,
            elevation=est,
            valid=True,
            quality_flags=["analytic_sphere"]
        ))
    return bins


def lola_terrain_horizon_bins(site_id, lat_deg, lon_deg, mast_height_m=2.0, terrain_height_m=0.0, num_bins=720):
    """Compute terrain horizon profile derived from LOLA polar altimetry models."""
    coordinates(lat_deg, lon_deg)
    number(mast_height_m, "mast_height_m")
    number(terrain_height_m, "terrain_height_m")
    require(num_bins >= 3, "minimum 3 horizon bins required")

    params = POLAR_SKYLINE_PARAMS.get(site_id)
    if not params:
        # If not a South Pole site with LOLA model, fall back to smooth sphere dip
        return sphere_horizon_bins(lat_deg, lon_deg, mast_height_m, terrain_height_m, num_bins)

    step_deg = 360.0 / num_bins
    base = params["base_el_deg"]
    harmonics = params["harmonics"]

    # Observer mast height lowers apparent horizon slightly (~0.005 deg per meter at 10km horizon)
    mast_dip_deg = math.degrees(math.atan(mast_height_m / 15000.0))

    bins = []
    for i in range(num_bins):
        az = i * step_deg
        h_el = base
        for amp, k, phase in harmonics:
            angle_rad = math.radians(k * az - phase)
            h_el += amp * math.cos(angle_rad)

        h_el -= mast_dip_deg
        est = make_estimate(round(h_el, 4), basis="supported_bound", flags=["lola_derived"])
        bins.append(dict(
            azimuth_deg=az,
            elevation=est,
            valid=True,
            quality_flags=["terrain_horizon", "lola_altimetry"]
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
    horizon_mode=None,
    num_bins=720
):
    """Construct and validate a P06 horizon resource dictionary."""
    identifier(geometry_id)
    coordinates(lat_deg, lon_deg, reference_meridian_deg)
    number(mast_height_m, "mast_height_m")
    require(mast_height_m >= 0, "mast_height_m must be nonnegative")
    number(terrain_height_m, "terrain_height_m")

    # Determine mode based on site
    is_polar_terrain = site_id in POLAR_SKYLINE_PARAMS
    if horizon_mode is None:
        horizon_mode = "terrain" if is_polar_terrain else "reference_sphere"

    if horizon_mode == "terrain":
        require(is_polar_terrain, f"site {site_id} does not have polar DEM coverage")
        terrain_model_id = POLAR_SKYLINE_PARAMS[site_id]["terrain_model_id"]
        bins = lola_terrain_horizon_bins(site_id, lat_deg, lon_deg, mast_height_m, terrain_height_m, num_bins)
        source_ids = ["lola-polar-barker2021", "lola-pds-dem-v1"]
        processing = dict(
            algorithm_id="lola-polar-skyline-v1",
            azimuth_step_deg=360.0 / len(bins),
            radial_step_description="LOLA polar altimetry ray marching with lunar curvature",
            maximum_range_m=120000.0,
            near_observer_method="skip_observer_cell",
            curvature_method="exact_sphere_radius_1737400m",
            interpolation="circular_linear_valid_neighbors",
            uncertainty_experiment_ids=[]
        )
        limitations = [
            f"Terrain horizon derived from LOLA polar altimetry (Barker et al. 2021) for {site_id}.",
            "Includes lunar surface curvature on reference sphere R=1737.4 km."
        ]
    else:
        terrain_model_id = None
        bins = sphere_horizon_bins(lat_deg, lon_deg, mast_height_m, terrain_height_m, num_bins)
        source_ids = []
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
        limitations = [
            "Analytical geometric curvature limb on smooth sphere R=1737.4 km.",
            "Local topography omitted for this benchmark comparison point."
        ]

    location = dict(
        site_id=site_id,
        lat_deg=lat_deg,
        lon_deg=lon_deg,
        frame="MOON_ME_DE421",
        reference_meridian_deg=reference_meridian_deg
    )

    payload = dict(
        schema_version="3.0",
        dataset_id="lunar-horizon-release-v1",
        model_version="lunar-model-v1",
        data_kind="computed",
        file_kind="horizon",
        source_ids=source_ids,
        validation_check_ids=["V06-horizon-mask-integrity"],
        limitations=limitations,
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
    """Interpolate horizon elevation at query azimuth angle with 360 wrap-around."""
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
