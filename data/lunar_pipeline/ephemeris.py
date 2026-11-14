"""Offline real ephemeris preview. Scientific imports are lazy, never foundation dependencies."""

import math
import platform
import random
from contextlib import contextmanager

from .core import (contained_file, enu_basis, integer, json_bytes, number, require,
                   strict_json, unix_utc, utc_unix)
from .encoding import TimeConverter, validate_ephemeris
from .ephemeris_math import angular_error, interpolate, position
from .fixture import PROJECT
from .sources import verify_source


PROFILE = PROJECT / "profiles" / "ephemeris.json"
SOURCE_LOCK = PROJECT / "profiles" / "ephemeris-sources.json"
TARGETS = ("SUN", "EARTH")
PROFILES = ("geometric", "apparent")
BENCHMARKS = ((-90, 0, 0), (-85, 45, None), (0, 0, None), (0, 90, None), (0, -180, None))


def load_config():
    config = strict_json(PROFILE.read_bytes())
    require(config["profile_id"] == "ephemeris-preview-v1", "unsupported real profile")
    require(config["surface_frame"] == "MOON_ME_DE421", "unreviewed frame")
    require(config["profiles"] == dict(geometric="NONE", apparent="LT+S"), "unreviewed corrections")
    require(config["step_s"] == 10800 and config["chunk_intervals"] == 240, "unreviewed sampling")
    return config


def dependencies():
    import numpy as np
    import spiceypy as spice
    require(platform.python_version() == "3.12.2", "use CPython 3.12.2")
    require(np.__version__ == "2.2.6" and spice.__version__ == "7.0.0", "use pinned scientific dependencies")
    require(spice.tkvrsn("TOOLKIT") == "CSPICE_N0067", "unreviewed CSPICE version")
    return np, spice


@contextmanager
def kernels(raw_root):
    _, spice = dependencies()
    lock = strict_json(SOURCE_LOCK.read_bytes())
    require(lock["format"] == "ephemeris-kernel-lock-v1", "unsupported source lock")
    require([s["id"] for s in lock["sources"]] == ["naif0012", "pck00011", "moon-080317", "moon-pa-de421", "de440s"], "unreviewed kernel load order")
    require(spice.ktotal("ALL") == 0, "kernel pool must be empty; use dedicated process")
    evidence = []
    try:
        for spec in lock["sources"]:
            path = contained_file(raw_root, spec["id"] + "/" + spec["filename"])
            verify_source(path, spec["bytes"], spec["sha256"])
            require(path.with_name(path.name + ".source.json").read_bytes() == json_bytes(spec), "source evidence mismatch")
            receipt = strict_json((path.parent / "acquisition.json").read_bytes())
            require(receipt["sha256"] == spec["sha256"] and receipt["bytes"] == spec["bytes"], "acquisition receipt mismatch")
            spice.furnsh(str(path))
            item = dict(specification=spec, acquisition=receipt)
            if spec["id"] == "de440s":
                item["bodies"] = [int(v) for v in spice.spkobj(str(path))]
                item["coverage_et_s"] = {str(body): list(spice.spkcov(str(path), body)) for body in (3, 10, 301, 399)}
            if spec["id"] == "moon-pa-de421":
                ids = spice.utils.support_types.SPICEINT_CELL(100)
                spice.pckfrm(str(path), ids)
                item["orientation_ids"] = [int(v) for v in ids]
                require(31006 in item["orientation_ids"], "missing DE421 orientation")
                item["coverage_et_s"] = {"31006": list(spice.pckcov(str(path), 31006))}
            evidence.append(item)
        require(spice.namfrm("MOON_ME_DE421") == 31007, "frame realization mismatch")
        yield spice, evidence
    finally:
        spice.kclear()


def check_coverage(evidence, start, end):
    # One hour additionally covers retarded target epochs (Sun light time ~500 s).
    expected = {"moon-pa-de421": {"31006"}, "de440s": {"3", "10", "301", "399"}}
    require({item["specification"]["id"] for item in evidence if "coverage_et_s" in item} == set(expected), "missing coverage evidence")
    for item in evidence:
        if item["specification"]["id"] in expected:
            require(set(item["coverage_et_s"]) == expected[item["specification"]["id"]], "missing connected body coverage")
        for body, bounds in item.get("coverage_et_s", {}).items():
            require(any(a <= start-3600 and end+3600 <= b for a, b in zip(bounds[::2], bounds[1::2])),
                    "insufficient connected kernel coverage: " + body)


