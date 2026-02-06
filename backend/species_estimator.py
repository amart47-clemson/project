"""
Tree species estimation from RGB crown crops.
Uses color and texture features to classify conifer vs deciduous, then assigns
species within each group. Structured so a trained CNN (e.g. TreeSatAI-style) can be plugged in later.
"""
from typing import List, Tuple

# Species keys matching frontend SPECIES_PARAMS (conifer vs deciduous)
CONIFER_SPECIES = ["pine", "spruce", "fir", "cedar"]
DECIDUOUS_SPECIES = ["oak", "maple", "birch", "poplar", "walnut"]


def _crop_safe(img, xmin: float, ymin: float, xmax: float, ymax: float, padding: float = 0.1):
    """Crop image to box with optional padding; clamp to image bounds."""
    import numpy as np
    from PIL import Image

    if isinstance(img, Image.Image):
        arr = np.array(img)
    else:
        arr = img
    h, w = arr.shape[:2]
    x1 = max(0, int(xmin - (xmax - xmin) * padding))
    y1 = max(0, int(ymin - (ymax - ymin) * padding))
    x2 = min(w, int(xmax + (xmax - xmin) * padding))
    y2 = min(h, int(ymax + (ymax - ymin) * padding))
    if x2 <= x1 or y2 <= y1:
        return None
    crop = arr[y1:y2, x1:x2]
    return crop


def _color_texture_features(crop) -> dict:
    """Extract color and texture features from an RGB crop (numpy HxWx3)."""
    import numpy as np

    if crop is None or crop.size == 0 or crop.ndim != 3:
        return None
    r, g, b = crop[:, :, 0].astype(float), crop[:, :, 1].astype(float), crop[:, :, 2].astype(float)
    mean_r, mean_g, mean_b = r.mean(), g.mean(), b.mean()
    std_r, std_g, std_b = r.std(), g.std(), b.std()
    if std_g == 0:
        std_g = 1e-6
    # Green dominance and uniformity (conifers: high green, lower variance)
    green_dom = mean_g / (mean_r + mean_b + 1e-6)
    rg_ratio = (mean_r + 1e-6) / (mean_g + 1e-6)
    texture = (std_r + std_g + std_b) / 3.0
    # Reddish (deciduous / autumn) vs pure green
    red_green = mean_r / (mean_g + 1e-6)
    return {
        "mean_r": mean_r,
        "mean_g": mean_g,
        "mean_b": mean_b,
        "std_g": std_g,
        "green_dom": green_dom,
        "rg_ratio": rg_ratio,
        "texture": texture,
        "red_green": red_green,
    }


def estimate_species_from_crop(crop) -> str:
    """
    Estimate species key from an RGB crown crop (numpy array HxWx3 or PIL Image).
    Uses color/texture heuristics: conifer vs deciduous, then spreads within group.
    Returns one of: pine, spruce, fir, cedar, oak, maple, birch, poplar, walnut, mixed.
    """
    import numpy as np

    if crop is None:
        return "mixed"
    try:
        if hasattr(crop, "mode") and getattr(crop, "mode", None) == "RGB":
            pass
        elif hasattr(crop, "convert"):
            crop = crop.convert("RGB")
        if hasattr(crop, "shape"):
            arr = np.asarray(crop)
        else:
            arr = np.asarray(crop)
        if arr.ndim != 3 or arr.shape[2] < 3:
            return "mixed"
        if arr.size == 0 or arr.shape[0] == 0 or arr.shape[1] == 0:
            return "mixed"
    except Exception:
        return "mixed"

    f = _color_texture_features(arr)
    if f is None:
        return "mixed"

    # Very dark or gray (shadow/bare) -> mixed
    if f["mean_g"] < 40 and f["mean_r"] < 40:
        return "mixed"
    # Brown/gray dominated
    if f["mean_r"] > f["mean_g"] and f["mean_r"] > f["mean_b"] and f["mean_r"] > 100:
        return "mixed"

    # Conifer: green-dominated, lower red/green ratio, often more uniform (conifers hold color)
    # Deciduous: more red/brown or higher texture variation
    green_dominant = f["mean_g"] > f["mean_r"] and f["mean_g"] > f["mean_b"]
    low_red = f["red_green"] < 1.15
    is_conifer = green_dominant and low_red and (f["texture"] < 55 or f["green_dom"] > 1.2)

    if is_conifer:
        # Favor pine when clearly conifer (many stands are pine-dominated); else spread
        t = (f["mean_g"] / 200.0 + f["std_g"] / 40.0) % 1.0
        if t < 0.5:
            return "pine"
        idx = int(t * len(CONIFER_SPECIES)) % len(CONIFER_SPECIES)
        return CONIFER_SPECIES[idx]

    # Deciduous: spread by red/green and texture
    idx = int(
        (f["red_green"] / 1.5 + f["texture"] / 80.0 + (hash(tuple(arr.shape)) % 100) / 100.0)
        * (len(DECIDUOUS_SPECIES) - 0.01)
    ) % len(DECIDUOUS_SPECIES)
    return DECIDUOUS_SPECIES[idx]


def estimate_species_for_detections(img, detections_xyxy: List[Tuple[float, float, float, float]]) -> List[str]:
    """
    img: PIL Image or numpy HxWx3 (RGB).
    detections_xyxy: list of (xmin, ymin, xmax, ymax) in pixel coords.
    Returns list of species keys, one per detection.
    """
    import numpy as np
    from PIL import Image

    if hasattr(img, "size"):
        arr = np.array(img) if isinstance(img, Image.Image) else img
    else:
        arr = img
    if arr.ndim != 3:
        return ["mixed"] * len(detections_xyxy)

    species_list = []
    for (xmin, ymin, xmax, ymax) in detections_xyxy:
        crop = _crop_safe(arr, xmin, ymin, xmax, ymax, padding=0.15)
        sp = estimate_species_from_crop(crop)
        species_list.append(sp)
    return species_list
