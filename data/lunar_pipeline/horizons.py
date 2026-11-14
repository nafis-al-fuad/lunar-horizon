"""Bounded opt-in Horizons acquisition and strict offline receipt replay."""

import csv
import math
import re
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .core import digest, json_bytes, require, strict_json
from .component_validation import jd_to_et
from .ephemeris_math import angular_error


ENDPOINT = "https://ssd.jpl.nasa.gov/api/horizons.api"
MAX_RESPONSE = 2_000_000
ANGULAR_LIMIT = 0.000001
RANGE_LIMITS = {"SUN": 0.1, "EARTH": 0.01}


def request_spec(target, correction, epochs):
    require(target in ("SUN", "EARTH") and correction in ("NONE", "LT+S"), "unsupported reference case")
    require(0 < len(epochs) <= 50 and all(re.fullmatch(r"\d{7}\.\d{15}", e) for e in epochs), "invalid JD list")
    params = dict(format="json", COMMAND="'10'" if target == "SUN" else "'399'",
        OBJ_DATA="'NO'", MAKE_EPHEM="'YES'", EPHEM_TYPE="'VECTORS'", CENTER="'500@301'",
        REF_SYSTEM="'ICRF'", REF_PLANE="'FRAME'", OUT_UNITS="'KM-S'", VEC_TABLE="'1'",
        VEC_CORR=f"'{correction}'", CSV_FORMAT="'YES'", VEC_LABELS="'YES'",
        TIME_TYPE="'TDB'", TLIST_TYPE="'JD'", TLIST="'" + ",".join(epochs) + "'")
    return dict(url=ENDPOINT+"?"+urlencode(params), parameters=params, target=target,
                correction=correction, epochs_jd_tdb=epochs)


def acquire(cache, spec):
    """Create once, no retries/overwrite. HTTP/API errors are retained as evidence."""
    cache.mkdir(parents=True, exist_ok=False)
    (cache/"request.json").write_bytes(json_bytes(spec))
    request = Request(spec["url"], headers={"User-Agent": "LunarNavigator-ComponentValidation/1", "Accept": "application/json"})
    try:
        try:
            response = urlopen(request, timeout=30)
        except HTTPError as exc:
            response = exc
        with response:
            raw = response.read(MAX_RESPONSE + 1)
            receipt = dict(request_sha256=digest(json_bytes(spec)), response_sha256=digest(raw),
                bytes=len(raw), retrieved_at_utc=datetime.now(timezone.utc).isoformat(),
                status=response.status, headers=list(response.headers.items()), final_url=response.url,
                truncated=len(raw) > MAX_RESPONSE)
    except Exception as exc:
        (cache/"acquisition-error.json").write_bytes(json_bytes(dict(
            status="failed", at_utc=datetime.now(timezone.utc).isoformat(), error=f"{type(exc).__name__}: {exc}")))
        raise
    (cache/"response.json").write_bytes(raw)
    (cache/"receipt.json").write_bytes(json_bytes(receipt))
    return replay(cache, spec)


def replay(cache, expected):
    spec = strict_json((cache/"request.json").read_bytes())
    receipt = strict_json((cache/"receipt.json").read_bytes())
    raw = (cache/"response.json").read_bytes()
    require(spec == expected and receipt["request_sha256"] == digest(json_bytes(expected)), "reference request mismatch")
    require(0 < len(raw) <= MAX_RESPONSE and receipt["bytes"] == len(raw) and
            receipt["response_sha256"] == digest(raw), "reference receipt mismatch")
    require(receipt["status"] == 200 and receipt["final_url"] == expected["url"], "unexpected reference HTTP result")
    return parse_response(raw, expected)


