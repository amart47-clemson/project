"""
NASA GEDI L4A (footprint-level) and L4B (gridded) integration.
GEDI is a lidar on the ISS that measures forest structure and biomass.
L4A: ~25 m footprint AGBD (Mg/ha). L4B: 1 km gridded mean AGBD.
Coverage: 51.6°N to 51.6°S. Requires NASA Earthdata login for data access.
"""
from typing import Any, Dict, List, Optional, Tuple

GEDI_MAX_LAT = 51.6  # GEDI coverage limit (degrees)


def _in_gedi_coverage(south: float, north: float) -> bool:
    return south >= -GEDI_MAX_LAT and north <= GEDI_MAX_LAT


def _try_earthaccess_login() -> bool:
    """Try to authenticate with NASA Earthdata.

    Order:
    - First, try environment variables (EARTHDATA_USERNAME/EARTHDATA_PASSWORD) – best for deployed servers.
    - Then, fall back to .netrc (good for local development).
    Returns True if authenticated, False otherwise.
    """
    try:
        import earthaccess  # type: ignore
        import os
    except Exception:
        return False

    # 1) Env vars (preferred for deployed environments like Railway/Render)
    u, p = os.environ.get("EARTHDATA_USERNAME"), os.environ.get("EARTHDATA_PASSWORD")
    if u and p:
        try:
            auth = earthaccess.login(strategy="environment")
            if getattr(auth, "authenticated", False):
                return True
        except Exception:
            # Fall through to netrc
            pass

    # 2) .netrc (preferred for local development)
    try:
        auth = earthaccess.login(strategy="netrc")
        return getattr(auth, "authenticated", False)
    except Exception:
        return False


def fetch_gedi_l4a_for_bbox(
    west: float, south: float, east: float, north: float,
    max_granules: int = 8,
    temporal: Tuple[str, str] = ("2020-01-01", "2023-12-31"),
) -> Dict[str, Any]:
    """
    Fetch GEDI L4A footprint-level AGBD for a bounding box.
    Returns dict with mean_agbd_Mg_per_ha, footprint_count, mean_rh98_m, source, error (if any).
    """
    if not _in_gedi_coverage(south, north):
        return {
            "mean_agbd_Mg_per_ha": None,
            "footprint_count": 0,
            "mean_rh98_m": None,
            "source": "GEDI L4A (ISS lidar)",
            "error": "Area outside GEDI coverage (51.6°N to 51.6°S).",
        }

    if not _try_earthaccess_login():
        return {
            "mean_agbd_Mg_per_ha": None,
            "footprint_count": 0,
            "mean_rh98_m": None,
            "source": "GEDI L4A (ISS lidar)",
            "error": "NASA Earthdata login required. Set .netrc or EARTHDATA_USERNAME/EARTHDATA_PASSWORD.",
        }

    try:
        import earthaccess
        import numpy as np

        # GEDI L4A: try V2.1 short name first, then generic GEDI_L4A
        for short_name in ("GEDI_L4A_AGB_Density_V2_1", "GEDI_L4A"):
            results = earthaccess.search_data(
                short_name=short_name,
                bounding_box=(west, south, east, north),
                temporal=temporal,
                count=max_granules,
            )
            if results:
                break
        if not results:
            return {
                "mean_agbd_Mg_per_ha": None,
                "footprint_count": 0,
                "mean_rh98_m": None,
                "source": "GEDI L4A (ISS lidar)",
                "error": "No GEDI L4A granules found for this area and time range.",
            }

        agbd_list: List[float] = []
        rh98_list: List[float] = []
        beams = ["BEAM0000", "BEAM0001", "BEAM0010", "BEAM0011", "BEAM0101", "BEAM0110", "BEAM1000", "BEAM1011"]

        import tempfile
        import h5py
        with tempfile.TemporaryDirectory() as tmpdir:
            filelist = earthaccess.download(results, local_path=tmpdir)
            for path in filelist:
                path_str = str(path)
                if not path_str.endswith(".h5") and not path_str.endswith(".hdf5"):
                    continue
                try:
                    with h5py.File(path_str, "r") as hf:
                        for beam in beams:
                            if beam not in hf:
                                continue
                            g = hf[beam]
                            lat = np.array(g["lat_lowestmode"])
                            lon = np.array(g["lon_lowestmode"])
                            if "agbd" not in g:
                                continue
                            agbd = np.array(g["agbd"])
                            quality = np.array(g["l4_quality_flag"]) if "l4_quality_flag" in g else np.ones_like(lat, dtype=int)
                            rh98 = np.array(g["rh98"]) if "rh98" in g else None
                            mask = (
                                (lat >= south) & (lat <= north) &
                                (lon >= west) & (lon <= east) &
                                (quality == 1) &
                                (agbd >= 0) & (agbd < 1e6)
                            )
                            agbd_list.extend(agbd[mask].tolist())
                            if rh98 is not None:
                                rh98_list.extend(rh98[mask].tolist())
                except Exception:
                    continue

        if not agbd_list:
            return {
                "mean_agbd_Mg_per_ha": None,
                "footprint_count": 0,
                "mean_rh98_m": None,
                "source": "GEDI L4A (ISS lidar)",
                "error": "No valid GEDI footprints in this area.",
            }

        mean_agbd = float(np.mean(agbd_list))
        mean_rh98 = float(np.mean(rh98_list)) if rh98_list else None
        return {
            "mean_agbd_Mg_per_ha": round(mean_agbd, 3),
            "footprint_count": len(agbd_list),
            "mean_rh98_m": round(mean_rh98, 2) if mean_rh98 is not None else None,
            "source": "GEDI L4A (ISS lidar)",
            "error": None,
        }
    except ImportError as e:
        return {
            "mean_agbd_Mg_per_ha": None,
            "footprint_count": 0,
            "mean_rh98_m": None,
            "source": "GEDI L4A (ISS lidar)",
            "error": f"Missing dependency: {e}. Install earthaccess and h5py.",
        }
    except Exception as e:
        return {
            "mean_agbd_Mg_per_ha": None,
            "footprint_count": 0,
            "mean_rh98_m": None,
            "source": "GEDI L4A (ISS lidar)",
            "error": str(e)[:200],
        }
