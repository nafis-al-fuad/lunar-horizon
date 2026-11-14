"""Allowlisted loopback server and real Chromium-family process, no Node emulation."""

import secrets
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from .core import json_bytes, require, strict_json
from .fixture import PROJECT


BROWSERS = {
    "chrome": Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    "edge": Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
}


class DiagnosticServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, release, parity, manifest):
        self.assets = {"/package/manifest.json": (release/"manifest.json").read_bytes()}
        for entry in manifest["files"]:
            self.assets["/package/"+entry["href"]] = (release/entry["href"]).read_bytes()
        for name in ("component-check.html", "component-check.mjs", "consumer.mjs", "ephemeris.mjs"):
            self.assets["/browser/"+name] = (PROJECT/"browser"/name).read_bytes()
        self.assets["/parity.json"] = parity.read_bytes()
        self.fault_binary = "/package/"+manifest["chunks"][0]["binary"]
        self.token = secrets.token_hex(24)
        self.result = None
        self.completed = threading.Event()
        self.requests = []
        super().__init__(("127.0.0.1", 0), DiagnosticHandler)


class DiagnosticHandler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send_bytes(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)
        self.server.requests.append(dict(method=self.command, path=self.path, status=status, bytes=len(body)))

    def do_GET(self):
        parsed = urlsplit(self.path)
        body = self.server.assets.get(parsed.path)
        status = 200
        fault = parse_qs(parsed.query).get("fault", [""])[0]
        if body is None or (parsed.path == self.server.fault_binary and fault == "missing"):
            self.send_bytes(404, b"Not found", "text/plain")
            return
        if parsed.path == self.server.fault_binary and fault == "corrupt":
            body = bytes([body[0] ^ 1]) + body[1:]
        kind = ("text/javascript" if parsed.path.endswith(".mjs") else
                "text/html" if parsed.path.endswith(".html") else
                "application/json" if parsed.path.endswith(".json") else "application/octet-stream")
        self.send_bytes(status, body, kind)

    def do_POST(self):
        parsed = urlsplit(self.path)
        if parsed.path != "/result" or parse_qs(parsed.query).get("token") != [self.server.token]:
            self.send_bytes(403, b"Forbidden", "text/plain")
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            require(0 < size <= 2_000_000, "result cap")
            require(self.server.result is None, "duplicate browser result")
            result = strict_json(self.rfile.read(size))
            require(isinstance(result, dict) and result.get("status") in ("passed", "failed"), "invalid browser result")
            self.server.result = result
            self.send_bytes(200, b"Recorded", "text/plain")
            self.server.completed.set()
        except (ValueError, OSError) as exc:
            self.send_bytes(400, str(exc).encode(), "text/plain")


def run_browser(name, release, parity, manifest, output):
    executable = BROWSERS[name]
    output.mkdir()
    result = dict(status="failed", executable=str(executable), automation="headless isolated profile")
    server, thread = None, None
    try:
        if not executable.is_file():
            result["status"] = "blocked_environment"
        else:
            server = DiagnosticServer(release, parity, manifest)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            _browser_process(executable, server, manifest, output, result)
    except Exception as exc:
        result.update(status="failed", error=f"{type(exc).__name__}: {exc}")
    finally:
        if server is not None:
            try:
                try:
                    if thread is not None and thread.is_alive():
                        server.shutdown()
                        thread.join(timeout=5)
                        require(not thread.is_alive(), "browser server thread did not stop")
                finally:
                    server.server_close()
            except Exception as exc:
                result.update(status="failed", server_cleanup_error=f"{type(exc).__name__}: {exc}")
            result["server_requests"] = server.requests
        (output/"result.json").write_bytes(json_bytes(result))
    return result


def _browser_process(executable, server, manifest, output, result):
    """Run only the isolated browser; the caller owns server setup/cleanup evidence."""
    process = None
    with tempfile.TemporaryDirectory(prefix="lunar-browser-", ignore_cleanup_errors=True) as profile:
        url = f"http://127.0.0.1:{server.server_port}/browser/component-check.html?token={server.token}"
        argv = [str(executable), "--headless=new", "--disable-gpu", "--no-first-run",
            "--no-default-browser-check", "--disable-background-networking", "--disable-extensions",
            "--disable-component-update", "--disable-sync", "--user-data-dir="+profile, url]
        result["argv"] = argv
        try:
            # Independently record executable version, not just the page user agent.
            version = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
                f"(Get-Item -LiteralPath '{executable}').VersionInfo.ProductVersion"], capture_output=True, text=True, timeout=20)
            result["executable_version"] = version.stdout.strip()
            result["version_command_exit_code"] = version.returncode
            require(version.returncode == 0 and bool(version.stdout.strip()), "browser version unavailable")
            with (output/"browser-process.log").open("wb") as log:
                process = subprocess.Popen(argv, stdout=log, stderr=subprocess.STDOUT)
                deadline = time.monotonic()+120
                while not server.completed.wait(0.2):
                    require(process.poll() is None, "browser exited before result")
                    require(time.monotonic() < deadline, "browser result timeout")
                result["page"] = server.result
                require(server.result["status"] == "passed", "browser page failed")
                require(server.result["secure_context"] and server.result["dataset_id"] == manifest["dataset_id"], "wrong browser context/release")
                require(server.result["comparisons"] == 5856 and server.result["seams"] == 121 and
                        len(server.result["rejection_cases"]) == 18, "incomplete browser evidence")
                result["status"] = "passed"
        except Exception as exc:
            result.update(status="failed", error=f"{type(exc).__name__}: {exc}")
        finally:
            try:
                if process is not None and process.poll() is None:
                    # Only the isolated process tree launched above, never user browsers.
                    stopped = subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                        capture_output=True, text=True, timeout=20)
                    result["cleanup"] = dict(exit_code=stopped.returncode, log=stopped.stdout+stopped.stderr)
                    process.wait(timeout=20)
                if process is not None:
                    result["process_exit_code_after_cleanup"] = process.returncode
            except Exception as exc:
                result.update(status="failed", cleanup_error=f"{type(exc).__name__}: {exc}")