def parse_response(raw, spec):
    payload = strict_json(raw)
    require("error" not in payload and isinstance(payload.get("result"), str), "Horizons API error")
    signature = payload.get("signature", {})
    require(signature.get("source") == "NASA/JPL Horizons API" and signature.get("version") in ("1.2", "1.3"), "unreviewed API signature")
    text = payload["result"]
    require(text.count("$$SOE") == text.count("$$EOE") == 1, "missing/duplicate Horizons delimiters")
    header, rest = text.split("$$SOE")
    body, footer = rest.split("$$EOE")
    target_id = "10" if spec["target"] == "SUN" else "399"
    require(re.search(r"Target body name:\s+[^\n]*\("+target_id+r"\)", header), "wrong reference target")
    require(re.search(r"Center body name:\s+Moon\s+\(301\)", header), "wrong reference center")
    require(re.search(r"Center-site name:\s+BODY CENTER", header), "not body center")
    require(re.search(r"Reference frame\s*:\s*ICRF", header), "wrong reference frame")
    require(re.search(r"Output units\s*:\s*KM-S", header), "wrong reference units")
    require("JDTDB" in header, "wrong reference timescale")
    expected_type = "GEOMETRIC cartesian states" if spec["correction"] == "NONE" else "LT+S CORRECTED cartesian states"
    require(re.search(r"Output type\s*:\s*"+re.escape(expected_type), header, re.I), "wrong reference corrections")
    models = re.findall(r"\{source:\s*([^}]+)\}", header)
    require(len(models) >= 2, "missing reference model metadata")
    rows = []
    for line in body.strip().splitlines():
        fields = next(csv.reader([line]))
        require(len(fields) == 6 and not fields[-1].strip(), "unexpected vector table layout")
        jd = fields[0].strip()
        et = jd_to_et(jd)
        vector = [float(v) for v in fields[2:5]]
        require(math.isfinite(et) and all(math.isfinite(v) for v in vector) and math.hypot(*vector) > 0, "nonfinite/zero reference")
        rows.append(dict(jd_tdb=jd, et_s=et, vector_km=vector))
    require(len(rows) == len(spec["epochs_jd_tdb"]), "reference row count")
    for row, jd in zip(rows, spec["epochs_jd_tdb"]):
        require(abs(row["et_s"]-jd_to_et(jd)) <= 0.0001, "reference epoch mismatch/order")
    return dict(signature=signature, header=header, footer=footer, models=models, rows=rows)


def compare(parsed, spec, spice):
    cases = []
    for row, jd in zip(parsed["rows"], spec["epochs_jd_tdb"]):
        et = jd_to_et(jd)
        direct, _ = spice.spkpos(spec["target"], et, "J2000", spec["correction"], "MOON")
        reference = row["vector_km"]
        cases.append(dict(et_s=et, requested_jd_tdb=jd, returned_jd_tdb=row["jd_tdb"],
            angular_deg=angular_error(direct, reference),
            range_km=abs(math.hypot(*direct)-math.hypot(*reference)),
            vector_km=math.dist(direct, reference)))
    maxima = {k: max(c[k] for c in cases) for k in ("angular_deg", "range_km", "vector_km")}
    matched = all(model.strip() == "DE440" for model in parsed["models"])
    # Equal correction labels alone do not establish identical light-time iteration.
    # Apparent acceptance stays unmatched until service semantics are documented.
    corrections_matched = spec["correction"] == "NONE"
    within = maxima["angular_deg"] <= ANGULAR_LIMIT and maxima["range_km"] <= RANGE_LIMITS[spec["target"]]
    status = "model_mismatch" if not matched else "unmatched_corrections" if not corrections_matched else "passed" if within else "failed"
    return dict(status=status, corrections_matched=corrections_matched,
        diagnostic_within_budgets=within, local_model="DE440", reference_models=parsed["models"],
        target=spec["target"], correction=spec["correction"], comparisons=len(cases), maxima=maxima, cases=cases,
        angular_limit_deg=ANGULAR_LIMIT, range_limit_km=RANGE_LIMITS[spec["target"]],
        signature=parsed["signature"], service_header=parsed["header"],
        limitation="External service concordance only; shared JPL solutions are not independent observational validation.")