"""Reference-only DE440 ASCII evaluation; no SPICE or preview interpolation.

States are geometric Cartesian km and km/day at decimal TDB Julian dates.
Body codes follow TESTEPH, NOT NAIF: Earth=3, Moon=10, Sun=11, SSB=12,
EMB=13. Orientation, apparent corrections and scientific acceptance are absent.
Callers must verify input provenance/hashes separately; parsing is not authenticity.
"""

import io
import math
import re
from bisect import bisect_right
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, localcontext
from pathlib import Path
from types import MappingProxyType

from .core import ValidationError, require


MAX_HEADER = 100_000
MAX_COEFFICIENT_BYTES = 40_000_000
COMPONENTS = (3,)*11 + (2, 3, 3, 1)
BODIES = (3, 10, 11, 12, 13)


def decimal_number(token):
    """Reject binary64 JDs: precision must not already be lost at the API boundary."""
    require(isinstance(token, (str, Decimal)), "decimal string or Decimal required")
    text = str(token)
    require(len(text) <= 64 and re.fullmatch(
        r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[DdEe][+-]?\d+)?", text), "invalid decimal")
    try:
        value = Decimal(text.replace("D", "E").replace("d", "e"))
        require(value.is_finite() and math.isfinite(float(value)), "nonfinite decimal")
        require(not value or abs(value.adjusted()) <= 300, "unsupported decimal exponent")
        return value
    except (InvalidOperation, OverflowError) as exc:
        raise ValidationError("invalid decimal") from exc


def unsigned(token):
    require(re.fullmatch(r"\d{1,8}", token), "invalid unsigned integer")
    return int(token)


@dataclass(frozen=True)
class Header:
    ncoeff: int
    start: Decimal
    end: Decimal
    step: Decimal
    constants: object
    pointers: tuple


def parse_header(text):
    require(isinstance(text, str) and text.isascii() and len(text) <= MAX_HEADER, "invalid header text/size")
    groups = re.split(r"(?m)^\s*GROUP\s+(\d+)\s*$", text)
    require(groups[1::2] == ["1010", "1030", "1040", "1041", "1050", "1070"], "wrong/duplicate header groups")
    sizes = re.fullmatch(r"\s*KSIZE=\s*(\d+)\s+NCOEFF=\s*(\d+)\s*", groups[0])
    require(sizes is not None, "missing header sizes")
    ksize, ncoeff = map(int, sizes.groups())
    require(2 < ncoeff <= 3000 and ksize == 2*ncoeff, "invalid record size")
    content = dict(zip(groups[1::2], groups[2::2]))
    title = content["1010"].strip().splitlines()
    require(title and title[0].strip() == "JPL Planetary Ephemeris DE440/LE440", "unsupported ephemeris")
    span = content["1030"].split()
    require(len(span) == 3, "invalid header span")
    start, end, step = map(decimal_number, span)
    require(start < end and 0 < step <= 128, "invalid coverage/step")
    with localcontext() as context:
        context.prec = 80
        require((end-start) % step == 0, "unaligned header span")
    names, values = content["1040"].split(), content["1041"].split()
    require(names and values, "missing constants")
    count = unsigned(names[0])
    require(0 < count <= 1000 and unsigned(values[0]) == count and
        len(names) == len(values) == count+1, "constant count mismatch")
    require(len(set(names[1:])) == count and all(re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,15}", n)
        for n in names[1:]), "duplicate/invalid constant names")
    constants = dict(zip(names[1:], map(decimal_number, values[1:])))
    require(constants.get("DENUM") == constants.get("LENUM") == 440, "wrong model constants")
    require(constants.get("AU") == Decimal("149597870.7"), "wrong DE440 AU")
    require(1 < constants.get("EMRAT", Decimal(0)) < 1000, "invalid Earth/Moon mass ratio")
    rows = [line.split() for line in content["1050"].splitlines() if line.strip()]
    require(len(rows) == 3 and all(len(row) == 15 for row in rows), "expected 15 pointer triplets")
    pointers, next_word = [], 3
    for item, (offset, order, parts) in enumerate(zip(*rows)):
        offset, order, parts = map(unsigned, (offset, order, parts))
        require((order == 0) == (parts == 0), "incomplete absent pointer")
        require(order <= 64 and parts <= 64, "unsupported polynomial dimensions")
        if order:
            require(offset == next_word, "overlapping/gapped pointer")
            next_word += COMPONENTS[item]*order*parts
            require(next_word <= ncoeff+1, "pointer outside record")
        else:
            require(offset in (0, next_word), "invalid absent pointer")
        pointers.append((offset-1, order, parts))
    require(next_word == ncoeff+1 and all(pointers[i][1] for i in (2, 9, 10)), "missing coefficient blocks")
    require(not content["1070"].strip(), "header must not contain coefficient records")
    return Header(ncoeff, start, end, step, MappingProxyType(constants), tuple(pointers))


@dataclass(frozen=True)
class Record:
    start: Decimal
    end: Decimal
    coefficients: tuple


