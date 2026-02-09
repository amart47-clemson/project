"""
Tree species estimation from RGB crown crops.
Uses color and texture features to classify conifer vs deciduous, then assigns
species within each group. Uses area-level phenology (Oct/May NDVI) when available
to bias conifer vs deciduous; supports optional dominant_species from user.
"""
import random
from typing import List, Optional, Tuple

# Species keys matching frontend SPECIES_PARAMS (conifer vs deciduous)
CONIFER_SPECIES = ["pine", "spruce", "fir", "cedar"]
DECIDUOUS_SPECIES = ["oak", "maple", "birch", "poplar", "walnut"]
# When conifer-dominated, bias toward pine (e.g. pine-heavy stands)
PINE_WEIGHT_IN_CONIFER = 0.72  # ~72% pine among conifers when no other hint


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
        # Strong pine bias when conifer (many stands are pine-dominated)
        r = random.random()
        if r < PINE_WEIGHT_IN_CONIFER:
            return "pine"
        idx = int(r * len(CONIFER_SPECIES)) % len(CONIFER_SPECIES)
        return CONIFER_SPECIES[idx]

    # Deciduous: spread by red/green and texture
    idx = int(
        (f["red_green"] / 1.5 + f["texture"] / 80.0 + (hash(tuple(arr.shape)) % 100) / 100.0)
        * (len(DECIDUOUS_SPECIES) - 0.01)
    ) % len(DECIDUOUS_SPECIES)
    return DECIDUOUS_SPECIES[idx]


def _conifer_tendency_from_phenology(october_ndvi: Optional[float], may_ndvi: Optional[float]) -> Optional[float]:
    """
    From Oct/May NDVI, compute conifer tendency in [0, 1].
    Large May−Oct = deciduous (leaf-on in May, off in Oct) → low conifer tendency.
    Small difference = evergreen/conifer → high conifer tendency.
    """
    if october_ndvi is None and may_ndvi is None:
        return None
    oct = october_ndvi if october_ndvi is not None else may_ndvi
    may = may_ndvi if may_ndvi is not None else october_ndvi
    if oct is None or may is None:
        return None
    diff = may - oct  # positive = deciduous-dominated
    # Map diff to [0,1]: diff >= 0.2 → conifer_tendency 0; diff <= 0 → conifer_tendency 1
    tendency = 1.0 - min(1.0, max(0.0, (diff + 0.05) / 0.25))
    return tendency


def _apply_dominant_species(species_list: List[str], dominant: str) -> List[str]:
    """Bias species list toward dominant (e.g. 80% dominant, 20% from original)."""
    valid = set(CONIFER_SPECIES + DECIDUOUS_SPECIES + ["mixed"])
    if dominant not in valid:
        return species_list
    out = []
    for s in species_list:
        if random.random() < 0.8:
            out.append(dominant)
        else:
            out.append(s)
    return out


def estimate_species_for_detections(
    img,
    detections_xyxy: List[Tuple[float, float, float, float]],
    phenology_hint: Optional[dict] = None,
    dominant_species: Optional[str] = None,
) -> List[str]:
    """
    img: PIL Image or numpy HxWx3 (RGB).
    detections_xyxy: list of (xmin, ymin, xmax, ymax) in pixel coords.
    phenology_hint: optional { "october_ndvi": float, "may_ndvi": float } from Sentinel-2.
    dominant_species: optional user hint, e.g. "pine", "oak".
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

    # Phenology nudge: conifer vs deciduous from Oct/May NDVI
    if phenology_hint:
        oct_ndvi = phenology_hint.get("october_ndvi") if isinstance(phenology_hint, dict) else None
        may_ndvi = phenology_hint.get("may_ndvi") if isinstance(phenology_hint, dict) else None
        conifer_tendency = _conifer_tendency_from_phenology(oct_ndvi, may_ndvi)
        if conifer_tendency is not None:
            for i in range(len(species_list)):
                s = species_list[i]
                in_conifer_group = s in CONIFER_SPECIES
                in_deciduous_group = s in DECIDUOUS_SPECIES
                r = random.random()
                if conifer_tendency >= 0.6 and in_deciduous_group and r < 0.65:
                    species_list[i] = "pine" if random.random() < PINE_WEIGHT_IN_CONIFER else random.choice(CONIFER_SPECIES)
                elif conifer_tendency <= 0.4 and in_conifer_group and r < 0.65:
                    species_list[i] = random.choice(DECIDUOUS_SPECIES)

    # User-set dominant species overrides a large share of assignments
    if dominant_species:
        species_list = _apply_dominant_species(species_list, dominant_species.lower().strip())

    return species_list
