"""Explicit opt-in, checksum-pinned acquisition; never automatically downloads."""

import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from .core import contained_file, fields, file_digest, integer, json_bytes, require, time_span, utc_unix


class HTTPSOnlyRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        require(urllib.parse.urlsplit(newurl).scheme == "https", "non-HTTPS redirect rejected")
        return super().redirect_request(request, fp, code, message, headers, newurl)


def verify_source(path, expected_bytes, expected_sha256):
    require(path.stat().st_size == expected_bytes, "source byte count mismatch")
    require(file_digest(path) == expected_sha256, "source checksum mismatch")


def acquire(spec, raw_root, opener=None):
    """Save bytes only after verification. Keep immutable source spec beside input.

    The caller supplies a reviewed hash/size and rights, not a guessed catalog entry.
    Failed partials are removed; existing source data are never deleted or overwritten.
    """
    fields(spec, ("id", "url", "filename", "bytes", "sha256", "product_version", "citation", "license", "redistribution_status", "retrieved_at_utc", "native_frame", "units", "time_coverage"), "source spec")
    from .core import identifier
    identifier(spec["id"])
    parsed = urllib.parse.urlsplit(spec["url"])
    require(parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password and not parsed.fragment, "source URL must be HTTPS without credentials/fragment")
    integer(spec["bytes"], "source bytes", 1)
    require(isinstance(spec["sha256"], str) and len(spec["sha256"]) == 64 and all(c in "0123456789abcdef" for c in spec["sha256"]), "reviewed SHA-256 required")
    for key in ("product_version", "citation", "license", "units"):
        require(isinstance(spec[key], str) and spec[key].strip(), f"source {key} required")
    require(spec["native_frame"] is None or isinstance(spec["native_frame"], str) and spec["native_frame"].strip(), "invalid source frame")
    if spec["time_coverage"] is not None:
        time_span(spec["time_coverage"])
    require(spec["redistribution_status"] in {"permitted", "restricted"}, "unresolved source rights")
    utc_unix(spec["retrieved_at_utc"])
    root = Path(raw_root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    require(isinstance(spec["filename"], str) and "/" not in spec["filename"], "source filename must be a basename")
    destination = contained_file(root, spec["id"] + "/" + spec["filename"])
    evidence = destination.with_name(destination.name + ".source.json")
    serialized = json_bytes(spec)
    require(not evidence.exists() or evidence.read_bytes() == serialized, "source evidence conflicts with existing record")
    if destination.exists():
        verify_source(destination, spec["bytes"], spec["sha256"])
        require(evidence.exists(), "existing source lacks acquisition evidence")
        require((destination.parent / "acquisition.json").is_file(), "existing source lacks acquisition receipt")
        return destination
    require(not destination.parent.exists(), "source ID directory already exists; inspect it or use a new ID")
    require(spec["filename"] != "acquisition.json", "reserved source filename")
    if opener is None:
        opener = urllib.request.build_opener(HTTPSOnlyRedirect()).open
    request = urllib.request.Request(spec["url"], headers={"User-Agent": "LunarNavigator-OfflineFoundation/0.1", "Accept-Encoding": "identity"})
    # The whole source directory becomes visible only after bytes and evidence pass.
    with tempfile.TemporaryDirectory(prefix=".acquire-", dir=root) as directory:
        stage = Path(directory)
        temporary = stage / spec["filename"]
        with temporary.open("xb") as output, opener(request, timeout=60) as response:
            require(urllib.parse.urlsplit(response.geturl()).scheme == "https", "non-HTTPS response")
            require(response.status == 200, "source HTTP status must be 200")
            resolved_url = response.geturl()
            total = 0
            while block := response.read(1024 * 1024):
                total += len(block)
                require(total <= spec["bytes"], "source exceeds pinned size")
                output.write(block)
        verify_source(temporary, spec["bytes"], spec["sha256"])
        (stage / evidence.name).write_bytes(serialized)
        (stage / "acquisition.json").write_bytes(json_bytes(dict(
            received_at_utc=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            resolved_url=resolved_url, bytes=spec["bytes"], sha256=spec["sha256"],
            note="Source specification timestamp is supplied metadata; received_at_utc records this acquisition.")))
        stage.rename(destination.parent)
        return destination