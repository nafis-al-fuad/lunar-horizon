"""Little-endian arrays and bounded piecewise-affine time conversion."""

import math
import struct

from .core import fields, integer, number, require, time_span, unix_utc, utc_unix


DTYPES = {"float32": ("f", 4), "float64": ("d", 8), "int16": ("h", 2), "uint8": ("B", 1)}


def decode_arrays(descriptor, payload):
    """Decode storage only. Call mask_values before using nullable physical values."""
    require(len(payload) == integer(descriptor["decoded_bytes"]), "binary length mismatch")
    require(type(descriptor["arrays"]) is list and descriptor["arrays"], "arrays required")
    used = bytearray(len(payload))
    result = {}
    for array in descriptor["arrays"]:
        fields(array, ("name", "dtype", "shape", "byte_offset", "unit", "scale", "offset", "invalid_code"), "array")
        name = array["name"]
        require(isinstance(name, str) and name and name not in result, "duplicate/invalid array name")
        require(array["dtype"] in DTYPES, "unsupported dtype")
        code, width = DTYPES[array["dtype"]]
        shape = array["shape"]
        require(type(shape) is list and 1 <= len(shape) <= 4, "invalid array shape")
        for dimension in shape:
            integer(dimension, "dimension", 1)
        count = math.prod(shape)
        start = integer(array["byte_offset"], "byte offset")
        end = start + count * width
        require(start % width == 0 and end <= len(payload), "unaligned or out-of-bounds array")
        require(not any(used[start:end]), "overlapping arrays")
        used[start:end] = b"\1" * (end - start)
        scale, offset = number(array["scale"]), number(array["offset"])
        require(scale > 0 and isinstance(array["unit"], str) and array["unit"], "invalid scale or unit")
        invalid = array["invalid_code"]
        if code in "fd":
            require(invalid is None, "floating arrays require a separate validity mask")
        elif invalid is not None:
            require(type(invalid) is int, "invalid code must be integer")
            require((-32768 <= invalid <= 32767) if code == "h" else (0 <= invalid <= 255), "invalid code outside dtype")
        values = [item[0] for item in struct.iter_unpack("<" + code, payload[start:end])]
        for value in values:
            number(value, "stored value")
            number(value * scale + offset, "decoded value")
        result[name] = [None if value == invalid else value * scale + offset for value in values]
    require(all(flag or byte == 0 for flag, byte in zip(used, payload)), "nonzero alignment padding")
    return result


def mask_values(values, valid):
    require(len(values) == len(valid), "mask shape mismatch")
    require(all(type(v) in (int, float) and v in (0, 1) for v in valid), "mask must contain 0/1")
    for value, flag in zip(values, valid):
        number(value)
        require(flag or value == 0, "invalid floating slot must contain zero")
    return [value if flag else None for value, flag in zip(values, valid)]


