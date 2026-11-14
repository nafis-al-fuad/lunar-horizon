# Reference alignment decision

Assessment date: 2026-11-14. This is a validation-route decision, not release
approval. The preview, production kernels, original tolerances and historical
selected evidence remain unchanged. No scientific scope is newly accepted.

## Decision

**Keep the current DE440-position / DE421-orientation preview. Build a separate,
offline DE440 reference evaluator, starting with geometric positions.** Do not
switch production models merely to obtain a Horizons pass, or keep repeating the
already-complete Horizons matrix. Keep its residuals as cross-model diagnostics.

The narrow [DE440 installation spot-check](REFERENCE_ALIGNMENT.md#de440-installation-spot-check)
is complete: all 17 selected scalar components passed the unchanged TESTEPH
criterion (7 position and 10 velocity components). This is not a full TESTPO pass.
Next evaluate JPL's ASCII coefficients through a separately tested implementation
that does not call SPICE or the preview interpolator. This can establish
model-matched implementation concordance, not independent observational accuracy.
It does not by itself close the existing Horizons, orientation or observer gates.
Any additional acceptance protocol must be declared before the new comparisons;
the existing protocol and its budgets are not retroactively reinterpreted.

## Findings that determine the route

| Question | Evidence | Consequence |
| --- | --- | --- |
| Can the retained Horizons vectors validate DE440 as the same model? | Both target and center report DE441. The manual lists DE441 for Sun, Earth and Moon. No DE-version selection parameter was found in the reviewed API documentation. | No. Preserve the mismatch; do not invent a DE440 selector. |
| Are the two `LT+S` profiles equivalent? | Retained Horizons footers say Newtonian receive light time plus **relativistic** stellar aberration. SPICE documents a one-iteration `LT` solution and Newtonian `LT+S`. | Equal names do not mean equal algorithms. Do not substitute `CN+S`, or infer the Horizons iteration count from its label. |
| Does Horizons `MOON_ME` mean our exact rotation model? | The manual describes DE440 principal-axis rotation mapped by a fixed offset into the DE421 mean-Earth frame. Our explicit `MOON_ME_DE421` uses DE421 rotation data. | A shared cartographic frame name is insufficient to match time-dependent orientation. |
| Can WebGeocalc provide an exact comparison? | NAIF documents it as a server interface to SPICE. Exact installed kernel versions, load order, supported observer setup and a working API route were not established in this review. | Keep as a candidate, not a confirmed dependency or independent implementation. |
| Is a model-matched offline source available? | JPL distributes DE440 ASCII coefficients, `header.440`, `testpo.440` and the TESTEPH format/checking code. | Use a reference-only evaluator with verified inputs and explicit scope. |

### Orientation is a separate issue, not merely a name mismatch

The [Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html), under
"Lunar Mean-Earth Frame of DE421", describes a fixed offset from the **DE440** PA
system to the standard DE421 ME frame. It labels the high-precision model
`MOON_ME` over 1550-2650, with an IAU-model fallback outside that interval.

The [pinned DE421 frame kernel](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf)
instead defines `MOON_ME_DE421` relative to `MOON_PA_DE421` (frame IDs 31007 and
31006). NAIF's [DE440 frame specification](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf)
uses `MOON_ME_DE440_ME421` relative to `MOON_PA_DE440` (31009 and 31008), and calls
the result **closely aligned**, not identical, to the DE421 frame. This identifies
a relevant distinction; it does not verify which exact kernel bytes Horizons uses.
No DE440 orientation kernel was installed or loaded for this assessment.

The producer rotates its inertial vectors at **observation ET**. Its local direct
surface-observer check uses `spkcpo` with `REFLOC=OBSERVER`, which evaluates the
output frame at that epoch. An external check must also match observer position,
east longitude, latitude definition, radius/elevation datum, units, observation
epoch and corrections. `APPARENT=AIRLESS` is not geometric `NONE`; absence of
refraction does not remove light-time or aberration corrections. `REF_PLANE=BODY`
is documented as body equator and node of date, not a general switch to the
preview's lunar-fixed Cartesian frame.

## Next implementation: geometric DE440 reference evaluator

1. **Acquire separately, never replace inputs.** Review rights/provenance and fetch
   the [DE440 source files](https://ssd.jpl.nasa.gov/ftp/eph/planets/ascii/de440/)
   with bounded reads, exact byte receipts and explicit network opt-in. The listed
   `ascp01950.440` block is the candidate for this decade (directory size about
   29.2M); inspect actual record boundaries before accepting coverage. Header and
   TESTPO are already retained locally. A measured SHA-256 is not a JPL signature.
2. **Implement a narrow standard-library evaluator.** Parse `GROUP 1050` pointers,
   Fortran `D` exponents, record/subinterval spans and Chebyshev coefficients from
   the [documented format](https://ssd.jpl.nasa.gov/ftp/eph/planets/ascii/ascii_format.txt).
   Use split/decimal time arithmetic before forming the polynomial argument. Reject
   invalid models, sizes, pointers, nonfinite values, gaps and unsupported epochs.
   Do not reuse SPICE for expected values.
3. **Reconstruct the correct bodies.** The file stores the Earth-Moon barycenter
   `B` and geocentric Moon vector `G`, not separate barycentric Earth and Moon
   coefficients. With the header's Earth/Moon mass ratio `q`, use
   `Earth = B - G/(1+q)` and `Moon = B + q*G/(1+q)`. Use the Sun coefficients for
   the Sun. Do not confuse TESTPO IDs with NAIF IDs.
4. **Validate the evaluator before using it as a reference.** Add analytic constant,
   linear and higher-order polynomial/derivative cases, endpoint/subinterval tests,
   Earth-Moon reconstruction checks and malformed-input tests. Compare applicable
   official TESTPO components using its documented units and criterion. Explicitly
   count excluded bodies/epochs; never present a subset as a full TESTPO pass.
5. **Compare at the frozen 25 TDB epochs.** Check Moon-relative Sun/Earth geometric
   vectors against pinned DE440 SPICE with the existing inertial diagnostic limits.
   Retain source snapshots, per-case residuals, coverage and immutable-input checks.
   This is an additional geometric implementation check, not apparent acceptance or
   a substitute for the encoded/interpolated preview's separate numerical checks.

The installation criterion in JPL's
[TESTEPH](https://ssd.jpl.nasa.gov/ftp/eph/planets/fortran/testeph.f) warns when a
component difference is **greater than or equal to `1e-13`** in AU or AU/day.
That criterion concerns the published scalar test values, not a new preview error
budget. Libration checks have separate handling in TESTEPH and are out of scope
for the first position-only evaluator. TESTPO's sparse epochs/components do not
provide all vectors in our frozen matrix.

## Subsequent gates and stop conditions

- **Apparent:** only after geometric checks, separately implement and test the
  documented SPICE reception semantics using independently evaluated barycentric
  positions/velocities. Check one-iteration light time and stellar aberration,
  without claiming equivalence to Horizons. Do not infer a physical accuracy bound
  from small implementation residuals.
- **Orientation:** use a model-matched DE421 orientation reference. JPL's
  [DE421 ASCII distribution](https://ssd.jpl.nasa.gov/ftp/eph/planets/ascii/de421/)
  includes lunar librations; its `ascp1900.421` is a candidate. Verify Euler-angle
  convention, rotation order/direction, PA-to-ME transform and coverage before any
  comparison. Define its acceptance criterion before measuring residuals. No
  independent orientation evaluator or external orientation pass exists yet.
- **Surface observers:** combine validated position/orientation calculations with
  the five existing analytic sites and radius offsets. Match the direct observer's
  velocity as well as position for apparent corrections. Preserve the existing
  0.0021-degree encoded-observer ceiling and diagnostic-only range status. Analytic
  sites are not verified landing sites or terrain elevations.
- **WebGeocalc alternative:** use only if exact kernel configuration and request/
  response provenance can be established. Service agreement with the same SPICE
  implementation is useful reproducibility evidence, not independent algorithms.
  A timeout or failed documentation URL does not establish service unavailability.
- **Release:** review each scope separately. If a model change is justified later,
  create a new configuration and immutable dataset; never relabel the current one.
  Terrain/catalog/horizon/event products and their validation remain separate work.

## Evidence boundary

The retained manual, API documentation, DE header, TESTPO file and TESTEPH code
have local retrieval/hash evidence. Some documentation downloads timed out; those
failed receipts remain evidence, not successful acquisitions. The web-content
tool returned the ASCII-format guide, Fortran user guide, WebGeocalc page and
DE440 frame specification for review; subsequent local byte-download attempts
timed out. Those four documents therefore do **not** have successful local raw-byte
receipts from this retry. The numerical check uses the already-receipted TESTPO,
header and TESTEPH files, not those failed downloads. WebGeocalc's actual installed
kernels remain unverified. This review makes no new Horizons requests and does
not install a replacement kernel or dependency.
See [alignment/replay status](REFERENCE_ALIGNMENT.md) and the
[existing selected evidence](validation/README.md). Historical summaries retain
their original source bindings after this documentation change.