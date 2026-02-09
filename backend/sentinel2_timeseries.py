"""
Time-series optical (Sentinel-2 L2A): October & May imagery → NDVI, EVI, SAVI.
Uses Microsoft Planetary Computer STAC. Captures phenology (leaf-on/leaf-off).
"""
from typing import Any, Dict, List, Optional, Tuple

# Reflectance scale for Sentinel-2 L2A (COPERNICUS/S2_SR_HARMONIZED style)
REFL_SCALE = 0.0001


def _compute_indices(red: "np.ndarray", nir: "np.ndarray") -> Tuple[float, float, float]:
    """Compute NDVI, EVI, SAVI from reflectance arrays. Returns (ndvi, evi, savi) as scalars (nanmean)."""
    import numpy as np
    r = np.asarray(red, dtype=float) * REFL_SCALE
    n = np.asarray(nir, dtype=float) * REFL_SCALE
    np.seterr(divide="ignore", invalid="ignore")
    ndvi = (n - r) / (n + r + 1e-12)
    evi = 2.5 * (n - r) / (n + r + 1)
    savi_l = 0.5
    savi = (1 + savi_l) * (n - r) / (n + r + savi_l)
    ndvi_mean = float(np.nanmean(ndvi))
    evi_mean = float(np.nanmean(evi))
    savi_mean = float(np.nanmean(savi))
    return ndvi_mean, evi_mean, savi_mean


def _read_band_for_bbox(href: str, bbox_wgs84: Tuple[float, float, float, float]) -> Optional["np.ndarray"]:
    """Read a single band as numpy array for the given WGS84 bbox (west, south, east, north)."""
    import rasterio
    from rasterio.windows import from_bounds
    from rasterio.warp import transform_bounds
    try:
        with rasterio.open(href) as src:
            west, south, east, north = bbox_wgs84
            if src.crs and str(src.crs).lower() != "epsg:4326":
                west, south, east, north = transform_bounds("EPSG:4326", src.crs, west, south, east, north)
            window = from_bounds(west, south, east, north, src.transform)
            if window.width < 1 or window.height < 1:
                return None
            data = src.read(1, window=window)
            return data
    except Exception:
        return None


def _fetch_month_indices(
    catalog,
    bbox: Tuple[float, float, float, float],
    year: int,
    month: int,
) -> Optional[Dict[str, float]]:
    """Search one month, get first item, compute NDVI/EVI/SAVI for bbox. Returns dict or None."""
    import datetime
    start = datetime.date(year, month, 1)
    if month == 12:
        end = datetime.date(year, 12, 31)
    else:
        end = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)
    try:
        search = catalog.search(
            collections=["sentinel-2-l2a"],
            bbox=bbox,
            datetime=f"{start}T00:00:00Z/{end}T23:59:59Z",
            max_items=1,
        )
        items = list(search.items())
    except Exception:
        return None
    if not items:
        return None
    item = items[0]
    assets = item.assets
    if "B04" not in assets or "B08" not in assets:
        return None
    href_red = assets["B04"].href
    href_nir = assets["B08"].href
    red = _read_band_for_bbox(href_red, bbox)
    nir = _read_band_for_bbox(href_nir, bbox)
    if red is None or nir is None:
        return None
    if red.size == 0 or nir.size == 0:
        return None
    if red.shape != nir.shape:
        import numpy as np
        from PIL import Image
        nir = np.array(
            Image.fromarray(nir.astype(float)).resize(
                (red.shape[1], red.shape[0]),
                resample=Image.BILINEAR,
            )
        )
    ndvi, evi, savi = _compute_indices(red, nir)
    return {"ndvi": round(ndvi, 4), "evi": round(evi, 4), "savi": round(savi, 4)}


def fetch_sentinel2_timeseries(
    west: float,
    south: float,
    east: float,
    north: float,
    october_year: int = 2023,
    may_year: int = 2024,
) -> Dict[str, Any]:
    """
    Fetch Sentinel-2 L2A for October and May, compute NDVI, EVI, SAVI per month.
    Returns dict with october: {ndvi, evi, savi}, may: {ndvi, evi, savi}, source, and optional error.
    """
    bbox = (west, south, east, north)
    out = {
        "october": None,
        "may": None,
        "source": "Sentinel-2 L2A (Planetary Computer); phenology leaf-on/leaf-off",
        "error": None,
    }
    try:
        import pystac_client
        import planetary_computer
    except ImportError as e:
        out["error"] = f"Missing dependency: {e}. Install pystac-client and planetary-computer."
        return out

    try:
        catalog = pystac_client.Client.open(
            "https://planetarycomputer.microsoft.com/api/stac/v1",
            modifier=planetary_computer.sign_inplace,
        )
    except Exception as e:
        out["error"] = f"Failed to open STAC catalog: {e}"
        return out

    october_data = _fetch_month_indices(catalog, bbox, october_year, 10)
    may_data = _fetch_month_indices(catalog, bbox, may_year, 5)
    out["october"] = october_data
    out["may"] = may_data
    if october_data is None and may_data is None:
        out["error"] = "No Sentinel-2 L2A scenes found for this area in October or May."
    return out