def parse_records(stream, header):
    """Read three coefficients per line, including optional zero padding at record end."""
    total = 0

    def line():
        nonlocal total
        while True:
            value = stream.readline(4097)
            total += len(value)
            require(len(value) <= 4096 and total <= MAX_COEFFICIENT_BYTES and value.isascii(), "coefficient text/size limit")
            if not value or value.strip():
                return value.split()

    records, previous_number = [], None
    while fields := line():
        require(len(fields) == 2, "wrong record header")
        number, count = map(unsigned, fields)
        require(number > 0 and count == header.ncoeff, "wrong record number/size")
        require(previous_number is None or number == previous_number+1, "nonconsecutive records")
        require(len(records) < 10000, "too many records")
        values = []
        while len(values) < count:
            fields = line()
            remaining = min(3, count-len(values))
            require(len(fields) in (remaining, 3), "truncated/malformed coefficient row")
            row = list(map(decimal_number, fields))
            require(all(v == 0 for v in row[remaining:]), "nonzero record padding")
            values.extend(row[:remaining])
        start, end = values[:2]
        with localcontext() as context:
            context.prec = 80
            require(header.start <= start < end <= header.end and end-start == header.step,
                "record outside header or wrong duration")
            require((start-header.start) % header.step == 0, "record off header grid")
        require(not records or start == records[-1].end, "record gap/overlap/reordering")
        records.append(Record(start, end, tuple(map(float, values))))
        previous_number = number
    require(records, "empty coefficient file")
    return tuple(records)


def chebyshev(coefficients, x):
    """Position and derivative with respect to x using independent recurrences."""
    require(type(x) in (int, float) and math.isfinite(x) and -1 <= x <= 1, "invalid Chebyshev argument")
    require(0 < len(coefficients) <= 64 and all(type(c) in (int, float) and math.isfinite(c)
        for c in coefficients), "invalid coefficients")
    polynomials, derivatives = [1., x], [0., 1.]
    for degree in range(2, len(coefficients)):
        polynomials.append(2*x*polynomials[-1]-polynomials[-2])
        derivatives.append(2*polynomials[-2]+2*x*derivatives[-1]-derivatives[-2])
    try:
        result = tuple(math.fsum(c*p for c, p in zip(coefficients, basis))
            for basis in (polynomials, derivatives))
    except (OverflowError, ValueError) as exc:
        raise ValidationError("polynomial overflow") from exc
    require(all(math.isfinite(v) for v in result), "nonfinite polynomial")
    return result


class Ephemeris:
    """Immutable parsed records; final endpoint inclusive, internal seams right-sided."""

    def __init__(self, header_text, coefficient_stream):
        self.header = parse_header(header_text)
        self.records = parse_records(coefficient_stream, self.header)
        self.starts = tuple(r.start for r in self.records)

    @classmethod
    def from_files(cls, header_path, coefficient_path):
        try:
            with Path(header_path).open(encoding="ascii") as source:
                header = source.read(MAX_HEADER+1)
            with Path(coefficient_path).open(encoding="ascii") as source:
                return cls(header, source)
        except UnicodeError as exc:
            raise ValidationError("non-ASCII ephemeris") from exc

    @classmethod
    def from_text(cls, header, coefficients):
        return cls(header, io.StringIO(coefficients))

    @property
    def coverage(self):
        return self.records[0].start, self.records[-1].end

    def state(self, target, center, jd_tdb):
        """Return target-minus-center (x,y,z,dx/day,dy/day,dz/day) in J2000, NONE.

        Combine body weights before evaluation to avoid subtracting two large
        barycentric vectors for small Earth-Moon separations.
        """
        require(type(target) is int and type(center) is int and target in BODIES and center in BODIES,
            "unsupported TESTEPH body code")
        jd = decimal_number(jd_tdb)
        require(self.coverage[0] <= jd <= self.coverage[1], "epoch outside coefficient coverage")
        record = self.records[bisect_right(self.starts, jd)-1]
        q = float(self.header.constants["EMRAT"])
        weights = {3: (1., -1/(1+q), 0.), 10: (1., q/(1+q), 0.),
            11: (0., 0., 1.), 12: (0., 0., 0.), 13: (1., 0., 0.)}
        terms = [[] for _ in range(6)]
        for item, a, b in zip((2, 9, 10), weights[target], weights[center]):
            weight = a-b
            if not weight:
                continue
            offset, order, parts = self.header.pointers[item]
            with localcontext() as context:
                context.prec = 80
                duration = (record.end-record.start)/parts
                part = min(int((jd-record.start)/duration), parts-1)
                x = float(2*(jd-record.start-part*duration)/duration-1)
                scale = float(2/duration)
            for axis in range(3):
                begin = offset + (part*3+axis)*order
                position, derivative = chebyshev(record.coefficients[begin:begin+order], x)
                terms[axis].append(weight*position)
                terms[axis+3].append(weight*derivative*scale)
        try:
            state = tuple(math.fsum(values) for values in terms)
        except (OverflowError, ValueError) as exc:
            raise ValidationError("state overflow") from exc
        require(all(math.isfinite(value) for value in state), "nonfinite state")
        return state