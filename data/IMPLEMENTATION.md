# Setup and reproducible commands

## Supported environment

The tested numerical environment is **Windows x86-64, CPython 3.12.2,
Node 24.18.0, NumPy 2.2.6, SpiceyPy 7.0.0 and CSPICE_N0067**.
The generation runners enforce the Python/scientific versions. The browser runner
uses installed Windows Chrome and Edge, PowerShell and taskkill; it is not a
portable Linux/macOS browser driver. Missing browsers are reported as blocked.

All commands below start in this repository's `data` directory. From the
repository root, enter that directory with `Set-Location -LiteralPath '.\data'`.
Paths in the commands are relative to that directory, not to a particular user's
computer. The source resolves its own project directory at runtime.

## Python environment

With CPython 3.12.2 already installed and registered with the Windows launcher:

```powershell
py -3.12 -c "import platform; assert platform.python_version() == '3.12.2'"
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe --version
node --version
```

Stop if the version assertion fails; install/select the required interpreter
rather than silently changing the numerical environment. The environment is local
and ignored by Git. No npm installation is required.

Use a new virtual environment; do not replace an existing environment without
reviewing it. The commands use its interpreter directly, so activation and shell
execution-policy changes are unnecessary. The launcher selects a Python minor
version, not a patch version; the assertion above must succeed before proceeding.

## Tests and synthetic packaging: no scientific downloads

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -B run_pipeline.py
```

The test suite uses analytic or synthetic inputs and mocked network responses.
It needs only the Python standard library; one test serves loopback HTTP. The
foundation runner also compiles Python, runs Node parity/rejection checks, creates
a fixed synthetic fixture, validates its packaged copy, and archives source files.
Its synthetic coordinates, time mapping and intervals are not lunar predictions.

Outputs go into ignored `work`, `reports` and non-selected `generated` directories.
Each report has a unique name. A `running` report is not a pass. The runner's
printed report path identifies its logs and source ZIP. Do not edit inputs during
a run. Existing packages are immutable, not overwritten.

## Validate the included preview without raw kernels

```powershell
.\.venv\Scripts\python.exe -B -c "from pathlib import Path; from lunar_pipeline.ephemeris_release import validate_preview; print(validate_preview(Path('generated/ephemeris-preview-d68aa79075433edddec0e443')))"
node browser/ephemeris-smoke.mjs generated/ephemeris-preview-d68aa79075433edddec0e443 validation/javascript-parity.json
```

This checks structure, hashes and frozen Python/JavaScript parity; it does not
rerun the SPICE producer or establish external-reference agreement. The original
generation sources are fingerprinted in the manifest. Current validation code is
newer; source changes can produce a different identity in future generations.
The stored preview must not be relabeled or regenerated in place.

## Scientific dependencies and raw inputs

Installing dependencies is an explicit network operation unless suitable wheels
are already cached:

```powershell
.\.venv\Scripts\python.exe -B -m pip install --require-hashes --only-binary=:all: -r requirements-ephemeris.lock
```

Raw data must remain outside the repository and separate from build/publication
roots. The default is the `lunar-navigator-raw` directory under the user's home;
the legacy storage name is retained for compatibility. Set `LUNAR_RAW_ROOT` to an
absolute external directory to override it, or pass the runner's `--raw-root`.

The following explicit operation acquires the five reviewed kernels, using the
pinned URLs, hashes and source metadata. It reuses verified existing acquisitions
and rejects conflicting or changed bytes; it does not discover or approve updates.

```powershell
@'
import os
from pathlib import Path
from lunar_pipeline.core import disjoint_roots, strict_json
from lunar_pipeline.fixture import PROJECT
from lunar_pipeline.sources import acquire

raw = Path(os.environ.get('LUNAR_RAW_ROOT', str(Path.home()/'lunar-navigator-raw')))
disjoint_roots(raw, PROJECT.parent)
lock = strict_json((PROJECT/'profiles/ephemeris-sources.json').read_bytes())
for spec in lock['sources']:
    print(acquire(spec, raw))
'@ | .\.venv\Scripts\python.exe -B -
```

The separate `review_ephemeris_sources.py --download` tool is for deliberate
first-fetch source review, not a prerequisite for using the existing lock. Never
replace pinned hashes merely to make a changed download pass.
Unlike the runners, this review tool does not read `LUNAR_RAW_ROOT`; supply its
`--raw-root` explicitly when using a location other than the default.

## Regenerate the numerical preview

After the pinned dependencies and verified kernels are available:

```powershell
.\.venv\Scripts\python.exe -B run_ephemeris.py
```

The runner generates the full declared decade, tests interpolation/storage/time
and observer residuals, runs Node checks and packages a content-addressed preview.
It does not acquire sources or promote scientific acceptance. Modified source
fingerprints generate new identities even if numerical arrays are unchanged.
New outputs remain ignored until deliberately reviewed for inclusion.

## Component validation with actual browsers

```powershell
.\.venv\Scripts\python.exe -B run_component_validation.py
```

The default targets the included immutable preview. It runs all Python tests,
JavaScript syntax checks, 21,960 encoded observer comparisons, Node parity and
isolated headless Chrome/Edge tests through an allowlisted loopback HTTP server.
Raw kernels are never served. Preview hashes and source fingerprints are checked
before/after. Numerical budgets are in the profiles and validation protocol.

Default operation is offline: external references are `not_run`. For a deliberate
serial Horizons acquisition add `--acquire-reference`. For offline replay instead
pass `--reference-cache` followed by the absolute path to a complete cache from
a previous run. Missing/corrupt cache entries fail replay with no network fallback.
Acquisition stops after a network failure with no automatic retry.

**Exit zero with `completed_with_open_gates` is not scientific acceptance.**
DE441/DE440 model mismatches, unmatched correction semantics and unresolved lunar
orientation remain explicit regardless of small residuals. Desktop headless
checks do not certify a website, mobile devices, accessibility or performance.

See [the format](DATA_FORMAT.md), [protocol](VALIDATION_PLAN.md) and
[selected evidence](validation/README.md). Do not commit local report history,
source ZIPs, browser profiles, raw sources or personal filesystem paths.