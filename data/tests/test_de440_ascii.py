"""Independent analytic fixtures, not official ephemerides or scientific acceptance."""

import io
import math
import tempfile
import unittest
from decimal import Decimal, localcontext
from pathlib import Path
from unittest.mock import patch

from lunar_pipeline.core import ValidationError
from lunar_pipeline.de440_ascii import Ephemeris, chebyshev, decimal_number, parse_header, parse_records


START = Decimal("2451545")


def fixture_header():
    # Different subinterval counts catch component/subinterval ordering mistakes.
    rows = [[], [], []]
    offset = 3
    for item in range(15):
        parts = {2: 2, 9: 4, 10: 1}.get(item, 0)
        for row, value in zip(rows, (offset, 4 if parts else 0, parts)):
            row.append(value)
        offset += 12*parts
    ncoeff = offset-1
    return (f"KSIZE= {2*ncoeff} NCOEFF= {ncoeff}\n\nGROUP 1010\n\n"
        "JPL Planetary Ephemeris DE440/LE440\n\nGROUP 1030\n\n"
        "2451545 2451577 8\n\nGROUP 1040\n\n4 DENUM LENUM AU EMRAT\n\n"
        "GROUP 1041\n\n4 440 440 149597870.7 81\n\nGROUP 1050\n\n" +
        "\n".join(" ".join(map(str, row)) for row in rows) + "\n\nGROUP 1070\n\n")


def fixture_records(starts=(0, 8), padded=True, huge=False, jump=False):
    records = []
    for number, begin in enumerate(starts, 1):
        words = [START+begin, START+begin+8]
        for item, parts in ((2, 2), (9, 4), (10, 1)):
            duration = 8/parts
            for part in range(parts):
                midpoint = begin+(part+0.5)*duration
                for axis in range(3):
                    # Global linear functions: intercept + rate * days since START.
                    intercept = {2: 1000, 9: 82, 10: 10000}[item]*(axis+1)
                    if huge and item == 2:
                        intercept = 1e20*(axis+1)
                    rate = {2: 2, 9: 4, 10: -6}[item]*(axis+1)
                    if jump and item == 10:
                        intercept += 100*number
                    words.extend((intercept+rate*midpoint, rate*duration/2, 0, 0))
        text = [f"{number} {len(words)}"]
        for index in range(0, len(words), 3):
            row = words[index:index+3]
            if padded:
                row += [0]*(3-len(row))
            text.append(" ".join(format(Decimal(str(value)), ".17E").replace("E", "D") for value in row))
        records.append("\n".join(text)+"\n")
    return "\n".join(records)


class ChebyshevTests(unittest.TestCase):
    def test_constant_and_linear(self):
        for x in (-1, -0.3, 0, 0.8, 1):
            self.assertEqual(chebyshev([7.], x), (7., 0.))
            p, v = chebyshev([2., 3.], x)
            self.assertAlmostEqual(p, 2+3*x)
            self.assertEqual(v, 3.)

    def test_quartic_against_expanded_polynomial(self):
        for x in (-1, -0.75, -0.2, 0, 0.4, 1):
            p, v = chebyshev([1, 2, 3, 4, 5], x)
            self.assertAlmostEqual(p, 40*x**4+16*x**3-34*x*x-10*x+3, places=12)
            self.assertAlmostEqual(v, 160*x**3+48*x*x-68*x-10, places=12)

    def test_degree_endpoint_derivatives(self):
        for degree in range(1, 64):
            coefficients = [0.]*degree+[1.]
            self.assertEqual(chebyshev(coefficients, 1), (1., float(degree*degree)))
            self.assertEqual(chebyshev(coefficients, -1),
                (float((-1)**degree), float((-1)**(degree-1)*degree*degree)))

    def test_invalid_polynomials(self):
        for coefficients, x in (([], 0), ([0.]*65, 0), ([math.nan], 0), ([True], 0),
                ([1], math.inf), ([1], 1.01), ([1], True), ([1e308, 1e308], 1)):
            with self.subTest(coefficients=coefficients, x=x), self.assertRaises(ValidationError):
                chebyshev(coefficients, x)


