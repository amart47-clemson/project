"""
Tree crown detection API using DeepForest (RetinaNet-based).
POST /api/detect-trees with bbox → fetch satellite tiles, run DeepForest, return detections with lat/lng.
"""
import os
import tempfile
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from tile_utils import stitch_bbox, pixel_to_lnglat_in_stitched, get_zoom_for_bbox
from species_estimator import estimate_species_for_detections

app = FastAPI(title="Tree Crown Detection (DeepForest)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BboxRequest(BaseModel):
    """Bounding box in [west, south, east, north] (WGS84)."""
    bbox: List[float]  # [west, south, east, north]
    zoom: Optional[int] = None  # optional; auto if not set


class TreeDetection(BaseModel):
    lat: float
    lng: float
    score: float
    xmin: float
    ymin: float
    xmax: float
    ymax: float
    species: Optional[str] = None  # e.g. pine, oak; from image-based species estimation


class DetectResponse(BaseModel):
    count: int
    trees: List[TreeDetection]
    image_bounds: List[float]  # [west, south, east, north]
    message: str = "DeepForest (RetinaNet) tree crown detection"


def run_deepforest(image_path: str, score_thresh: float = 0.05):
    """Run DeepForest on an image; returns DataFrame with xmin, ymin, xmax, ymax, score.
    score_thresh: lower = more detections (default 0.05; DeepForest default is 0.1).
    """
    import pandas as pd
    from deepforest import main
    model = main.deepforest(config_args={"retinanet": {"score_thresh": score_thresh}})
    model.use_release()
    df = model.predict_image(path=image_path, return_plot=False)
    if df is None or (isinstance(df, pd.DataFrame) and df.empty):
        return pd.DataFrame()
    if "scores" in df.columns and "score" not in df.columns:
        df = df.rename(columns={"scores": "score"})
    return df


@app.post("/api/detect-trees", response_model=DetectResponse)
def detect_trees(req: BboxRequest):
    if len(req.bbox) != 4:
        raise HTTPException(status_code=400, detail="bbox must be [west, south, east, north]")
    west, south, east, north = req.bbox
    if west >= east or south >= north:
        raise HTTPException(status_code=400, detail="Invalid bbox: west < east, south < north")

    zoom = req.zoom
    if zoom is None:
        # Higher resolution (2400 px) so tree crowns are larger and more get detected
        zoom = get_zoom_for_bbox(west, south, east, north, max_pixels=2400)

    try:
        img, (img_west, img_south, img_east, img_north) = stitch_bbox(west, south, east, north, zoom)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch imagery: {e}")

    w, h = img.size
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        img.save(f.name)
        try:
            df = run_deepforest(f.name)
        finally:
            os.unlink(f.name)

    if df.empty:
        return DetectResponse(
            count=0,
            trees=[],
            image_bounds=[img_west, img_south, img_east, img_north],
        )

    # Build list of (xmin, ymin, xmax, ymax) for species estimation from crown crops
    boxes_xyxy = [
        (float(row["xmin"]), float(row["ymin"]), float(row["xmax"]), float(row["ymax"]))
        for _, row in df.iterrows()
    ]
    species_list = estimate_species_for_detections(img, boxes_xyxy)

    trees = []
    for i, (_, row) in enumerate(df.iterrows()):
        xmin, ymin = float(row["xmin"]), float(row["ymin"])
        xmax, ymax = float(row["xmax"]), float(row["ymax"])
        score = float(row.get("score", row.get("scores", 0)))
        cx = (xmin + xmax) / 2
        cy = (ymin + ymax) / 2
        lng, lat = pixel_to_lnglat_in_stitched(
            cx, cy, w, h, img_west, img_south, img_east, img_north
        )
        species = species_list[i] if i < len(species_list) else "mixed"
        trees.append(
            TreeDetection(
                lat=lat, lng=lng, score=round(score, 3),
                xmin=xmin, ymin=ymin, xmax=xmax, ymax=ymax,
                species=species,
            )
        )

    return DetectResponse(
        count=len(trees),
        trees=trees,
        image_bounds=[img_west, img_south, img_east, img_north],
    )


@app.get("/api/health")
def health():
    return {"status": "ok", "model": "DeepForest (RetinaNet)"}


@app.get("/")
def root():
    return {
        "message": "Tree Crown Detection API (DeepForest)",
        "docs": "/docs",
        "health": "/api/health",
        "detect_trees": "POST /api/detect-trees",
    }
