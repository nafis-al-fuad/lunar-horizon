"""Decoder and chunk-spanning interpolator for the 10-year ephemeris release."""

import bisect
import struct
from pathlib import Path

from .core import ValidationError, number, require, strict_json, time_span
from .ephemeris_math import interpolate, position


class EphemerisDeck:
    """Provides exact DE440 Sun and Earth positions across [2026-01-01, 2036-01-01)."""

    def __init__(self, ephemeris_dir):
        self.dir = Path(ephemeris_dir)
        require(self.dir.is_dir(), f"ephemeris directory not found: {self.dir}")
        self.chunks = []
        desc_files = sorted(self.dir.glob("chunk-*.json"))
        require(len(desc_files) > 0, f"no chunk descriptors in {self.dir}")

        for desc_file in desc_files:
            d = strict_json(desc_file.read_bytes())
            start, end = time_span(d["usable_span"])
            self.chunks.append((start, end, desc_file.stem, d))

        self.starts = [c[0] for c in self.chunks]
        self.cache = {}
        self.total_span = (self.chunks[0][0], self.chunks[-1][1])

    def get_state(self, et_s, profile="geometric"):
        """Return (sun_pos_km, earth_pos_km) in lunar body-fixed MOON_ME_DE421 frame."""
        t = number(et_s, "et_s")
        require(self.total_span[0] <= t < self.total_span[1],
                f"ET {t} is outside ephemeris decade coverage [{self.total_span[0]}, {self.total_span[1]})")

        idx = bisect.bisect_right(self.starts, t) - 1
        require(0 <= idx < len(self.chunks), f"chunk lookup failed for ET {t}")
        start, end, stem, desc = self.chunks[idx]
        require(start <= t < end, f"ET {t} outside chunk {stem} usable span [{start}, {end})")

        if stem not in self.cache:
            bin_file = self.dir / (stem + ".bin")
            require(bin_file.is_file(), f"missing ephemeris binary: {bin_file}")
            raw = bin_file.read_bytes()
            count = desc["grid"]["count"]
            # 2 profiles: geometric (offset 0), apparent (offset count*32)
            offset = 0 if profile == "geometric" else count * 8 * 4
            values = struct.unpack(f"<{count*8}f", raw[offset:offset + count*8*4])
            self.cache[stem] = (desc, values)

        d, vals = self.cache[stem]
        interp = interpolate(d, vals, t)
        sun_pos = position(interp, offset=0)
        earth_pos = position(interp, offset=4)
        return sun_pos, earth_pos