class HeaderTests(unittest.TestCase):
    def test_valid_header_and_immutable_constants(self):
        header = parse_header(fixture_header())
        self.assertEqual(header.ncoeff, 86)
        self.assertEqual(header.pointers[9], (26, 4, 4))
        with self.assertRaises(TypeError):
            header.constants["AU"] = 1

    def test_crlf_and_blank_padding(self):
        self.assertEqual(parse_header("\n"+fixture_header().replace("\n", "\r\n")), parse_header(fixture_header()))

    def test_invalid_groups_model_constants_and_coverage(self):
        text = fixture_header()
        for old, new in (("GROUP 1040", "GROUP 1030"), ("DE440/LE440", "DE441/LE441"),
                ("4 440 440", "4 441 440"), ("AU EMRAT", "AU AU"),
                ("149597870.7", "149597870"), (".7 81", ".7 0"),
                ("4 DENUM", "5 DENUM"), ("2451577 8", "2451576 8"),
                ("2451577 8", "2451545 8"), ("2451577 8", "2451577 0"),
                ("KSIZE= 172", "KSIZE= 174")):
            with self.subTest(new=new), self.assertRaises(ValidationError):
                parse_header(text.replace(old, new))
        with self.assertRaises(ValidationError):
            parse_header(text+"1 86\n")

    def test_invalid_pointers(self):
        text = fixture_header()
        prefix, pointers = text.split("GROUP 1050\n\n")
        rows = pointers.splitlines()
        for row, column, value in ((0, 9, 26), (0, 9, 28), (1, 9, 65), (2, 9, 0),
                (2, 9, 65), (0, 14, 100), (1, 10, 3)):
            altered = rows.copy()
            cells = altered[row].split()
            cells[column] = str(value)
            altered[row] = " ".join(cells)
            with self.subTest(row=row, column=column), self.assertRaises(ValidationError):
                parse_header(prefix+"GROUP 1050\n\n"+"\n".join(altered))

    def test_header_size_and_non_ascii(self):
        for text in ("x"*100001, fixture_header()+"é", "", fixture_header().replace("81", "NaN")):
            with self.assertRaises(ValidationError):
                parse_header(text)

    def test_decimal_input_validation(self):
        self.assertEqual(decimal_number("1.25D+2"), Decimal(125))
        self.assertEqual(decimal_number("-1.25d-2"), Decimal("-.0125"))
        for token in (2451545., 2451545, True, None, "NaN", "Inf", " 1", "1_0", "1e999", "1e-999"):
            with self.subTest(token=token), self.assertRaises(ValidationError):
                decimal_number(token)


class RecordTests(unittest.TestCase):
    def setUp(self):
        self.header = parse_header(fixture_header())

    def test_optional_zero_padding_and_coverage(self):
        self.assertEqual(parse_records(io.StringIO(fixture_records()), self.header),
            parse_records(io.StringIO(fixture_records(padded=False)), self.header))

    def test_gaps_overlaps_order_and_grid(self):
        for starts in ((0, 16), (0, 0), (8, 0), (1,), (-8,), (32,)):
            with self.subTest(starts=starts), self.assertRaises(ValidationError):
                parse_records(io.StringIO(fixture_records(starts)), self.header)

    def test_truncated_bad_padding_and_record_number(self):
        text = fixture_records()
        one = fixture_records((0,))
        lines = one.splitlines()
        cells = lines[-1].split()
        cells[-1] = "1D0"
        padded = "\n".join(lines[:-1]+[" ".join(cells)])
        for bad in ("", text.replace("2 86", "3 86"), text.replace("1 86", "0 86"),
                text.replace("1 86", "1 87"), "\n".join(lines[:-1]), padded,
                one.replace("D+", "Q+", 1), one+"junk\n"):
            with self.subTest(bad=bad[:50]), self.assertRaises(ValidationError):
                parse_records(io.StringIO(bad), self.header)

    def test_resource_limits(self):
        with patch("lunar_pipeline.de440_ascii.MAX_COEFFICIENT_BYTES", 100), self.assertRaises(ValidationError):
            parse_records(io.StringIO(fixture_records()), self.header)
        with self.assertRaises(ValidationError):
            parse_records(io.StringIO(" "*4097), self.header)

    def test_file_api_and_non_ascii_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            header, data = Path(directory)/"header", Path(directory)/"data"
            header.write_text(fixture_header(), encoding="ascii")
            data.write_text(fixture_records(), encoding="ascii")
            self.assertEqual(Ephemeris.from_files(header, data).coverage, (START, START+16))
            data.write_bytes(b"\xff")
            with self.assertRaises(ValidationError):
                Ephemeris.from_files(header, data)


