"""Curated lunar landing sites catalog and strict P02 validation."""

from .core import (ValidationError, coordinates, identifier, json_bytes, number,
                   require, strict_json)


SITE_TYPES = ("candidate", "achieved_landing", "study_point", "fictional")
SUPPORTED_FRAME = "MOON_ME_DE421"
SITE_FIELDS = (
    "id", "name", "site_type", "lat_deg", "lon_deg", "frame",
    "coordinate_source_id", "coordinate_uncertainty_m", "reference_meridian_deg",
    "terrain_height_m", "region_ids", "default_mast_height_m", "quality_flags", "limitations"
)

CURATED_SITES = (
    dict(
        id="shackleton-connecting-ridge",
        name="Shackleton Connecting Ridge (Site 001)",
        site_type="candidate",
        lat_deg=-89.44,
        lon_deg=-137.4,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="lola-lroc-polar-v1",
        coordinate_uncertainty_m=20.0,
        reference_meridian_deg=None,
        terrain_height_m=-120.0,
        region_ids=["shackleton", "connecting-ridge"],
        default_mast_height_m=2.0,
        quality_flags=["polar_candidate", "high_illumination"],
        limitations=["Elevation estimated from 20m LOLA DEM; mast height configurable at scenario level."]
    ),
    dict(
        id="shackleton-rim",
        name="Shackleton Crater Rim Ridge",
        site_type="candidate",
        lat_deg=-89.66,
        lon_deg=129.2,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="lola-lroc-polar-v1",
        coordinate_uncertainty_m=20.0,
        reference_meridian_deg=None,
        terrain_height_m=1150.0,
        region_ids=["shackleton"],
        default_mast_height_m=2.0,
        quality_flags=["polar_candidate", "ridge_crest"],
        limitations=["High solar illumination point with steep local slopes into crater interior."]
    ),
    dict(
        id="peak-of-eternal-light-1",
        name="Peak of Eternal Light 1 (Shackleton Rim)",
        site_type="study_point",
        lat_deg=-89.74,
        lon_deg=123.5,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="lola-lroc-polar-v1",
        coordinate_uncertainty_m=15.0,
        reference_meridian_deg=None,
        terrain_height_m=1320.0,
        region_ids=["shackleton"],
        default_mast_height_m=2.0,
        quality_flags=["study_benchmark", "quasi_permanent_light"],
        limitations=["Historical quasi-permanent illumination study point from Mazarico et al."]
    ),
    dict(
        id="malapert-massif",
        name="Malapert Massif Peak (Site 004)",
        site_type="candidate",
        lat_deg=-85.99,
        lon_deg=2.93,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="lola-lroc-polar-v1",
        coordinate_uncertainty_m=25.0,
        reference_meridian_deg=None,
        terrain_height_m=4980.0,
        region_ids=["malapert"],
        default_mast_height_m=2.0,
        quality_flags=["polar_candidate", "high_elevation", "direct_earth_view"],
        limitations=["High elevation plateau with continuous Earth direct-line-of-sight communication."]
    ),
    dict(
        id="haworth-rim",
        name="Haworth Crater Rim Ridge",
        site_type="candidate",
        lat_deg=-87.45,
        lon_deg=-5.17,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="lola-lroc-polar-v1",
        coordinate_uncertainty_m=30.0,
        reference_meridian_deg=None,
        terrain_height_m=-450.0,
        region_ids=["haworth"],
        default_mast_height_m=2.0,
        quality_flags=["polar_candidate", "psr_adjacent"],
        limitations=["Adjacent to deep permanently shadowed cold trap in Haworth Crater."]
    ),
    dict(
        id="nobile-rim-1",
        name="Nobile Crater Rim (Mons Mouton)",
        site_type="candidate",
        lat_deg=-85.2,
        lon_deg=37.8,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="lola-lroc-polar-v1",
        coordinate_uncertainty_m=30.0,
        reference_meridian_deg=None,
        terrain_height_m=3800.0,
        region_ids=["nobile"],
        default_mast_height_m=2.0,
        quality_flags=["polar_candidate", "viper_study_area"],
        limitations=["Plateau on Mons Mouton adjacent to Nobile crater; broad illumination windows."]
    ),
    dict(
        id="amundsen-rim",
        name="Amundsen Crater Rim",
        site_type="candidate",
        lat_deg=-84.5,
        lon_deg=82.8,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="lola-lroc-polar-v1",
        coordinate_uncertainty_m=35.0,
        reference_meridian_deg=None,
        terrain_height_m=2100.0,
        region_ids=["amundsen"],
        default_mast_height_m=2.0,
        quality_flags=["polar_candidate"],
        limitations=["Elevated crater rim site with periodic long solar visibility."]
    ),
    dict(
        id="de-gerlache-rim-1",
        name="de Gerlache Crater Rim Ridge",
        site_type="candidate",
        lat_deg=-88.5,
        lon_deg=-88.3,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="lola-lroc-polar-v1",
        coordinate_uncertainty_m=25.0,
        reference_meridian_deg=None,
        terrain_height_m=1850.0,
        region_ids=["de-gerlache"],
        default_mast_height_m=2.0,
        quality_flags=["polar_candidate"],
        limitations=["Narrow ridge crest between de Gerlache crater and Shackleton connecting terrain."]
    ),
    dict(
        id="im-1-odysseus",
        name="Intuitive Machines IM-1 (Odysseus / Malapert A)",
        site_type="achieved_landing",
        lat_deg=-80.13,
        lon_deg=1.44,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="clps-im1-flight-records",
        coordinate_uncertainty_m=50.0,
        reference_meridian_deg=None,
        terrain_height_m=-2800.0,
        region_ids=["malapert"],
        default_mast_height_m=1.5,
        quality_flags=["achieved_landing", "clps_mission"],
        limitations=["First commercial CLPS soft landing near Malapert A; landed tilted on slope."]
    ),
    dict(
        id="im-2-prime-1",
        name="Intuitive Machines IM-2 (PRIME-1 target)",
        site_type="candidate",
        lat_deg=-89.28,
        lon_deg=-138.6,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="clps-im2-mission-plan",
        coordinate_uncertainty_m=40.0,
        reference_meridian_deg=None,
        terrain_height_m=-200.0,
        region_ids=["connecting-ridge"],
        default_mast_height_m=2.0,
        quality_flags=["polar_candidate", "clps_mission"],
        limitations=["Planned polar drill mission on the Connecting Ridge."]
    ),
    dict(
        id="chandrayaan-3",
        name="Chandrayaan-3 (Shiv Shakti Point)",
        site_type="achieved_landing",
        lat_deg=-69.373,
        lon_deg=32.319,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="isro-ch3-landing-report",
        coordinate_uncertainty_m=10.0,
        reference_meridian_deg=None,
        terrain_height_m=-420.0,
        region_ids=["south-subpolar"],
        default_mast_height_m=1.5,
        quality_flags=["achieved_landing", "high_latitude_benchmark"],
        limitations=["Historic high-latitude southern landing site between Manzinus C and Simpelius N."]
    ),
    dict(
        id="slim-shioli",
        name="SLIM (Shioli Crater Rim)",
        site_type="achieved_landing",
        lat_deg=-13.316,
        lon_deg=25.251,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="jaxa-slim-pinpoint-report",
        coordinate_uncertainty_m=5.0,
        reference_meridian_deg=None,
        terrain_height_m=-850.0,
        region_ids=["equatorial"],
        default_mast_height_m=1.0,
        quality_flags=["achieved_landing", "pinpoint_landing"],
        limitations=["Precision pinpoint landing demonstration within 55m of Shioli target."]
    ),
    dict(
        id="apollo-11",
        name="Apollo 11 (Statio Tranquillitatis)",
        site_type="achieved_landing",
        lat_deg=0.6741,
        lon_deg=23.473,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="lroc-apollo-coordinates-v1",
        coordinate_uncertainty_m=1.0,
        reference_meridian_deg=None,
        terrain_height_m=-1400.0,
        region_ids=["equatorial"],
        default_mast_height_m=2.0,
        quality_flags=["achieved_landing", "equatorial_benchmark"],
        limitations=["Equatorial mare baseline site with simple ~14-day day/night diurnal cycle."]
    ),
    dict(
        id="apollo-17",
        name="Apollo 17 (Taurus-Littrow)",
        site_type="achieved_landing",
        lat_deg=20.1908,
        lon_deg=30.7717,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="lroc-apollo-coordinates-v1",
        coordinate_uncertainty_m=1.0,
        reference_meridian_deg=None,
        terrain_height_m=-2500.0,
        region_ids=["equatorial"],
        default_mast_height_m=2.0,
        quality_flags=["achieved_landing", "valley_benchmark"],
        limitations=["Deep valley landing site between North and South Massifs; mountain horizons."]
    ),
    dict(
        id="change-4",
        name="Chang'e-4 (Von Kármán Crater / Far Side)",
        site_type="achieved_landing",
        lat_deg=-45.457,
        lon_deg=177.589,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="lroc-change4-landing-report",
        coordinate_uncertainty_m=10.0,
        reference_meridian_deg=None,
        terrain_height_m=-5900.0,
        region_ids=["far-side"],
        default_mast_height_m=2.0,
        quality_flags=["achieved_landing", "far_side_benchmark", "no_direct_earth"],
        limitations=["First lunar far side soft landing; permanently zero direct Earth line-of-sight (requires Queqiao relay)."]
    ),
    dict(
        id="blue-ghost-1",
        name="Astrobotic Blue Ghost 1 (Mare Crisium)",
        site_type="candidate",
        lat_deg=18.56,
        lon_deg=61.81,
        frame=SUPPORTED_FRAME,
        coordinate_source_id="clps-blueghost1-plan",
        coordinate_uncertainty_m=50.0,
        reference_meridian_deg=None,
        terrain_height_m=-3600.0,
        region_ids=["equatorial"],
        default_mast_height_m=2.0,
        quality_flags=["candidate", "clps_mission"],
        limitations=["Planned CLPS landing in Mare Crisium basin."]
    )
)


