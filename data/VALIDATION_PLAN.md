# Ephemeris component validation protocol

This protocol applies to the numerical preview, not a scientific release.
Original numerical budgets and test matrix are retained unchanged.
Run evidence is stored locally in the ignored reports directory; selected
public summaries belong alongside, never inside, an immutable dataset.
Do not change source files during a validation run or overwrite old evidence.
An interrupted report marked `running` does not establish success.

## A. Encoded surface-observer check

Read and validate the published manifest and every binary. Use both profiles and
both targets. For every chunk sample its start, start + 0.375 step, and the last
representable ET before the lesser of its end and the release end. This includes
both sides of all seams and the exclusive release endpoint from inside coverage.
Use all five existing analytic benchmark locations (south pole with explicit
meridian, near-pole, near-side equator, limb, far side), and radius offsets
0, 0.002, 12 km. They are not verified landing sites or terrain elevations.

Compare decoded Float32 -> interpolation -> direction/range -> observer subtraction
against SPICE `spkcpo`, output MOON_ME_DE421, refloc OBSERVER, corrections NONE/LT+S.
Record per-case angular residual, altitude residual, range residual and extrema.
Predeclared combined angular/altitude ceiling: **0.0021 deg**, both profiles/targets.
This conservatively adds the existing 0.001 deg encoding and 0.001 deg observer
budgets, with 0.0001 deg for topocentric amplification and range quantization.
Range residual is diagnostic (no new range pass claim for the apparent observer
approximation). Existing center-range/time budgets remain unchanged. No azimuth
pass claim at zenith/nadir; no terrain or physical-uncertainty guarantee.

## B. External reference

Use JPL Horizons API, serial requests with timeout and response-size cap. Record
URL, parameter dictionary, timestamp, HTTP status/headers, exact raw response bytes,
SHA-256, API signature, full service header and reported dynamical model. Offline
replay must verify receipts and exact requests, with no network fallback.

Initial frozen matrix: Sun (10) and Earth (399), center 500@301, VECTORS table 1,
KM-S, ICRF / FRAME, TDB JD epochs, CSV, corrections NONE and LT+S. Epochs: Jan 1
and July 1 at 00:00 UTC in every year 2026–2035, plus first-chunk off-knot
(start + 4050 ET s), first seam - 1 s / seam / seam + 1 s, and release end - 1 s.
Convert UTC using pinned LSK; future leaps are not predicted. Serialize JD with
decimal arithmetic and compare SPICE at the exact requested JD, checking returned
epochs within 0.0001 s. Do not use low-precision JD subtraction for epoch matching.

First compare Moon-centered inertial vectors against direct DE440 SPICE. Diagnostic
ceilings: **0.000001 deg**, **0.1 km Sun / 0.01 km Earth**. These are generous
implementation-concordance budgets, not physical uncertainties. Require explicit
header checks for target, center, reference frame, units, corrections and model.
Different/unknown dynamical models or correction semantics are **model_mismatch /
unmatched**, even with small residuals. Shared JPL solutions are not independent
observational validation. No silent tolerance relaxation or model relabeling.

Then assess lunar orientation and external surface-observer calculations separately.
The preview combines DE440 positions and DE421 orientation; Horizons surface models
must be identified before those comparisons can be accepted. Until a matching
orientation/correction reference is established, external lunar-fixed and observer
acceptance remain **not_run / blocked_model_alignment**, not implied by inertial
agreement or the local SPICE observer check. Terrain-aware checks are out of scope.

The separate [reference-resume workflow](REFERENCE_ALIGNMENT.md) preserves this
matrix and its budgets. It can audit partial caches offline and explicitly acquire
missing cases into a new report. Missing and corrupt evidence are distinct; no
corrupt case is replaced by an automatic download. Model tags must belong to the
target and center header lines, convention fields must be unique/exact, and model
and correction blockers are recorded separately. Complete receipt coverage is not
scientific acceptance. The existing full component runner still requires a complete
cache for its strict replay mode.

## C. Actual browser component scope

Run installed Windows desktop Chrome and Edge in headless mode with isolated
temporary profiles. Record executable/version, user agent and automation mode.
Use existing native ES modules, Fetch and Web Crypto through loopback HTTP; no npm
dependencies. A Python-approved trusted manifest is a prerequisite, not an
untrusted-manifest security claim. No public deployment or raw-kernel HTTP access.

Pass criteria in each browser:
- Startup package reads exactly manifest + time, no chunks; first requested chunk
  adds exactly descriptor + binary. Record request counts/bytes and durations.
- All 122 chunks decode/hash-check; all 121 seams have identical overlap samples.
- Frozen published Python parity cases pass: unit components <= 1e-12 absolute;
  ranges <= 1e-6 km. UTC knots/start match and invalid dates/leaps/end are rejected.
- Reject global exclusive endpoint, before-start/nonfinite epochs, wrong chunk,
  invalid index/profile, truncated/nonfinite/metadata-mismatched data, HTTP missing
  binary, and checksum-corrupted binary. Never mutate the publication for faults.
- Repeated first/last/middle chunk changes remain numerically correct; no caller
  cache is assumed. Record bounded per-chunk decoded value counts.
- Record startup/full-run/fetch durations, bytes and available heap observations.
  These are observations, **not** performance/memory acceptance thresholds or proof
  of absence of leaks. Missing memory APIs must be reported as unavailable.

Headless desktop component success is not headed UI, accessibility, mobile,
Firefox/Safari, worker, device or full frontend validation. Browser crashes/timeouts
fail the stage; unsupported environments remain explicit.

Implementation clarification, 2026-11-14: isolate endpoint rejection using the
last chunk, whose grid extends past the release end. Verify chunk-local
interpolation succeeds at that padded endpoint, then require the public sampler
to reject it specifically as outside the release. This adds no usable coverage
and changes no numerical tolerance. Preserve subprocess timeout/launch evidence
and browser setup/cleanup failures rather than losing the stage result.

## Completion rules

Run all Python tests and JavaScript syntax checks; inspect saved reports and source
hashes; revalidate publication after testing. Report scope-specific passed/failed/
blocked/not_run outcomes. Keep published manifest flags unchanged (`not_run` at
generation time), and attach new evidence externally. Full v3/V01–V12 acceptance,
terrain, catalog, events, safety and scientific release promotion remain withheld.