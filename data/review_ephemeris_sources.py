"""Explicit online discovery of official kernels; does not approve scientific use.

Retains first-fetch bytes and HTTP metadata outside the workspace. SHA-256 values
are measured locally, not claimed to be publisher signatures. A subsequent pinned
acquisition independently fetches these exact bytes through the existing acquirer.
"""

import argparse
import hashlib
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from lunar_pipeline.core import disjoint_roots, file_digest, json_bytes, require
from lunar_pipeline.fixture import PROJECT
from lunar_pipeline.sources import HTTPSOnlyRedirect


ROOT = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"
KERNELS = [
    ("naif0012", "lsk/naif0012.tls", "UTC/TDB leap-second conversion", None),
    ("pck00011", "pck/pck00011.tpc", "Physical constants; no spherical radius inferred from axes", None),
    ("moon-080317", "fk/satellites/moon_080317.tf", "Explicit DE421 lunar ME/PA frame definitions", "MOON_ME_DE421"),
    ("moon-pa-de421", "pck/moon_pa_de421_1900-2050.bpc", "DE421 orientation, coverage inspected at runtime", "MOON_PA_DE421"),
    ("de440s", "spk/planets/de440s.bsp", "DE440 short planetary ephemeris, coverage inspected at runtime", "J2000"),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", required=True)
    parser.add_argument("--raw-root", type=Path, default=Path.home() / "lunar-navigator-raw")
    args = parser.parse_args()
    raw, _ = disjoint_roots(args.raw_root, PROJECT)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    review = raw / ("review-" + stamp)
    review.mkdir(parents=True, exist_ok=False)
    opener = urllib.request.build_opener(HTTPSOnlyRedirect())
    specs, receipts = [], []
    for source_id, relative, description, frame in KERNELS:
        url = ROOT + relative
        path = review / relative.split("/")[-1]
        request = urllib.request.Request(url, headers={"User-Agent": "LunarNavigator-OfflineResearch/0.1", "Accept-Encoding": "identity"})
        with opener.open(request, timeout=90) as response, path.open("xb") as output:
            require(response.status == 200 and response.geturl().startswith("https://"), "invalid source response")
            size = 0
            while block := response.read(1024 * 1024):
                size += len(block)
                require(size <= 40_000_000, "kernel discovery cap exceeded")
                output.write(block)
            receipts.append(dict(url=url, resolved_url=response.geturl(), headers=dict(response.headers),
                                 received_at_utc=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")))
        if source_id == "de440s":
            with path.open("rb") as stream:
                require(hashlib.file_digest(stream, "md5").hexdigest() == "3917ee56769db332790c751e2168843d", "NAIF published MD5 mismatch")
        specs.append(dict(id=source_id, url=url, filename=path.name, bytes=size, sha256=file_digest(path),
            product_version=path.name, citation="NASA/JPL NAIF generic kernels: " + description,
            license="NAIF Rules Regarding Use of SPICE: https://naif.jpl.nasa.gov/naif/rules.html ; unmodified NAIF kernels may be redistributed; AS-IS, no warranty.",
            redistribution_status="permitted", retrieved_at_utc=receipts[-1]["received_at_utc"],
            native_frame=frame, units="SPICE native km, seconds and radians; inspect kernel comments for constants",
            time_coverage=None))
        print(path.name, size, specs[-1]["sha256"], flush=True)
    evidence = dict(format="ephemeris-source-review-v1", sources=specs, receipts=receipts,
        limitations=["SHA-256 measured from first HTTPS fetch, not an upstream SHA-256 signature.",
                     "Only de440s was also checked against NAIF's published MD5; MD5 is not an authenticity guarantee.",
                     "Null source time coverage is unresolved until SPICE runtime coverage inspection; FK/constants are not time segments."])
    (review / "review.json").write_bytes(json_bytes(evidence))
    print("Review evidence:", review / "review.json")


if __name__ == "__main__":
    main()