def validate_site(site):
    """Strict schema validation for a single site dictionary."""
    require(isinstance(site, dict), "site must be a dictionary")
    require(set(site) == set(SITE_FIELDS), f"site missing or unknown fields: {set(site) ^ set(SITE_FIELDS)}")
    identifier(site["id"])
    require(isinstance(site["name"], str) and site["name"].strip(), "site name required")
    require(site["site_type"] in SITE_TYPES, f"invalid site_type: {site['site_type']}")
    coordinates(site["lat_deg"], site["lon_deg"], site["reference_meridian_deg"])
    require(site["frame"] == SUPPORTED_FRAME, f"unsupported frame: {site['frame']}")
    if site["coordinate_source_id"] is not None:
        identifier(site["coordinate_source_id"])
    if site["coordinate_uncertainty_m"] is not None:
        number(site["coordinate_uncertainty_m"], "coordinate_uncertainty_m")
        require(site["coordinate_uncertainty_m"] >= 0, "uncertainty must be nonnegative")
    if site["terrain_height_m"] is not None:
        number(site["terrain_height_m"], "terrain_height_m")
    require(isinstance(site["region_ids"], list), "region_ids must be a list")
    for reg in site["region_ids"]:
        identifier(reg)
    number(site["default_mast_height_m"], "default_mast_height_m")
    require(site["default_mast_height_m"] > 0, "mast height must be positive")
    require(isinstance(site["quality_flags"], list), "quality_flags must be a list")
    require(all(isinstance(f, str) and f.strip() for f in site["quality_flags"]), "invalid quality flag")
    require(isinstance(site["limitations"], list), "limitations must be a list")
    require(all(isinstance(lim, str) and lim.strip() for lim in site["limitations"]), "invalid limitation text")


