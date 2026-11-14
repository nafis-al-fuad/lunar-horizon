"""Dependency-free interpolation shared by the real-data producer and tests."""

import math

from .core import number, require, time_span


def catmull_rom(a, b, c, d, fraction):
    require(0 <= number(fraction) <= 1, "interpolation fraction outside cell")
    for value in (a, b, c, d):
        number(value)
    t = fraction
    return 0.5 * (2*b + (-a+c)*t + (2*a-5*b+4*c-d)*t*t + (-a+3*b-3*c+d)*t*t*t)


def interpolate(descriptor, values, et):
    """Return two direction/range rows; no extrapolation or rounded cache keys."""
    start, end = time_span(descriptor["usable_span"])
    require(start <= number(et) < end, "ET outside half-open chunk coverage")
    grid = descriptor["grid"]
    require(len(values) == grid["count"] * 8 and grid["step_s"] > 0, "invalid interpolation array")
    x = (et - grid["t0_et_s"]) / grid["step_s"]
    i = math.floor(x)
    require(1 <= i and i + 2 < grid["count"], "missing interpolation stencil")
    result = [catmull_rom(*(float(values[(i+j)*8+k]) for j in (-1, 0, 1, 2)), x-i) for k in range(8)]
    for k in (0, 4):
        norm = math.hypot(*result[k:k+3])
        require(norm > 0 and result[k+3] > 0, "invalid interpolated direction/range")
        result[k:k+3] = [v/norm for v in result[k:k+3]]
    return result


def position(row, offset=0):
    return [row[offset+j] * row[offset+3] for j in range(3)]


def angular_error(a, b):
    """atan2 is well conditioned at very small angular residuals, unlike acos."""
    require(len(a) == len(b) == 3, "three-component vectors required")
    for value in (*a, *b):
        require(math.isfinite(value), "nonfinite direction")
    require(math.hypot(*a) > 0 and math.hypot(*b) > 0, "zero direction")
    cross = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
    return math.degrees(math.atan2(math.hypot(*cross), sum(x*y for x, y in zip(a, b))))