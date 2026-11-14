# Selected component evidence

This directory contains a compact, source-bound [validation summary](summary.json)
and the frozen [Python/JavaScript parity cases](javascript-parity.json) for the
selected numerical preview. It is not a
session timeline or a copy of local run history. Detailed command logs, browser
requests and source archives remain in the ignored local reports directory.

The summary records the tested source hashes, dataset manifest hash, environment,
test outcomes, endpoint-control evidence and remaining acceptance boundaries.
It reports executed checks only. A successful local SPICE comparison is not an
independent scientific reference. Headless desktop browser checks are not visual
UI, mobile, accessibility or performance acceptance.

The companion parity file is numerical output from the Python consumer, not an
external truth dataset. The Node smoke command in the setup guide compares all
122 chunks against these 732 cases (5,856 individual values) and exercises error
rejection. The selected preview retains its original generation-time flags;
later evidence does not mutate its manifest or promote its scientific status.

## Verified scope

- Foundation and component runs each passed **98 Python tests**.
- Source ZIPs from both runs independently replayed all 98 tests with third-party
  site-packages disabled. Required profiles and the HTML harness were included.
- The immutable preview passed before/after integrity checks: **122 chunks**,
  248 files and 2,314,609 bytes, with the original manifest unchanged.
- Local SPICE encoded-observer comparisons: **21,960 passed** under the
  predeclared 0.0021-degree angular/altitude ceiling. Range remains diagnostic.
- Node: **5,856 value comparisons and 12 rejection cases passed**.
- Headless Windows Chrome and Edge: each passed **5,856 value comparisons**,
  121 seam checks, 18 rejection cases and 288 repeated-chunk value comparisons.
  The final padded chunk permits local interpolation at the release endpoint;
  the public sampler still rejects it with `ET outside release`.
- External reference acquisition/replay: **not run** in these selected runs.
  Orientation and external observer acceptance remain blocked on model alignment.

The component outcome is **`completed_with_open_gates`**, not scientific
acceptance. Earlier reference attempts reported DE441 versus this preview's
DE440; those attempts are not presented as a pass by this offline summary.

The selected full runs used an existing pinned Python environment outside the
repository and separately stored raw kernels. Archive replays disabled
site-packages and imported only their extracted sources; a fresh scientific
dependency installation and full decade regeneration were not performed here.

## Evidence boundary

The JSON summary is a curated, allowlisted extract, not the raw report. It omits
local executable/home paths, browser tokens, process IDs and request logs. Source
paths in it are relative to the data directory. The source hashes identify the
validation implementation, not the older producer revision in the preview.
Original report/archive hashes and relative artifact digests bind this extract
to evidence retained locally, but are not signatures or independently hosted proof.

No raw report or archive needs to be committed to reproduce these checks: run the
documented workflows to produce new local evidence. Timestamps identify a selected
validation, not a development timeline. Browser duration/heap measurements remain
local observations, not claimed performance budgets or leak guarantees.

See the [component protocol](../VALIDATION_PLAN.md) and
[setup commands](../IMPLEMENTATION.md) for reproduction and scope.