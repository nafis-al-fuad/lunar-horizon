"""Topocentric transformation, ENU projections, and disc angles."""

import math

from .core import ValidationError, coordinates, enu_basis, number, require


MOON_RADIUS_KM = 1737.4
SUN_RADIUS_KM = 695700.0
EARTH_RADIUS_KM = 6371.0


def dot3(a, b):
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]


def norm3(a):
    return math.sqrt(dot3(a, a))


def unit3(a):
    mag = norm3(a)
    require(mag > 0, "zero-length vector cannot be normalized")
    return (a[0]/mag, a[1]/mag, a[2]/mag)


def topocentric_vector(target_center_km, lat_deg, lon_deg, height_km=0.0, reference_meridian_deg=None):
    """Compute vector from lunar surface observer to target in local ENU and Cartesian coordinates."""
    coordinates(lat_deg, lon_deg, reference_meridian_deg)
    number(height_km, "height_km")
    require(len(target_center_km) == 3, "target_center_km must have 3 coordinates")
    for c in target_center_km:
        number(c)

    east, north, up = enu_basis(lat_deg, lon_deg, reference_meridian_deg)
    r_obs_km = MOON_RADIUS_KM + height_km
    obs_cartesian = (r_obs_km * up[0], r_obs_km * up[1], r_obs_km * up[2])

    topo_cartesian = (
        target_center_km[0] - obs_cartesian[0],
        target_center_km[1] - obs_cartesian[1],
        target_center_km[2] - obs_cartesian[2],
    )
    range_km = norm3(topo_cartesian)
    require(range_km > 0, "target distance must be positive")

    x = dot3(topo_cartesian, east)
    y = dot3(topo_cartesian, north)
    z = dot3(topo_cartesian, up)

    horiz_dist = math.sqrt(x*x + y*y)
    el_rad = math.atan2(z, horiz_dist)
    az_rad = math.atan2(x, y) % (2.0 * math.pi)

    el_deg = math.degrees(el_rad)
    az_deg = math.degrees(az_rad) % 360.0

    return dict(
        azimuth_deg=az_deg,
        elevation_deg=el_deg,
        range_km=range_km,
        enu_km=(x, y, z),
        direction_unit=unit3(topo_cartesian),
        observer_cartesian_km=obs_cartesian
    )


def target_angular_radius(body_radius_km, distance_km):
    """Angular semi-diameter of spherical body in degrees."""
    require(distance_km > body_radius_km, "distance must be greater than body radius")
    return math.degrees(math.asin(body_radius_km / distance_km))


def eclipse_geometry(sun_dir_unit, earth_dir_unit, sun_radius_deg, earth_radius_deg):
    """Calculate topocentric solar/lunar eclipse state and unocculted solar fraction."""
    cos_sep = max(-1.0, min(1.0, dot3(sun_dir_unit, earth_dir_unit)))
    sep_deg = math.degrees(math.acos(cos_sep))

    r_s = sun_radius_deg
    r_e = earth_radius_deg

    if sep_deg >= r_s + r_e:
        return dict(eclipse_state="none", separation_deg=sep_deg, unocculted_fraction=1.0)
    elif sep_deg <= abs(r_e - r_s):
        if r_e >= r_s:
            # Total eclipse: Earth completely covers Sun
            return dict(eclipse_state="total", separation_deg=sep_deg, unocculted_fraction=0.0)
        else:
            # Annular eclipse
            frac = 1.0 - (r_e * r_e) / (r_s * r_s)
            return dict(eclipse_state="partial", separation_deg=sep_deg, unocculted_fraction=max(0.0, frac))
    else:
        # Partial eclipse: circle intersection area
        d = sep_deg
        alpha = math.acos((d*d + r_s*r_s - r_e*r_e) / (2.0 * d * r_s))
        beta = math.acos((d*d + r_e*r_e - r_s*r_s) / (2.0 * d * r_e))
        overlap_area = (
            r_s*r_s * alpha + r_e*r_e * beta -
            0.5 * math.sqrt(max(0.0, (-d + r_s + r_e) * (d + r_s - r_e) * (d - r_s + r_e) * (d + r_s + r_e)))
        )
        sun_area = math.pi * r_s * r_s
        unocculted = max(0.0, min(1.0, 1.0 - (overlap_area / sun_area)))
        return dict(eclipse_state="partial", separation_deg=sep_deg, unocculted_fraction=unocculted)


def earth_phase(sun_dir_unit, earth_dir_unit):
    """Compute Earth phase angle and illuminated fraction as seen from lunar observer."""
    cos_elong = max(-1.0, min(1.0, dot3(sun_dir_unit, earth_dir_unit)))
    elong_rad = math.acos(cos_elong)
    # Phase angle is angle Sun-Earth-Moon
    phase_rad = math.pi - elong_rad
    phase_deg = math.degrees(phase_rad)
    illuminated_fraction = (1.0 + math.cos(phase_rad)) / 2.0
    return dict(
        phase_angle_deg=phase_deg,
        illuminated_fraction=illuminated_fraction
    )
