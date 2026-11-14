"""Executable runner to build and publish the unified Lunar Horizon dataset release."""

import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from lunar_pipeline.publisher import publish_dataset


def main():
    preview_dir = PROJECT_ROOT / "generated" / "ephemeris-preview-d68aa79075433edddec0e443"
    output_dir = PROJECT_ROOT / "generated" / "lunar-horizon-release-v1"
    print(f"Building unified dataset release at: {output_dir}")
    manifest = publish_dataset(output_dir, preview_dir)
    print(f"Successfully published {len(manifest['files'])} indexed resources!")
    print(f"Dataset ID: {manifest['dataset_id']}")
    print(f"Default scenario: {manifest['default_scenario_id']}")


if __name__ == "__main__":
    main()
