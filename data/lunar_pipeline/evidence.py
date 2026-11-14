"""Persistent subprocess evidence, including failed launches and partial timeouts."""

import os
import subprocess
from datetime import datetime, timezone

from .core import require
from .fixture import PROJECT


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def run_command(name, argv, root, report, save):
    """Persist started/finished commands, including timeout output and launch errors."""
    argv = [str(a) for a in argv]
    log = root/(name+".log")
    record = dict(name=name, argv=argv, status="running", exit_code=None,
        started_at_utc=now(), log=log.name)
    report["commands"].append(record)
    save()
    stdout, stderr = "", ""
    try:
        process = subprocess.run(argv, cwd=PROJECT, capture_output=True,
            text=True, encoding="utf-8", errors="replace", timeout=240,
            env=os.environ | {"PYTHONUTF8": "1"})
        stdout, stderr = process.stdout, process.stderr
        record["exit_code"] = process.returncode
        require(process.returncode == 0, f"{name} failed")
        record["status"] = "passed"
        return stdout
    except Exception as exc:
        record.update(status="failed", error=f"{type(exc).__name__}: {exc}")
        if isinstance(exc, subprocess.TimeoutExpired):
            record["timeout_s"] = exc.timeout
            # TimeoutExpired may contain bytes even when text=True.
            def text(value):
                return value.decode("utf-8", errors="replace") if isinstance(value, bytes) else value or ""
            stdout, stderr = text(exc.stdout), text(exc.stderr)
        raise
    finally:
        log.write_text(stdout+stderr, encoding="utf-8")
        record["finished_at_utc"] = now()
        save()