# Sources and licensing boundary

## Original project material

No original-code license has been selected yet. Public release requires the
owner's license decision; making a repository public alone does not supply an
open-source license. This document does not relicense third-party data or software.

## Numerical sources

The kernel lock in [the source profile](data/profiles/ephemeris-sources.json)
records the official URLs, exact byte counts, SHA-256, versions, citations and
reviewed source-use statements for:

- NASA/JPL NAIF `naif0012.tls`: leap-second/time conversion.
- NASA/JPL NAIF `pck00011.tpc`: physical constants.
- NASA/JPL NAIF `moon_080317.tf`: lunar ME/PA frame definitions.
- NASA/JPL NAIF `moon_pa_de421_1900-2050.bpc`: DE421 lunar orientation.
- NASA/JPL NAIF `de440s.bsp`: DE440 planetary ephemeris.

Consult [NAIF rules regarding SPICE use](https://naif.jpl.nasa.gov/naif/rules.html)
and retain the source notices and disclaimers. The repository contains derived
preview arrays and provenance, not copies of the raw kernels. Checksums identify
the reviewed bytes; they do not prove scientific suitability or grant rights.
Recorded SHA-256 values were measured from HTTPS downloads, not signed upstream
digests. A separate published MD5 check for DE440s is not an authenticity guarantee.

JPL Horizons is used only by explicit external-reference acquisition. See its
[API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html). A matching
correction label alone does not establish matching implementation semantics.

## Software dependencies

CPython, Node.js, NumPy, SpiceyPy and the CSPICE toolkit retain their upstream
licenses and notices. Their executables, installed environments and wheels are
not vendored here. The hash-pinned scientific lock currently covers Windows
x86-64 CPython 3.12 wheels only; it is not a cross-platform lock.

No NASA logos, mission imagery, third-party terrain rasters or website assets
are included. Future additions need their own source and rights review.