def validate_site_catalog(catalog):
    """Validate full P02 site catalog dictionary."""
    require(isinstance(catalog, dict), "catalog must be a dictionary")
    envelope_fields = (
        "schema_version", "dataset_id", "model_version", "data_kind",
        "file_kind", "source_ids", "validation_check_ids", "limitations", "sites"
    )
    require(set(catalog) == set(envelope_fields), "invalid catalog envelope fields")
    require(catalog["schema_version"] == "3.0", "unsupported schema version")
    identifier(catalog["dataset_id"])
    identifier(catalog["model_version"])
    require(catalog["data_kind"] in ("computed", "synthetic"), "invalid data kind")
    require(catalog["file_kind"] == "sites", "file_kind must be 'sites'")
    require(isinstance(catalog["source_ids"], list), "source_ids must be list")
    require(isinstance(catalog["validation_check_ids"], list), "validation_check_ids must be list")
    require(isinstance(catalog["limitations"], list), "limitations must be list")
    require(isinstance(catalog["sites"], list) and len(catalog["sites"]) > 0, "non-empty sites list required")
    ids = set()
    for site in catalog["sites"]:
        validate_site(site)
        require(site["id"] not in ids, f"duplicate site ID: {site['id']}")
        ids.add(site["id"])


def build_sites_payload(dataset_id="lunar-horizon-computed-v1", model_version="lunar-model-v1", sites=None):
    """Construct a canonical validated P02 site catalog payload."""
    if sites is None:
        sites = list(CURATED_SITES)
    payload = dict(
        schema_version="3.0",
        dataset_id=dataset_id,
        model_version=model_version,
        data_kind="computed",
        file_kind="sites",
        source_ids=["lola-pds-dem-v1", "lroc-polar-dem-v1", "nasa-artemis-candidate-regions-2024"],
        validation_check_ids=["V02-site-catalog-integrity"],
        limitations=[
            "South Pole coordinates are derived from LRO LOLA/LROC polar digital elevation models.",
            "Terrain heights are relative to reference sphere radius 1,737,400 m.",
            "Far-side and equatorial sites are benchmark comparison points without polar terrain masks."
        ],
        sites=sites
    )
    validate_site_catalog(payload)
    return payload
