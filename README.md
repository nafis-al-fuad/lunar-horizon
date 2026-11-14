# Lunar Horizon

Offline data tools for exploring modeled Sun and Earth geometry at the Moon.

**This repository contains a numerical preview, not a finalized scientific
dataset or a working website.** Terrain-aware visibility, verified landing-site
catalogs, event searches, scenario metrics and the visual frontend are not yet
implemented. Nothing here certifies landing safety or mission viability.

## Included

- Python generation, validation, packaging and explicit source-acquisition tools.
- Analytic, integrity and rejection tests, plus native JavaScript consumers.
- A fixed synthetic fixture generator, clearly separated from real ephemerides.
- An immutable Sun/Earth preview covering **2026-01-01 through 2035-12-31**
  (the endpoint 2036-01-01 is excluded): 122 chunks, 2,314,609 bytes in total.
- Source citations, model configuration, pinned dependencies and validation protocol.

The preview uses DE440 positions and DE421 lunar orientation. External reference
acceptance is withheld: available historical Sun references used DE441 instead
of DE440, and the reference matrix was not fully acquired. Numerical agreement
with local SPICE is not independent scientific validation.

## Get started

See [setup and commands](data/IMPLEMENTATION.md). The tested generation environment
is Windows x86-64, CPython 3.12.2, Node 24.18.0, NumPy 2.2.6 and SpiceyPy 7.0.0.
The Python regression suite and synthetic workflow require no third-party Python
packages. Real generation and observer validation additionally require the pinned
scientific dependencies and separately acquired kernels.

No npm dependencies, public server or NASA service calls are needed to consume
the prepared preview. Online acquisition is always explicit.

## Repository layout

- [Data tools and commands](data/IMPLEMENTATION.md)
- [Preview format and future website integration](data/DATA_FORMAT.md)
- [Validation protocol](data/VALIDATION_PLAN.md)
- [Selected validation evidence](data/validation/README.md)
- [Source attribution and licensing boundary](THIRD_PARTY_NOTICES.md)
- [AI assistance disclosure](AI_USE.md)

The data package is stored under `data/generated` without renaming its internal
resources. A future website can reuse the JavaScript consumer and copy the
selected package into its static assets during deployment. The Python pipeline
is not a website runtime dependency. No frontend framework has been selected.

Only reviewed deliverables belong in Git. Raw kernels/rasters, working builds,
local report history, virtual environments, credentials and task diaries are
excluded. New generated packages are ignored until explicitly selected.

## Release and licensing boundary

The included dataset remains `numerical_preview_only` with no accepted scientific
scopes. Its embedded validation metadata describes generation-time checks;
subsequent component evidence lives separately and does not rewrite the manifest.

**An original-code license has not yet been selected.** This local repository is
not being represented as an open-source release. Choose a license and review
third-party obligations before public publication; no license grant for third-party
material is implied. This project is not a NASA/JPL endorsement or certification.