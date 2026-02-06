"""Fetch map tiles for a bbox and stitch into a single RGB image (for DeepForest)."""
import io
import math
from typing import Tuple

import mercantile
import requests
from PIL import Image

# ESRI World Imagery (satellite) - same as frontend. Format: z/y/x for Leaflet/ESRI.
TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
TILE_SIZE = 256


def _lat_lng_to_pixel(lat: float, lng: float, zoom: int) -> Tuple[float, float]:
    """Convert WGS84 lat/lng to global pixel at zoom (origin top-left)."""
    n = 2.0 ** zoom
    x = (lng + 180.0) / 360.0 * n * TILE_SIZE
    lat_rad = math.radians(lat)
    y = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n * TILE_SIZE
    return x, y


def _pixel_to_lat_lng(px: float, py: float, zoom: int) -> Tuple[float, float]:
    """Convert global pixel at zoom to WGS84 lat/lng."""
    n = 2.0 ** zoom
    lng = (px / (n * TILE_SIZE)) * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1.0 - 2.0 * (py / (n * TILE_SIZE)))))
    lat = math.degrees(lat_rad)
    return lat, lng


def get_zoom_for_bbox(west: float, south: float, east: float, north: float, max_pixels: int = 2048) -> int:
    """Choose zoom so that the bbox fits in roughly max_pixels on the longer side."""
    # Approximate: at equator, 360 deg = 256 * 2^z pixels
    width_deg = east - west
    height_deg = north - south
    if width_deg <= 0 or height_deg <= 0:
        return 14
    # At zoom z, 1 deg ≈ 256 * 2^z / 360 pixels at equator; adjust for lat
    mid_lat = (north + south) / 2
    scale_lng = max(0.1, math.cos(math.radians(mid_lat)))
    px_per_deg_lng = 256 * (2 ** 14) / (360 * scale_lng)
    px_per_deg_lat = 256 * (2 ** 14) / 360
    w_px = width_deg * px_per_deg_lng
    h_px = height_deg * px_per_deg_lat
    max_side = max(w_px, h_px)
    if max_side <= 0:
        return 14
    # Scale zoom so stitched image fits ~max_pixels on longest side
    z = 14 + max(0, min(6, int(math.log2(max_pixels / max_side))))
    return z


def fetch_tile(z: int, x: int, y: int) -> Image.Image:
    """Download a single tile as PIL Image."""
    url = TILE_URL.format(z=z, y=y, x=x)
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    return Image.open(io.BytesIO(r.content)).convert("RGB")


def stitch_bbox(west: float, south: float, east: float, north: float, zoom: int) -> Tuple[Image.Image, Tuple[float, float, float, float]]:
    """
    Fetch all tiles covering the bbox at zoom, stitch into one image.
    Returns (PIL Image, (west, south, east, north) in degrees of the stitched image bounds).
    """
    tiles = list(mercantile.tiles(west, south, east, north, zooms=zoom))
    if not tiles:
        raise ValueError("No tiles for bbox")
    xs = [t.x for t in tiles]
    ys = [t.y for t in tiles]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    nw = (max_x - min_x + 1) * TILE_SIZE
    nh = (max_y - min_y + 1) * TILE_SIZE
    out = Image.new("RGB", (nw, nh))
    for t in tiles:
        img = fetch_tile(zoom, t.x, t.y)
        px = (t.x - min_x) * TILE_SIZE
        py = (t.y - min_y) * TILE_SIZE
        out.paste(img, (px, py))
    # Bounds of stitched image (tile bounds in deg)
    left, bottom, right, top = mercantile.bounds(mercantile.Tile(min_x, min_y, zoom))
    # mercantile.bounds returns (west, south, east, north)
    return out, (left, bottom, right, top)


def pixel_to_lnglat_in_stitched(
    px: float, py: float,
    img_width: int, img_height: int,
    west: float, south: float, east: float, north: float
) -> Tuple[float, float]:
    """Convert pixel (px, py) in stitched image to (lng, lat). North-up, y down."""
    lng = west + (px / img_width) * (east - west)
    lat = north - (py / img_height) * (north - south)
    return lng, lat