def state_row(spice, config, et, profile):
    rotation = spice.pxform("J2000", config["surface_frame"], float(et))
    row = []
    for target in TARGETS:
        inertial, _ = spice.spkpos(target, float(et), "J2000", config["profiles"][profile], "MOON")
        vector = rotation @ inertial
        distance = float(math.hypot(*vector))
        row.extend([float(v / distance) for v in vector])
        row.append(distance)
    return row


def time_payload(spice, config):
    start, end = (utc_unix(config[k]) for k in ("start_utc", "end_utc"))
    leap_values = [float(v) for v in spice.gdpool("DELTET/DELTA_AT", 0, 1000)]
    # This bounded profile starts after all entries in this LSK. Reject, do not
    # smooth across a new leap should the source lock/configuration change.
    nominal_start = start - 946728000
    require(all(v < nominal_start for v in leap_values[1::2]), "in-range leap needs segmented producer")

    def offset(unix):
        return float(spice.str2et(unix_utc(unix))) - (unix - 946728000)

    knots = []
    target = config["acceptance"]["time_error_s"]

    def refine(a, b, da, db, depth=0):
        require(depth < 24, "time refinement cap")
        errors = [abs(offset(a+(b-a)*f) - (da+(db-da)*f)) for f in (0.25, 0.5, 0.75)]
        if max(errors) > target / 4:
            mid = (a+b)/2
            dm = offset(mid)
            refine(a, mid, da, dm, depth+1)
            refine(mid, b, dm, db, depth+1)
        else:
            knots.append(dict(unix_s=a, et_minus_unix_from_j2000_s=da))

    a = start
    while a < end:
        b = min(end, a + config["time_initial_step_s"])
        refine(a, b, offset(a), offset(b))
        a = b
    knots.append(dict(unix_s=end, et_minus_unix_from_j2000_s=offset(end)))
    payload = dict(lsk_source_id="naif0012", method="segmented_linear_et_offset",
        unix_origin_utc="1970-01-01T00:00:00Z", j2000_noon_unix_s=946728000,
        future_leap_second_assumption="No new leap seconds after the pinned LSK's last entry (2017-01-01). Regenerate if updated.",
        max_measured_error_s=0, positive_leaps=[], unsupported_intervals=[],
        segments=[dict(utc_start=config["start_utc"], utc_end=config["end_utc"], unix_start_s=start, unix_end_s=end, knots=knots)])
    converter = TimeConverter(payload)
    rng = random.Random(config["random_seed"])
    errors, inverse_errors = [], []
    for left, right in zip(knots, knots[1:]):
        for f in (0, 0.5, rng.random(), 1-1e-6):
            unix = left["unix_s"] + (right["unix_s"]-left["unix_s"])*f
            utc = unix_utc(unix)
            actual = float(spice.str2et(utc))
            errors.append(abs(converter.to_et(utc)-actual))
            # Invert a direct SPICE ET; compare with the UTC used for that call.
            if converter.pieces[0][2] <= actual < converter.pieces[-1][3]:
                inverse_errors.append(abs(utc_unix(converter.to_utc(actual))-utc_unix(utc)))
    payload["max_measured_error_s"] = max(errors)
    require(max(errors + inverse_errors) <= target, "UTC/ET target failed")
    return payload, dict(samples=len(errors), max_forward_error_s=max(errors),
                         max_inverse_error_s=max(inverse_errors), lsk_delta_at=leap_values,
                         target_s=target, status="passed")


def descriptor(config, chunk_id, t0, intervals):
    number(t0)
    require(1 <= integer(intervals) <= config["chunk_intervals"], "invalid chunk interval count")
    count = intervals + 5
    return dict(chunk_id=chunk_id, origin="moon_center", surface_frame=config["surface_frame"],
        frame_epoch="observation_et", profile_ids=list(PROFILES),
        grid=dict(t0_et_s=t0-2*config["step_s"], step_s=config["step_s"], count=count),
        usable_span=dict(start_et_s=t0, end_et_s=t0+intervals*config["step_s"]),
        guard_samples_before=2, guard_samples_after=2, layout="interleaved_float32",
        channel_units=["1", "1", "1", "km", "1", "1", "1", "km"],
        interpolation="uniform_catmull_rom_components_then_normalize", binary_file_id=chunk_id,
        arrays=[dict(name=p+"-states", dtype="float32", shape=[count, 8], byte_offset=j*count*32,
                     unit="mixed_channels", scale=1, offset=0, invalid_code=None) for j, p in enumerate(PROFILES)],
        decoded_bytes=count*64, max_measured_angular_error_deg=0, max_measured_range_error_km=0)