class TimeConverter:
    """No extrapolation. Leap input rejected; listed positive leap output supported."""

    def __init__(self, resource):
        require(resource["method"] == "segmented_linear_et_offset", "unsupported time method")
        require(resource["unix_origin_utc"] == "1970-01-01T00:00:00Z", "unsupported Unix origin")
        require(resource["j2000_noon_unix_s"] == 946728000, "invalid J2000 origin")
        require(not resource["unsupported_intervals"], "foundation cannot load unsupported conversion intervals")
        self.pieces = []
        previous_unix = previous_et = -math.inf
        for segment in resource["segments"]:
            fields(segment, ("utc_start", "utc_end", "unix_start_s", "unix_end_s", "knots"), "time segment")
            start, end = utc_unix(segment["utc_start"]), utc_unix(segment["utc_end"])
            require(start == number(segment["unix_start_s"]) and end == number(segment["unix_end_s"]), "UTC/numeric boundary mismatch")
            require(previous_unix <= start < end, "unordered or overlapping UTC segments")
            knots = segment["knots"]
            require(len(knots) >= 2, "insufficient time knots")
            for knot in knots:
                fields(knot, ("unix_s", "et_minus_unix_from_j2000_s"), "time knot")
                number(knot["unix_s"])
                number(knot["et_minus_unix_from_j2000_s"])
            require(knots[0]["unix_s"] == start and knots[-1]["unix_s"] == end, "missing endpoint knots")
            for first, second in zip(knots, knots[1:]):
                u0, u1 = first["unix_s"], second["unix_s"]
                e0 = u0 - 946728000 + first["et_minus_unix_from_j2000_s"]
                e1 = u1 - 946728000 + second["et_minus_unix_from_j2000_s"]
                require(u0 < u1 and previous_et <= e0 < e1, "nonmonotonic time mapping")
                self.pieces.append((u0, u1, e0, e1))
                previous_et = e1
            previous_unix = end
        require(self.pieces, "no time coverage")
        self.leaps = resource["positive_leaps"]
        last_end = -math.inf
        for leap in self.leaps:
            fields(leap, ("utc_day", "et_start_s", "duration_s"), "positive leap")
            utc_unix(leap["utc_day"] + "T23:59:59Z")
            e = number(leap["et_start_s"])
            require(leap["duration_s"] == 1 and type(leap["duration_s"]) is not bool, "only one-second positive leaps supported")
            require(e >= last_end, "overlapping/unordered leaps")
            require(all(e + 1 <= p[2] or e >= p[3] for p in self.pieces), "leap overlaps ordinary mapping")
            boundary = utc_unix(leap["utc_day"] + "T23:59:59Z") + 1
            require(any(p[1] == boundary and p[3] == e for p in self.pieces), "missing pre-leap segment")
            require(any(p[0] == boundary and p[2] == e + 1 for p in self.pieces), "missing post-leap segment")
            last_end = e + 1

    def to_et(self, utc):
        unix = utc_unix(utc)
        for u0, u1, e0, e1 in self.pieces:
            if u0 <= unix < u1:
                return e0 + (unix - u0) * (e1 - e0) / (u1 - u0)
        raise ValueError("UTC outside conversion coverage")

    def to_utc(self, et):
        number(et)
        for leap in self.leaps:
            delta = et - leap["et_start_s"]
            if 0 <= delta < 1:
                # Truncate instead of rounding into a nonexistent 61st second.
                micros = int(delta * 1_000_000)
                fraction = f".{micros:06d}" if micros else ""
                return leap["utc_day"] + "T23:59:60" + fraction + "Z"
        for u0, u1, e0, e1 in self.pieces:
            if e0 <= et < e1:
                return unix_utc(u0 + (et - e0) * (u1 - u0) / (e1 - e0))
        raise ValueError("ET outside conversion coverage")


def validate_ephemeris(resource, payload):
    arrays = decode_arrays(resource, payload)
    require(resource["origin"] == "moon_center" and resource["frame_epoch"] == "observation_et", "unsupported ephemeris frame")
    require(resource["layout"] == "interleaved_float32", "foundation supports only interleaved ephemeris")
    require(resource["interpolation"] == "uniform_catmull_rom_components_then_normalize", "unsupported interpolation")
    fields(resource["grid"], ("t0_et_s", "step_s", "count"), "grid")
    grid = resource["grid"]
    t0, step, count = number(grid["t0_et_s"]), number(grid["step_s"]), integer(grid["count"], "count", 6)
    require(step > 0, "invalid ephemeris step")
    start, end = time_span(resource["usable_span"])
    before = integer(resource["guard_samples_before"], "leading guards", 2)
    after = integer(resource["guard_samples_after"], "trailing guards", 2)
    require(start == t0 + before * step and end == t0 + (count - 1 - after) * step, "incorrect guard coverage")
    require(resource["channel_units"] == ["1", "1", "1", "km", "1", "1", "1", "km"], "channel units mismatch")
    profiles = resource["profile_ids"]
    require(profiles and len(profiles) == len(set(profiles)), "invalid profile list")
    require(set(arrays) == {p + "-states" for p in profiles}, "profile array mismatch")
    for descriptor in resource["arrays"]:
        require(descriptor["dtype"] == "float32" and descriptor["shape"] == [count, 8], "ephemeris storage mismatch")
        require(descriptor["scale"] == 1 and descriptor["offset"] == 0 and descriptor["unit"] == "mixed_channels", "ephemeris quantization unsupported")
        values = arrays[descriptor["name"]]
        for row in range(count):
            for column in (0, 4):
                vector = values[row * 8 + column:row * 8 + column + 3]
                require(abs(sum(v * v for v in vector) - 1) <= 1e-6, "stored direction is not unit length")
                require(values[row * 8 + column + 3] > 0, "nonpositive range")
    return arrays