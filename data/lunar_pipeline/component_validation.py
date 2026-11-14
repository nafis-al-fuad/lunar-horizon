"""Separate evidence for an immutable preview; never changes acceptance metadata."""

import math
from decimal import Decimal

from .core import enu_basis, number, require, strict_json
from .encoding import validate_ephemeris
from .ephemeris import BENCHMARKS, PROFILES, TARGETS
from .ephemeris_math import angular_error, interpolate, position


OBSERVER_LIMIT_DEG = 0.0021


def chunk_epochs(desc, release_end):
    start = number(desc["usable_span"]["start_et_s"])
    end = min(number(desc["usable_span"]["end_et_s"]), number(release_end))
    require(start < end, "empty clipped chunk")
    interior = start + 0.375 * number(desc["grid"]["step_s"])
    require(start < interior < end, "planned off-knot epoch outside clipped chunk")
    return (start, interior, math.nextafter(end, start))


def altitude(vector, up):
    require(len(vector) == len(up) == 3, "three-component vectors required")
    require(all(math.isfinite(v) for v in (*vector, *up)), "nonfinite altitude input")
    require(abs(math.hypot(*up)-1) <= 1e-12, "unit up vector required")
    norm = math.hypot(*vector)
    require(norm > 0, "zero observer vector")
    return math.degrees(math.asin(max(-1., min(1., sum(a*b for a, b in zip(vector, up))/norm))))


def encoded_observers(root, manifest, spice):
    config = manifest["configuration"]
    cases, parity = [], []
    maxima = {p: {t: dict(angular_deg=0., altitude_deg=0., range_km=0.) for t in TARGETS} for p in PROFILES}
    for index, entry in enumerate(manifest["chunks"]):
        desc = strict_json((root / entry["descriptor"]).read_bytes())
        arrays = validate_ephemeris(desc, (root / entry["binary"]).read_bytes())
        for et in chunk_epochs(desc, manifest["usable_span"]["end_et_s"]):
            for profile in PROFILES:
                row = interpolate(desc, arrays[profile + "-states"], et)
                parity.append(dict(chunk=index, profile=profile, et_s=et, expected=row))
                for site, (lat, lon, meridian) in enumerate(BENCHMARKS):
                    up = enu_basis(lat, lon, meridian)[2]
                    for height in config["observer_radius_offsets_km"]:
                        observer = [(config["reference_radius_km"] + height)*v for v in up]
                        for k, target in zip((0, 4), TARGETS):
                            approximate = [v-o for v, o in zip(position(row, k), observer)]
                            direct, _ = spice.spkcpo(target, et, config["surface_frame"], "OBSERVER",
                                config["profiles"][profile], observer, "MOON", config["surface_frame"])
                            residual = dict(angular_deg=angular_error(approximate, direct[:3]),
                                altitude_deg=abs(altitude(approximate, up)-altitude(direct[:3], up)),
                                range_km=abs(math.hypot(*approximate)-math.hypot(*direct[:3])))
                            for metric, value in residual.items():
                                maxima[profile][target][metric] = max(maxima[profile][target][metric], value)
                            cases.append(dict(chunk=index, et_s=et, profile=profile, target=target,
                                site=site, radius_offset_km=height, **residual))
    passed = all(m["angular_deg"] <= OBSERVER_LIMIT_DEG and m["altitude_deg"] <= OBSERVER_LIMIT_DEG
                 for targets in maxima.values() for m in targets.values())
    return dict(status="passed" if passed else "failed", comparisons=len(cases),
        angular_altitude_limit_deg=OBSERVER_LIMIT_DEG, maxima=maxima, cases=cases,
        benchmarks=[dict(lat_deg=a, lon_deg=b, reference_meridian_deg=c) for a, b, c in BENCHMARKS],
        limitation="Local SPICE numerical comparison, not independent science; range diagnostic only; no terrain."), parity


def et_to_jd(et):
    # Avoid cancellation from adding/subtracting a 2.4-million-day Float64 JD.
    return format(Decimal("2451545") + Decimal(str(number(et)))/Decimal(86400), ".15f")


def jd_to_et(jd):
    return float((Decimal(jd)-Decimal("2451545"))*Decimal(86400))


def reference_epochs(spice, manifest):
    start, end = (manifest["usable_span"][k] for k in ("start_et_s", "end_et_s"))
    config = manifest["configuration"]
    seam = start + config["step_s"]*config["chunk_intervals"]
    epochs = [spice.str2et(f"{year}-{month:02d}-01T00:00:00Z")
              for year in range(2026, 2036) for month in (1, 7)]
    epochs.extend((start+4050, seam-1, seam, seam+1, end-1))
    return [et_to_jd(et) for et in sorted(set(epochs))]