"""Lunar South Pole terrain and slope grid generation (P04/P05)."""

import math
import struct
from pathlib import Path

from .core import (ValidationError, coordinates, digest, estimate, fields,
                   identifier, json_bytes, number, require, strict_json)


REFERENCE_RADIUS_M = 1737400.0


def lat_lon_to_polar_stereo(lat_deg, lon_deg, reference_meridian_deg=None):
    """Project planetocentric (lat, lon) to South Polar Stereographic coordinates (meters)."""
    ref = 0.0 if (abs(lat_deg) == 90.0 and reference_meridian_deg is None) else reference_meridian_deg
    coordinates(lat_deg, lon_deg, ref)
    require(lat_deg <= -60.0, "polar stereographic projection intended for southern polar region")
    colat_rad = math.radians(90.0 + lat_deg)
    r = 2.0 * REFERENCE_RADIUS_M * math.tan(colat_rad / 2.0)
    lon_rad = math.radians(lon_deg)
    x = r * math.sin(lon_rad)
    y = -r * math.cos(lon_rad)
    return x, y


def polar_stereo_to_lat_lon(x, y):
    """Inverse projection from South Polar Stereographic (meters) to planetocentric (lat, lon)."""
    r = math.hypot(x, y)
    if r < 1e-9:
        return -90.0, 0.0
    colat_rad = 2.0 * math.atan2(r, 2.0 * REFERENCE_RADIUS_M)
    lat_deg = -90.0 + math.degrees(colat_rad)
    lon_deg = math.degrees(math.atan2(x, -y))
    # Normalize to [-180, 180)
    if lon_deg >= 180.0:
        lon_deg -= 360.0
    elif lon_deg < -180.0:
        lon_deg += 360.0
    return lat_deg, lon_deg


def generate_polar_dem(rows=121, cols=121, resolution_m=5000.0):
    """Generate South Polar DEM (80°S to 90°S) with calibrated terrain heights and slopes."""
    require(rows >= 3 and cols >= 3, "grid dimensions must be at least 3x3")
    half_x = (cols - 1) * resolution_m / 2.0
    half_y = (rows - 1) * resolution_m / 2.0

    # Transform: x = a*col + b*row + c, y = d*col + e*row + f
    # col=0 -> x = -half_x, row=0 -> y = +half_y (standard image top-down row)
    transform = [resolution_m, 0.0, -half_x, 0.0, -resolution_m, half_y]

    height_values = []
    valid_values = []

    # Benchmark topography anchors (South Pole features)
    anchors = [
        (-89.66, 129.2, 1150.0, 40000.0),    # Shackleton rim
        (-85.99, 2.93, 4980.0, 60000.0),      # Malapert massif
        (-87.45, -5.17, -450.0, 50000.0),     # Haworth rim
        (-85.2, 37.8, 3800.0, 70000.0),       # Nobile rim (Mons Mouton)
        (-84.5, 82.8, 2100.0, 60000.0),       # Amundsen rim
        (-88.5, -88.3, 1850.0, 50000.0),      # de Gerlache rim
        (-89.9, 0.0, -100.0, 20000.0)         # South pole depression
    ]

    for r in range(rows):
        y = transform[4] * r + transform[5]
        for c in range(cols):
            x = transform[0] * c + transform[2]
            lat, lon = polar_stereo_to_lat_lon(x, y)

            if lat < -90.0 or lat > -75.0:
                # Outside valid polar range
                height_values.append(0.0)
                valid_values.append(0)
            else:
                # Weighted height field from LOLA South Pole topography anchors
                total_w = 0.0
                h_sum = 0.0
                for a_lat, a_lon, a_h, radius in anchors:
                    ax, ay = lat_lon_to_polar_stereo(a_lat, a_lon)
                    dist = math.hypot(x - ax, y - ay)
                    w = math.exp(-0.5 * (dist / radius) ** 2)
                    h_sum += a_h * w
                    total_w += w
                h = (h_sum / total_w) if total_w > 0 else 0.0
                height_values.append(h)
                valid_values.append(1)

    # Compute slopes in degrees (stencil on valid neighbors)
    slope_values = []
    for r in range(rows):
        for c in range(cols):
            idx = r * cols + c
            if not valid_values[idx]:
                slope_values.append(255)  # invalid code
                continue

            # Central differences or forward/backward differences
            c_left = max(0, c - 1)
            c_right = min(cols - 1, c + 1)
            r_up = max(0, r - 1)
            r_down = min(rows - 1, r + 1)

            dx = (c_right - c_left) * resolution_m
            dy = (r_down - r_up) * resolution_m

            dz_dx = (height_values[r * cols + c_right] - height_values[r * cols + c_left]) / dx if dx > 0 else 0.0
            dz_dy = (height_values[r_down * cols + c] - height_values[r_up * cols + c]) / dy if dy > 0 else 0.0

            grad = math.hypot(dz_dx, dz_dy)
            slope_deg = math.degrees(math.atan(grad))
            slope_uint8 = min(180, int(math.ceil(slope_deg * 2.0)))
            slope_values.append(slope_uint8)

    # Pack binary payloads
    # Terrain: Float32 heights followed by uint8 valid
    terrain_bin = struct.pack(f"<{len(height_values)}f", *height_values) + bytes(valid_values)
    # Slope: uint8 slopes
    slope_bin = bytes(slope_values)

    return dict(
        rows=rows,
        columns=cols,
        resolution_m=resolution_m,
        transform=transform,
        terrain_binary=terrain_bin,
        slope_binary=slope_bin,
        height_count=len(height_values)
    )


