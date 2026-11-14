# External-reference alignment and replay

The immutable preview uses **DE440 positions**, **MOON_ME_DE421 orientation**,
and SPICE `NONE` / `LT+S` corrections. This document explains the outstanding
external-reference gates; it does not promote the preview or change its budgets.

## Model and correction boundaries

- Retained Sun and Earth vector responses identify **DE441** on both the target and Moon
  center lines. They are not model-matched references for DE440. JPL's
  [ephemeris export information](https://ssd.jpl.nasa.gov/planets/eph_export.html)
  explains that DE441 omits the lunar core/mantle damping term used in DE440.
  Small residuals therefore remain cross-model diagnostics, not proof of an
  identical dynamical solution or independent observational accuracy.
- The [Horizons API parameter documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
  describes `VEC_CORR` and coordinate conventions. The request used here does not
  select a DE version; the actual target/center source labels must be checked in
  every response. Do not invent a DE440-selection parameter or relabel DE441.
- Equal `LT+S` labels do not establish identical algorithms. The retained Horizons
  apparent-vector footer describes Newtonian receive light time and **relativistic
  stellar aberration**. NAIF's
  [SPICE position documentation](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkpos_c.html)
  describes Newtonian corrections and one light-time iteration for `LT`, with
  `LT+S` adding stellar aberration. `CN+S` is a distinct converged option. Apparent
  concordance remains `unmatched_corrections` even if a future response uses DE440.
  No alternate correction is silently substituted for the preview's `LT+S`.
- Inertial vector agreement says nothing about lunar-fixed orientation agreement.
  NAIF's [DE421 lunar frame kernel](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf)
  explicitly defines the DE421 PA and ME realizations and their fixed rotation.
  A Horizons surface model must be identified and aligned separately; neither a
  generic lunar frame name nor Moon-centered vector agreement is sufficient.

These are model/protocol findings, not new measured uncertainty budgets. The
original angular/range limits in the [validation protocol](VALIDATION_PLAN.md)
remain unchanged. Model and correction blockers are recorded independently so a
model mismatch cannot conceal an additional correction mismatch.

The [alignment decision](ALIGNMENT_DECISION.md) identifies the next route: a
separate geometric DE440 reference evaluator using JPL's ASCII distribution and
published test values, without replacing production kernels. It also documents
why Horizons' DE440-based rotation mapped to the DE421 mean-Earth frame is not
automatically identical to the preview's DE421 rotation. No gate is closed by
that documentary finding alone.

## DE440 installation spot-check

On 2026-11-14 the pinned **DE440s SPK** passed all **17 selected scalar
components** from JPL's official `testpo.440`: **7 position and 10 velocity**
components. This is a scoped kernel-reading/model-consistency check, **not** a
full TESTPO pass, independent observational validation or acceptance of the
encoded preview. The report outcome remains `completed_with_open_gates` with
no accepted scientific scopes.

### Selection and conventions

- Inputs: JPL's [TESTPO](https://ssd.jpl.nasa.gov/ftp/eph/planets/ascii/de440/testpo.440),
  [DE440 header](https://ssd.jpl.nasa.gov/ftp/eph/planets/ascii/de440/header.440)
  and [TESTEPH](https://ssd.jpl.nasa.gov/ftp/eph/planets/fortran/testeph.f), with
  retained HTTP/byte-count/SHA-256 receipts checked before comparison.
- TESTEPH documents target/center codes **3=Earth, 10=Moon, 11=Sun, 12=SSB,
  13=EMB**. These map to NAIF **399, 301, 10, 0, 3**, respectively. Both ends
  must be in this predeclared subset; other planets, nutations and librations
  are excluded. The subset was not expanded or narrowed after seeing residuals.
- Coordinate codes 1-3 are x/y/z in **AU**; 4-6 are their derivatives in
  **AU/day**. SPICE `spkezr` uses `J2000`, `NONE`; km and km/s are converted
  with the header's **149597870.7 km/AU** and **86400 s/day**.
- The [JPL export documentation](https://ssd.jpl.nasa.gov/planets/eph_export.html)
  specifies TDB days. Each numeric JED is converted directly using
  `ET = (JED - 2451545.0) * 86400`, subtracting in decimal arithmetic first.
  The calendar column is not interpreted as UTC.
- Selection uses the frozen preview's half-open ET span
  **[820497669.18392, 1136030469.1839027)**, corresponding to its declared
  [2026-01-01, 2036-01-01) UTC coverage. Of **13,201** rows, **13,081** are
  outside that span. The remaining **120** run from 2026-02-01 to 2036-01-01
  in the file's TDB calendar: TDB midnight on 2026-01-01 precedes the UTC-based
  start, while TDB midnight on 2036-01-01 precedes the exclusive end. Of those
  120, **103** are outside the body subset and **17** are compared. All 103
  in-span exclusions, their original line numbers and values are in the report.
- TESTEPH warns at `DEL >= 1.D-13`; the pass criterion is therefore strictly
  **absolute difference < 1e-13**, separately in AU or AU/day. This criterion
  was fixed before comparison and does not replace any preview error budget.

### Measured results

| Quantity | Components | Maximum absolute difference | Criterion |
| --- | ---: | ---: | --- |
| Position | 7 | 2.0708261494473135e-17 AU | < 1e-13 AU |
| Velocity | 10 | 3.469446951953614e-18 AU/day | < 1e-13 AU/day |

Selected cases below use TESTPO target/center/coordinate codes, not NAIF IDs.
Residuals are rounded here; the report retains full binary64 values. Zero means
equality after the printed reference is parsed as binary64, not zero physical
error. These are individual components, not 17 full six-component states.

| TESTPO line | TDB calendar date | Target | Center | Coordinate | Absolute difference (AU or AU/day) |
| ---: | --- | ---: | ---: | ---: | ---: |
| 5726 | 2026.06.01 | 12 | 3 | 2 | 0 |
| 5732 | 2026.12.01 | 3 | 11 | 6 | 0 |
| 5739 | 2027.07.01 | 11 | 3 | 3 | 0 |
| 5740 | 2027.08.01 | 11 | 10 | 2 | 0 |
| 5743 | 2027.11.01 | 11 | 10 | 6 | 8.673617380e-19 |
| 5747 | 2028.03.01 | 11 | 12 | 5 | 4.235164736e-21 |
| 5748 | 2028.04.01 | 10 | 11 | 6 | 0 |
| 5752 | 2028.08.01 | 3 | 10 | 2 | 0 |
| 5754 | 2028.10.01 | 12 | 11 | 3 | 0 |
| 5780 | 2030.12.01 | 10 | 13 | 3 | 2.070826149e-17 |
| 5784 | 2031.04.01 | 13 | 3 | 5 | 8.665147050e-19 |
| 5786 | 2031.06.01 | 10 | 11 | 5 | 8.673617380e-19 |
| 5790 | 2031.10.01 | 13 | 12 | 5 | 3.469446952e-18 |
| 5810 | 2033.06.01 | 13 | 10 | 2 | 1.257674520e-17 |
| 5817 | 2034.01.01 | 3 | 10 | 6 | 1.355252716e-20 |
| 5822 | 2034.06.01 | 12 | 13 | 4 | 0 |
| 5828 | 2034.12.01 | 3 | 13 | 4 | 6.632267977e-19 |

### Evidence and limitations

Local report ID: `alignment-testpo-rerun-20261114`, with results in `report.json`
under that report's directory in the ignored data reports root. These local
artifacts are not distributed with the repository.
Its sibling checker, six header regression tests and source ZIP are retained in
the ignored report directory. It used CPython **3.12.2**, NumPy **2.2.6**,
SpiceyPy **7.0.0**, **CSPICE_N0067**. The existing 123-test suite and all six
checker tests passed with site-packages disabled; the numerical run used the
pinned scientific environment. This checker is a one-off local audit, not an
installed workflow or a general TESTPO parser. To replay locally, copy the checker
and its test file to a fresh sibling directory under the same reports root, run
the tests and then the checker using the pinned environment. It refuses to
overwrite a prior report and expects the retained inputs/cache at their recorded
locations. No Fortran executable or independent ASCII evaluator was run.

| Evidence | SHA-256 |
| --- | --- |
| Successful report | `0a8f31232cf2d2a2a53c32be032a5a5d5136440e35248eba49bf6cfed7c4c2ab` |
| TESTPO | `45084a7f406b8e41032e7d99dd8042d4df97a9f752a68c06d1a27af16693429f` |
| DE440 header | `0f4636b663e6f00af9efa2b605ef23635489f56b23dd1a5e3821d3acc6ac3359` |
| TESTEPH source | `18f32f073c1a345850d9deebc8b53b06c83a386c066b566f65001b51adeb7120` |
| Pinned DE440s SPK | `c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2` |
| Checker | `ddd306e0ba307540368d557e9adaed0c43d220136f04971135e8394605ad4308` |
| Checker tests | `313f407626de0fc1c3ca4a6f4740a4a975eb7c396585343437b863d52a56012a` |
| Source ZIP | `3783e5a232a8cda2ed7426fdd3a0b1f4426d45ca02144bb0e6332d2d4b08f1e1` |

The first attempt stopped on the official file's leading blank header line,
before comparing any components. Its failed `report.json` remains untouched in
the same local reports root, under report ID
`alignment-testpo-audit-20261114T084039Z-5a14a969`.
The corrected run preserves the original subset, span and criterion. Hashes bind
local evidence; they are not publisher signatures.

The run verified unchanged preview bytes, pinned kernels, profiles, reference
cache and historical selected evidence. The preview remains **122 chunks / 248
files / 2,314,609 bytes**, with manifest SHA-256
`9c533a0b6879a2ecb79718369444ba35bf8ce693f753beae487e8a6b2af88277`.
This sparse geometric spot-check does **not** validate the encoded/interpolated
dataset, apparent corrections, lunar orientation, surface observers, the complete
TESTPO file or observational accuracy. It does not change the four Horizons
case statuses or close their model/correction blockers. The recommended next
step is the separately tested ASCII evaluator described in the alignment decision,
followed by separate DE421-orientation and surface-observer validation.

## Reference-only workflow

`run_reference_validation.py` runs the standard-library regression suite, validates
the preview, verifies the pinned kernels, and audits the existing four-case matrix.
It does not rerun browser or encoded-observer checks; use the component runner for
those. Both runners keep scientific acceptance withheld.

- Default behavior is offline. No cache means four `blocked_missing_reference`
  cases, not a pass. An explicitly supplied cache root must exist.
- `--reference-cache` reads an old cache without changing it. A verified case's
  request, receipt and exact response bytes are copied into the new report's
  `reference-cache` and replayed again. Unrelated cache files are not copied.
- An absent case, or a matching request accompanied by an acquisition-error record
  with neither response nor receipt, is missing evidence. Partial/corrupt receipts,
  wrong requests and invalid payloads are failures, not permission to replace them.
- `--acquire-missing` explicitly permits serial requests for missing cases only.
  New downloads go into the new report, never the input cache. After a network
  failure, subsequent network requests are blocked; verified later cached cases
  are still replayed. There is no automatic retry within a run.
- Each new report records all four cases, source hashes/ZIP, kernel evidence,
  per-case results, artifact hashes and before/after publication checks. It can
  supply the cache for the next deliberate resume attempt.

Header parsing requires unique, exact convention fields and model tags attached
to the correct target/center lines, plus the expected position-only CSV columns.
Requests are canonical and epochs unique/increasing. Response and receipt reads
are bounded. Hash receipts bind local bytes; they are not publisher signatures.

## Reading the result

`verified_response_cases` and `matrix_complete` describe acquisition/replay
coverage, **not scientific acceptance**. `matched_inertial_cases` counts only
model/correction-matched comparisons within the predeclared limits. Every result
retains its diagnostic residuals and any acceptance blockers.

Missing/network-blocked references and valid model mismatches yield
`completed_with_open_gates` (exit zero). Invalid cached/network evidence or a
matched comparison outside its budget yields `failed` (exit one). Even four
verified responses do not close orientation or external surface-observer gates.

## Acquisition checkpoint and next acceptance steps

The four-case matrix is now locally complete: both Sun cases were reused with
byte-identical receipts and both Earth cases were acquired into a new report.
All 100 epoch comparisons were replayed offline. All four cases remain
`model_mismatch` (DE441 versus DE440); both apparent cases also retain
`correction_semantics_unmatched`. Diagnostic residuals are not scientific passes.
See [selected reference evidence](validation/README.md) for source-bound results.

1. Preserve and replay the complete receipt cache. New missing cases or acquisition
   failures can use the explicit resume workflow; no network retry is needed for
   the already-completed matrix.
2. Obtain a documented, model-matched external reference for the current preview,
   or explicitly review a new model/configuration and generate a separate dataset.
   Downloading a different kernel alone does not validate the old preview.
3. Resolve correction algorithms and lunar orientation/surface-observer semantics
   before declaring those scopes accepted.
4. Validate terrain/catalog/visibility products separately. None is established by
   these center-vector comparisons.

See [setup commands](IMPLEMENTATION.md) for invocation. Retained reports and raw
responses stay local and ignored; the frozen selected evidence remains historical,
not a claim that its source hashes match subsequent code revisions.