"""Command-line interface; defaults never fetch remote sources."""

import argparse
import os
from pathlib import Path

from .core import ValidationError, disjoint_roots, json_bytes, strict_json
from .fixture import PROJECT
from .release import build_fixture, package_release, validate_release
from .sources import acquire


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("build-fixture")
    build.add_argument("--build-root", type=Path, default=PROJECT / "work")
    validate = commands.add_parser("validate")
    validate.add_argument("release", type=Path)
    package = commands.add_parser("package")
    package.add_argument("release", type=Path)
    package.add_argument("--publish-root", type=Path, default=PROJECT / "generated")
    default_raw = Path(os.environ.get("LUNAR_RAW_ROOT", str(Path.home() / "lunar-navigator-raw")))
    package.add_argument("--raw-root", type=Path, default=default_raw)
    download = commands.add_parser("acquire", help="opt-in HTTPS acquisition from a reviewed source specification")
    download.add_argument("spec", type=Path)
    download.add_argument("--raw-root", type=Path, default=default_raw)
    args = parser.parse_args()
    try:
        if args.command == "build-fixture":
            print(build_fixture(args.build_root))
        elif args.command == "validate":
            print(json_bytes(validate_release(args.release)).decode(), end="")
        elif args.command == "package":
            print(package_release(args.release, args.publish_root, args.raw_root))
        else:
            disjoint_roots(args.raw_root, PROJECT)
            print(acquire(strict_json(args.spec.read_bytes()), args.raw_root))
    except (ValidationError, ValueError, OSError, KeyError, TypeError) as exc:
        parser.exit(1, f"Pipeline rejected input: {exc}\n")


if __name__ == "__main__":
    main()