def chunk_descriptors(config, start, end):
    """Tile ET with full grid cells; the release span clips the final partial cell."""
    require(number(start) < number(end), "empty ephemeris window")
    step = number(config["step_s"])
    size = integer(config["chunk_intervals"], minimum=1)
    require(step > 0, "invalid sample step")
    intervals = math.ceil((end-start)/step)
    require(intervals <= 256*size, "chunk count cap")
    return [descriptor(config, f"chunk-{index:04d}", start+offset*step, min(size, intervals-offset))
            for index, offset in enumerate(range(0, intervals, size))]


def generate_chunk(spice, config, desc):
    np, _ = dependencies()
    grid = desc["grid"]
    full = {p: np.array([state_row(spice, config, grid["t0_et_s"]+i*grid["step_s"], p)
                        for i in range(grid["count"])], dtype="float64") for p in PROFILES}
    payload = b"".join(full[p].astype("<f4").tobytes() for p in PROFILES)
    decoded = validate_ephemeris(desc, payload)
    rng = random.Random(config["random_seed"] + int(desc["chunk_id"].split("-")[-1]))
    metrics = {p: {t: dict(float64_angular_deg=0., encoded_angular_deg=0., range_error_km=0.) for t in TARGETS} for p in PROFILES}
    start, end = (desc["usable_span"][k] for k in ("start_et_s", "end_et_s"))
    epochs = [math.nextafter(end, start)]
    for i in range(grid["count"]-5):
        epochs.extend(start + (i+f)*grid["step_s"] for f in (0, 0.5, rng.random()))
    # Knots, every midpoint, seeded interiors, final endpoint and seams are tested.
    for et in epochs:
        for p in PROFILES:
            exact = state_row(spice, config, et, p)
            high = interpolate(desc, full[p].ravel(), et)
            stored = interpolate(desc, decoded[p+"-states"], et)
            for k, target in zip((0, 4), TARGETS):
                m = metrics[p][target]
                m["float64_angular_deg"] = max(m["float64_angular_deg"], angular_error(exact[k:k+3], high[k:k+3]))
                m["encoded_angular_deg"] = max(m["encoded_angular_deg"], angular_error(exact[k:k+3], stored[k:k+3]))
                m["range_error_km"] = max(m["range_error_km"], abs(exact[k+3]-stored[k+3]))
                require(m["float64_angular_deg"] <= config["acceptance"]["interpolation_angular_deg"], "Float64 interpolation target failed")
                require(m["encoded_angular_deg"] <= config["acceptance"]["encoded_angular_deg"], "encoded angular target failed")
                require(m["range_error_km"] <= config["acceptance"]["range_error_km"][target], "range target failed")
    desc["max_measured_angular_error_deg"] = max(m["encoded_angular_deg"] for targets in metrics.values() for m in targets.values())
    desc["max_measured_range_error_km"] = max(m["range_error_km"] for targets in metrics.values() for m in targets.values())
    return payload, dict(chunk_id=desc["chunk_id"], epochs=len(epochs), status="passed", residuals=metrics)


def observer_checks(spice, config, start, end):
    np, _ = dependencies()
    metrics = {p: {t: 0. for t in TARGETS} for p in PROFILES}
    count = 0
    for i in range(41):
        et = start + (end-start)*i/41
        for lat, lon, meridian in BENCHMARKS:
            up = np.array(enu_basis(lat, lon, meridian)[2])
            for height in config["observer_radius_offsets_km"]:
                observer = (config["reference_radius_km"] + height) * up
                for p in PROFILES:
                    row = state_row(spice, config, et, p)
                    for k, target in zip((0, 4), TARGETS):
                        approximate = np.array(position(row, k)) - observer
                        direct, _ = spice.spkcpo(target, et, config["surface_frame"], "OBSERVER",
                            config["profiles"][p], observer, "MOON", config["surface_frame"])
                        metrics[p][target] = max(metrics[p][target], angular_error(approximate, direct[:3]))
                        count += 1
    for p in PROFILES:
        budget = config["acceptance"]["geometric_observer_angular_deg" if p == "geometric" else "observer_approximation_angular_deg"]
        require(max(metrics[p].values()) <= budget, "surface-observer residual target failed")
    return dict(status="passed", comparisons=count, angular_errors_deg=metrics,
                benchmarks=[dict(lat_deg=a, lon_deg=b, reference_meridian_deg=c) for a, b, c in BENCHMARKS],
                radius_offsets_km=config["observer_radius_offsets_km"], refloc="OBSERVER",
                limitation="Direct double-precision Moon-center subtraction only; excludes encoded interpolation and terrain. Not an external independent reference.")