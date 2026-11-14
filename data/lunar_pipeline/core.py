"""Strict serialization, paths, numeric conventions and interval accounting."""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath


class ValidationError(ValueError):
    """Malformed, unsupported or inconsistent input (fail closed)."""


def require(condition, message):
    if not condition:
        raise ValidationError(message)


def number(value, label="number"):
    require(type(value) in (int, float) and math.isfinite(value), f"{label}: finite number required")
    return value


def integer(value, label="integer", minimum=0):
    require(type(value) is int and value >= minimum, f"{label}: integer >= {minimum} required")
    return value


def identifier(value):
    require(isinstance(value, str) and re.fullmatch(r"[a-z0-9][a-z0-9-]*", value), "invalid identifier")
    return value


def fields(value, expected, label="object"):
    require(type(value) is dict and set(value) == set(expected), f"{label}: missing or unknown fields")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def strict_json(data):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, f"duplicate JSON key: {key}")
            result[key] = value
        return result

    def invalid(value):
        raise ValidationError(f"invalid JSON constant: {value}")

    def finite_tree(value):
        if type(value) is float:
            number(value)
        elif isinstance(value, dict):
            for child in value.values():
                finite_tree(child)
        elif isinstance(value, list):
            for child in value:
                finite_tree(child)

    try:
        result = json.loads(data.decode("utf-8"), object_pairs_hook=pairs, parse_constant=invalid)
        finite_tree(result)
        return result
    except (UnicodeError, ValueError, RecursionError) as exc:
        raise ValidationError(f"strict JSON rejected: {exc}") from exc


def safe_href(value):
    # Deliberately narrower than URL syntax: no escapes, platform aliases or raw inputs.
    require(isinstance(value, str) and re.fullmatch(r"[a-z0-9][a-z0-9/_.-]*", value), "unsafe href")
    parts = PurePosixPath(value).parts
    require(value == "/".join(parts) and all(p not in (".", "..") for p in parts), "unsafe path segments")
    reserved = {"con", "prn", "aux", "nul"} | {f"{p}{i}" for p in ("com", "lpt") for i in range(1, 10)}
    require(all(not p.endswith(".") and p.split(".")[0] not in reserved for p in parts), "Windows path alias")
    require(not any(p in {"raw", "work", ".venv"} for p in parts), "offline path prohibited")
    return value


def contained_file(root, href):
    root = Path(root).resolve()
    current = root
    for part in safe_href(href).split("/"):
        current = current / part
        require(not current.is_symlink() and not current.is_junction(), "linked publication path prohibited")
    require(current.resolve().is_relative_to(root), "file escapes root")
    return current


def disjoint_roots(*roots):
    paths = [Path(p).resolve() for p in roots]
    for index, first in enumerate(paths):
        for second in paths[index + 1:]:
            require(not first.is_relative_to(second) and not second.is_relative_to(first), "storage roots must be disjoint")
    return paths


UTC_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z")


def utc_unix(value):
    require(isinstance(value, str) and UTC_PATTERN.fullmatch(value), "UTC must be an ISO Z date (<=6 fractional digits)")
    require(value[17:19] != "60", "leap-second input is unsupported; use ET")
    try:
        return datetime.fromisoformat(value[:-1] + "+00:00").timestamp()
    except (ValueError, OverflowError, OSError) as exc:
        raise ValidationError("invalid UTC calendar date") from exc


def unix_utc(value):
    number(value)
    return datetime.fromtimestamp(value, timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def time_span(value):
    fields(value, ("start_et_s", "end_et_s"), "TimeSpan")
    start, end = number(value["start_et_s"]), number(value["end_et_s"])
    require(start < end, "empty or reversed time span")
    return start, end


def coordinates(latitude, longitude, reference_meridian=None):
    require(-90 <= number(latitude) <= 90, "latitude outside [-90,90]")
    require(-180 <= number(longitude) < 180, "longitude outside [-180,180)")
    if abs(latitude) == 90:
        require(reference_meridian is not None, "pole requires reference meridian")
        require(-180 <= number(reference_meridian) < 180, "invalid reference meridian")
    else:
        require(reference_meridian is None, "reference meridian only allowed at poles")


def enu_basis(latitude, longitude, reference_meridian=None):
    coordinates(latitude, longitude, reference_meridian)
    lat = math.radians(latitude)
    lon = math.radians(reference_meridian if abs(latitude) == 90 else longitude)
    east = (-math.sin(lon), math.cos(lon), 0.0)
    north = (-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat))
    up = (math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat))
    return east, north, up


def estimate(value):
    fields(value, ("value", "lower", "upper", "basis", "experiment_ids", "quality_flags"), "Estimate")
    require(value["basis"] in {"supported_bound", "sensitivity", "numerical_only", "unavailable"}, "unknown estimate basis")
    for name in ("value", "lower", "upper"):
        if value[name] is not None:
            number(value[name], name)
    low, high = value["lower"], value["upper"]
    require((low is None) == (high is None), "bounds must be paired")
    if low is not None:
        require(low <= high, "reversed bounds")
        if value["value"] is not None:
            require(low <= value["value"] <= high, "estimate outside bounds")
    if value["basis"] == "unavailable":
        require(low is None, "unavailable estimate cannot have bounds")
    require(type(value["experiment_ids"]) is list and type(value["quality_flags"]) is list, "estimate lists required")
    require(value["value"] is not None or bool(value["quality_flags"]), "null estimate requires reason flag")


STATES = ("clear", "blocked", "uncertain", "unknown")


def track_totals(intervals, window):
    start, end = time_span(window)
    cursor = start
    totals = dict.fromkeys(STATES, 0)
    require(isinstance(intervals, list) and intervals, "empty interval partition")
    for interval in intervals:
        a, b = number(interval["start_et_s"]), number(interval["end_et_s"])
        require(a == cursor and a < b <= end, "interval gap, overlap or invalid boundary")
        state = interval["state"]
        require(state in STATES, "invalid state")
        totals[state] += b - a
        cursor = b
    require(cursor == end, "incomplete interval partition")
    return totals


def sampled_totals(times, states):
    require(len(times) == len(states) and len(times) >= 2, "sample lengths differ or too short")
    for value in times:
        number(value)
    require(all(s in STATES for s in states), "invalid sampled state")
    intervals = [dict(start_et_s=a, end_et_s=b, state=s) for a, b, s in zip(times, times[1:], states)]
    return track_totals(intervals, dict(start_et_s=times[0], end_et_s=times[-1]))