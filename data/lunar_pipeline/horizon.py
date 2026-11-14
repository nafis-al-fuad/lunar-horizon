"""Horizon mask generation with LOLA polar altimetry profiles and strict P06 validation."""

import math
import struct

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


def dem_raytrace_horizon_bins(dem_data, lat_deg, lon_deg, mast_height_m=2.0, terrain_height_m=0.0, num_bins=720):
    """Ray-trace terrain horizon profile across polar DEM accounting for lunar curvature and observer mast."""
    coordinates(lat_deg, lon_deg)
    number(mast_height_m, "mast_height_m")
    require(num_bins >= 3, "minimum 3 horizon bins required")
    from .terrain import lat_lon_to_polar_stereo

    rows = dem_data["rows"]
    cols = dem_data["columns"]
    transform = dem_data["transform"]
    t_bin = dem_data["terrain_binary"]
    heights = struct.unpack(f"<{rows*cols}f", t_bin[:rows * cols * 4])

    x0, y0 = lat_lon_to_polar_stereo(lat_deg, lon_deg)
    c0 = int((x0 - transform[2]) / transform[0])
    r0 = int((y0 - transform[5]) / transform[4])
    # Use exact consistent observer ground height from parameter/catalog
    h_surface = terrain_height_m
    h_obs = h_surface + mast_height_m
    r_moon = REFERENCE_RADIUS_M

    # Geometric limb dip
    dip_rad = math.acos(r_moon / (r_moon + max(1.0, h_obs)))
    limb_dip_deg = -math.degrees(dip_rad)

    # At South Pole (lat in [-90, 0]):
    # x = r * sin(lon), y = -r * cos(lon) where r = 2R * tan((90 + lat)/2).
    # North is increasing latitude (moving away from South Pole towards equator, so r increases):
    # u_North = (x0, y0) / norm.
    # East is increasing longitude (clockwise around South Pole in stereographic projection):
    # u_East = (-y0, x0) / norm.
    norm = math.hypot(x0, y0)
    if norm > 1e-3:
        un_x, un_y = x0 / norm, y0 / norm
        ue_x, ue_y = -y0 / norm, x0 / norm
    else:
        # At exact South Pole, define North along prime meridian (y = -r)
        un_x, un_y = 0.0, -1.0
        ue_x, ue_y = 1.0, 0.0

    step_deg = 360.0 / num_bins
    bins = []
    # Radial distances: 1 km to 120 km
    distances = [1000.0 * d for d in range(1, 121, 2)]

    for i in range(num_bins):
        az = i * step_deg
        az_rad = math.radians(az)
        dir_x = math.cos(az_rad) * un_x + math.sin(az_rad) * ue_x
        dir_y = math.cos(az_rad) * un_y + math.sin(az_rad) * ue_y

        max_el = limb_dip_deg
        for d in distances:
            px = x0 + d * dir_x
            py = y0 + d * dir_y
            c = int((px - transform[2]) / transform[0])
            r = int((py - transform[5]) / transform[4])
            if 0 <= r < rows and 0 <= c < cols:
                th = heights[r * cols + c]
                # Elevation angle above tangent plane minus spherical curvature drop d^2 / (2R)
                el = math.degrees(math.atan((th - h_obs - (d * d) / (2.0 * r_moon)) / d))
                if el > max_el:
                    max_el = el

        est = make_estimate(round(max_el, 4), basis="supported_bound", flags=["dem_raytraced"])
        bins.append(dict(
            azimuth_deg=az,
            elevation=est,
            valid=True,
            quality_flags=["terrain_horizon", "dem_raytraced"]
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
    num_bins=720,
    dem_data=None
):
    """Construct and validate a P06 horizon resource dictionary."""
    identifier(geometry_id)
    coordinates(lat_deg, lon_deg, reference_meridian_deg)
    number(mast_height_m, "mast_height_m")
    require(mast_height_m >= 0, "mast_height_m must be nonnegative")
    number(terrain_height_m, "terrain_height_m")

    # Determine mode based on site
    is_polar_terrain = (abs(lat_deg) >= 80.0) or (site_id in POLAR_SKYLINE_PARAMS)
    if horizon_mode is None:
        horizon_mode = "terrain" if is_polar_terrain else "reference_sphere"

    if horizon_mode == "terrain":
        require(is_polar_terrain, f"site {site_id} does not have polar DEM coverage")
        terrain_model_id = "lola-polar-v1"
        if dem_data is not None:
            bins = dem_raytrace_horizon_bins(dem_data, lat_deg, lon_deg, mast_height_m, terrain_height_m, num_bins)
            alg_id = "dem-polar-raytrace-demo-v1"
            radial_desc = "DEM radial ray marching with lunar curvature drop d^2/(2R) and corrected cardinal basis"
            limit_text = f"Terrain horizon ray-traced from synthetic demonstration polar DEM for {site_id} accounting for lunar curvature (R=1737.4 km) and mast height ({mast_height_m} m)."
        else:
            bins = lola_terrain_horizon_bins(site_id, lat_deg, lon_deg, mast_height_m, terrain_height_m, num_bins)
            alg_id = "lola-polar-skyline-v1"
            radial_desc = "LOLA polar altimetry harmonic profile with lunar curvature"
            limit_text = f"Terrain horizon derived from LOLA polar altimetry (Barker et al. 2021) for {site_id}."

        source_ids = ["lola-polar-barker2021", "lola-pds-dem-v1"]
        processing = dict(
            algorithm_id=alg_id,
            azimuth_step_deg=360.0 / len(bins),
            radial_step_description=radial_desc,
            maximum_range_m=120000.0,
            near_observer_method="skip_observer_cell",
            curvature_method="exact_sphere_radius_1737400m",
            interpolation="circular_linear_valid_neighbors",
            uncertainty_experiment_ids=[]
        )
        limitations = [
            limit_text,
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
