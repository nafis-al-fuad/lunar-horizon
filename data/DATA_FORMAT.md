# Supported data formats and integration boundary

## Numerical preview

The selected package is `ephemeris-preview-d68aa79075433edddec0e443`, under
`data/generated` from the repository root. Its format is **ephemeris-preview-v1**,
not a general full-contract-v3 release. Its manifest and all indexed bytes are
immutable. The package contains 248 files totaling 2,314,609 bytes:

- `manifest.json`: identity, source/configuration fingerprint, coverage and hashes.
- `sources.json`: source specifications, acquisition receipts and kernel coverage.
- `time.json`: bounded UTC-to-ET mapping and the pinned leap-second assumption.
- `validation.json`: original generation-time numerical results and limitations.
- 122 binary chunks, each accompanied by a JSON descriptor.

Coverage is **[2026-01-01T00:00:00Z, 2036-01-01T00:00:00Z)**. ET is TDB seconds
past J2000. The overall release end is exclusive even when the final chunk has
extra padding. Out-of-range inputs must fail rather than clamp or extrapolate.

Positions use DE440 and lunar orientation uses MOON_ME_DE421. Each chunk contains
geometric (`NONE`) and apparent (`LT+S`) profiles, stored as little-endian Float32
arrays of eight channels per row:

1. Sun unit-vector x, y, z; Sun range in km.
2. Earth unit-vector x, y, z; Earth range in km.

The origin is the Moon's center, not a terrain surface observer. Sampling is every
10,800 seconds with two guard samples on either side. The consumer uses uniform
Catmull-Rom component interpolation followed by direction normalization; it does
not interpolate categorical visibility or terrain results. Apparent topocentric
subtraction is an approximation, not a replacement for a validated observer model.

The bounded time converter rejects invalid dates, unsupported leap seconds and
out-of-coverage UTC. It assumes no leap seconds after the pinned LSK's final entry
in 2017. A future leap update requires regeneration and validation.

## Loading in a future website

Use the native ES module `data/browser/ephemeris.mjs` and its adjacent
`consumer.mjs` dependency. `loadPreview(readBytes)` takes an asynchronous function
that returns a `Uint8Array` for a package-relative resource name. This lets a future
site choose its own deployment-aware base URL rather than hardcoding a domain or
repository subpath.

Startup reads only the manifest and time mapping. `preview.chunk(index)` loads and
hash-checks a descriptor/binary pair; `preview.sample(chunk, profile, et)` enforces
the global release boundary before interpolation. The caller selects and may cache
chunks. `utcToEt(preview.time, utc)` provides the supported time conversion.

Serve modules and data over HTTPS (or loopback HTTP during development) for Fetch
and Web Crypto. Preserve the entire package's internal relative structure and exact
bytes. Use a trusted Python-approved manifest; this is not a general security
validator for arbitrary downloaded manifests.

The diagnostic `component-check.html` is a test harness, not the product website.
Its `/package`, `/parity.json` and authenticated result routes are provided by the
Python validation server, so opening that HTML file directly is not supported.
Do not deploy the repository root or the diagnostic server as the production site.
The future deployment should copy only selected package assets and consumer/app
modules, not Python tools, reports, environments or raw data.

## Synthetic fixture

The foundation workflow generates a separate `synthetic-foundation-*` package.
Its fictional site, zero-offset time mapping, constant vectors and hand-authored
intervals exercise storage, integrity and rejection behavior. All computed
capabilities remain disabled. It is not interchangeable with this real preview
and must never be presented as a sourced lunar site or visibility prediction.

## What is not included

No verified landing-site catalog, DEM tiles, slopes, terrain horizons, sunlight
fractions, eclipse/event searches, power metrics, seasonal summaries or Plan B
search products are implemented. The full application will need separately
validated data and runtime calculations for those features. Shared ephemerides
alone cannot establish ridge blockage, longest darkness or landing suitability.