class StateTests(unittest.TestCase):
    def setUp(self):
        self.ephemeris = Ephemeris.from_text(fixture_header(), fixture_records())

    def test_all_body_pairs_against_analytic_states(self):
        for day in (0, 0.125, 2, 4, 7.999, 8, 12, 16):
            b = [1000*(i+1)+2*(i+1)*day for i in range(3)]+[2*(i+1) for i in range(3)]
            g = [82*(i+1)+4*(i+1)*day for i in range(3)]+[4*(i+1) for i in range(3)]
            sun = [10000*(i+1)-6*(i+1)*day for i in range(3)]+[-6*(i+1) for i in range(3)]
            bodies = {3: [x-y/82 for x, y in zip(b, g)], 10: [x+81*y/82 for x, y in zip(b, g)],
                11: sun, 12: [0]*6, 13: b}
            for target in bodies:
                for center in bodies:
                    actual = self.ephemeris.state(target, center, START+Decimal(str(day)))
                    for value, expected in zip(actual, (x-y for x, y in zip(bodies[target], bodies[center]))):
                        self.assertAlmostEqual(value, expected, delta=1e-10)

    def test_subinterval_boundaries_do_not_discontinue_linear_states(self):
        for day in range(0, 17, 2):
            state = self.ephemeris.state(10, 3, START+day)
            self.assertAlmostEqual(state[0], 82+4*day, places=12)
            self.assertAlmostEqual(state[3], 4., places=12)

    def test_record_seam_uses_right_hand_record_and_final_endpoint(self):
        e = Ephemeris.from_text(fixture_header(), fixture_records(jump=True))
        self.assertEqual(e.state(11, 12, START+8)[0], 10000-6*8+200)
        self.assertEqual(e.state(11, 12, START+16)[0], 10000-6*16+200)

    def test_small_moon_earth_vector_does_not_subtract_large_barycenters(self):
        e = Ephemeris.from_text(fixture_header(), fixture_records(huge=True))
        self.assertAlmostEqual(e.state(10, 3, START)[0], 82., places=12)
        self.assertAlmostEqual(e.state(3, 10, START)[0], -82., places=12)

    def test_sub_binary64_jd_precision_and_decimal_context(self):
        jd = "2451545.000000000001"
        with localcontext() as context:
            context.prec = 6
            actual = self.ephemeris.state(10, 3, jd)[0]
        self.assertNotEqual(actual, self.ephemeris.state(10, 3, "2451545")[0])
        self.assertAlmostEqual(actual, 82+4e-12, delta=2e-14)

    def test_invalid_epochs_and_ids(self):
        for target, center, jd in ((399, 3, START), (3, 301, START), (True, 3, START),
                (3, 3, START-1), (3, 3, START+17), (3, 3, 2451545.), (3, 3, "NaN")):
            with self.subTest(target=target, center=center, jd=jd), self.assertRaises(ValidationError):
                self.ephemeris.state(target, center, jd)


if __name__ == "__main__":
    unittest.main()