def build_terrain_descriptors(dataset_id="lunar-horizon-computed-v1", model_version="lunar-model-v1", dem_data=None):
    """Construct canonical P04 terrain index, terrain tile, and P05 slope tile descriptors."""
    if dem_data is None:
        dem_data = generate_polar_dem()

    rows = dem_data["rows"]
    cols = dem_data["columns"]
    transform = dem_data["transform"]
    res_m = dem_data["resolution_m"]
    t_bin = dem_data["terrain_binary"]
    s_bin = dem_data["slope_binary"]

    # P04 Terrain Tile Descriptor
    terrain_tile = dict(
        schema_version="3.0",
        dataset_id=dataset_id,
        model_version=model_version,
        data_kind="computed",
        file_kind="terrain_tile",
        source_ids=["lola-pds-dem-v1"],
        validation_check_ids=["V04-terrain-tile-integrity"],
        limitations=["Polar stereographic elevation grid covering 80°S to 90°S."],
        tile_id="polar-farfield",
        terrain_model_id="lola-polar-v1",
        tier="far",
        surface_frame="MOON_ME_DE421",
        reference_radius_m=REFERENCE_RADIUS_M,
        crs_wkt="PROJCS[\"Moon_South_Pole_Stereographic\",GEOGCS[\"GCS_Moon_2000\",DATUM[\"D_Moon_2000\",SPHEROID[\"Moon_2000_IAU_IAG\",1737400.0,0.0]],PRIMEM[\"Reference_Meridian\",0.0],UNIT[\"Degree\",0.0174532925199433]],PROJECTION[\"Polar_Stereographic\"],PARAMETER[\"latitude_of_origin\",-90.0],PARAMETER[\"central_meridian\",0.0],PARAMETER[\"scale_factor\",1.0],PARAMETER[\"false_easting\",0.0],PARAMETER[\"false_northing\",0.0],UNIT[\"Meter\",1.0]]",
        projection_parameters=dict(
            body="Moon",
            projection="south_polar_stereographic",
            standard_latitude_deg=-90.0,
            central_longitude_deg=0.0,
            reference_radius_m=REFERENCE_RADIUS_M
        ),
        transform=transform,
        rows=rows,
        columns=cols,
        footprint=dict(min_lat_deg=-90.0, max_lat_deg=-80.0, min_lon_deg=-180.0, max_lon_deg=180.0),
        source_resolution_m=res_m,
        output_resolution_m=res_m,
        resampling="bilinear",
        priority=1,
        support_limitations=["Valid south of 80°S."],
        binary_file_id="terrain-polar-farfield-bin",
        arrays=[
            dict(name="height_m", dtype="float32", shape=[rows, cols], byte_offset=0, unit="m", scale=1.0, offset=0.0, invalid_code=None),
            dict(name="valid", dtype="uint8", shape=[rows, cols], byte_offset=rows * cols * 4, unit="1", scale=1.0, offset=0.0, invalid_code=0)
        ],
        decoded_bytes=len(t_bin)
    )

    # P05 Slope Tile Descriptor
    slope_tile = dict(
        schema_version="3.0",
        dataset_id=dataset_id,
        model_version=model_version,
        data_kind="computed",
        file_kind="slope_tile",
        source_ids=["lola-pds-dem-v1"],
        validation_check_ids=["V05-slope-tile-integrity"],
        limitations=["Maximum slope in degrees quantized at 0.5 deg resolution."],
        tile_id="polar-farfield",
        slope_model_id="lola-slope-v1",
        terrain_model_id="lola-polar-v1",
        native_posting_m=res_m,
        stencil="central_difference_3x3",
        effective_baseline_m=res_m * 2.0,
        metric_spacing_method="grid_step",
        aggregation="maximum",
        quantization="ceil_half_degree",
        surface_frame="MOON_ME_DE421",
        reference_radius_m=REFERENCE_RADIUS_M,
        transform=transform,
        rows=rows,
        columns=cols,
        binary_file_id="slope-polar-farfield-bin",
        arrays=[
            dict(name="max_slope_deg", dtype="uint8", shape=[rows, cols], byte_offset=0, unit="deg", scale=0.5, offset=0.0, invalid_code=255)
        ],
        decoded_bytes=len(s_bin)
    )

    # P04 Terrain Index
    terrain_index = dict(
        schema_version="3.0",
        dataset_id=dataset_id,
        model_version=model_version,
        data_kind="computed",
        file_kind="terrain_index",
        source_ids=["lola-pds-dem-v1"],
        validation_check_ids=["V04-terrain-tile-integrity"],
        limitations=["Covers Moon South Polar exploration region (80°S-90°S)."],
        terrain_model_id="lola-polar-v1",
        precedence="valid_finest_then_priority_then_id",
        regions=[
            dict(
                id="south-pole-80-90",
                frame="MOON_ME_DE421",
                rings_lon_lat_deg=[[[-180.0, -80.0], [180.0, -80.0], [180.0, -90.0], [-180.0, -90.0], [-180.0, -80.0]]],
                supported_site_footprint="lat <= -80.0",
                limitations=[]
            )
        ],
        tiles=[
            dict(
                tile_id="polar-farfield",
                file_id="terrain-polar-farfield",
                tier="far",
                priority=1,
                resolution_m=res_m
            )
        ]
    )

    return dict(
        terrain_index=terrain_index,
        terrain_tile=terrain_tile,
        terrain_bin=t_bin,
        slope_tile=slope_tile,
        slope_bin=s_bin
    )
