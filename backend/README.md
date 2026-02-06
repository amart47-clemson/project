# Tree Crown Detection API (DeepForest)

Backend for **tree crown detection** using [DeepForest](https://deepforest.readthedocs.io/) (RetinaNet-based). The frontend sends a bounding box; the backend fetches satellite imagery for that area, runs DeepForest, and returns detections with lat/lng.

## Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # or: venv\Scripts\activate on Windows
pip install -r requirements.txt
```

**Note:** DeepForest uses PyTorch. On first run it will download the prebuilt model (~50 MB). For GPU support, install PyTorch with CUDA before installing deepforest.

## Run

```bash
uvicorn main:app --reload --port 8000
```

With the frontend dev server (`npm run dev`), requests to `/api` are proxied to `http://127.0.0.1:8000`.

## API

- **POST /api/detect-trees**  
  Body: `{ "bbox": [west, south, east, north], "zoom": optional }`  
  Returns: `{ "count", "trees": [{ "lat", "lng", "score", "xmin", "ymin", "xmax", "ymax" }], "image_bounds" }`

- **GET /api/health**  
  Returns: `{ "status": "ok", "model": "DeepForest (RetinaNet)" }`

## GEDI (NASA ISS lidar)

**POST /api/gedi** — Returns GEDI L4A footprint-level biomass and height for a bbox.

- **Coverage:** 51.6°N to 51.6°S only.
- **Auth:** NASA Earthdata login required. Set `~/.netrc` with `urs.earthdata.nasa.gov` and your credentials, or `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD` (see [Earthdata Login](https://urs.earthdata.nasa.gov)).
- **Returns:** `mean_agbd_Mg_per_ha`, `footprint_count`, `mean_rh98_m` (mean canopy height), or an `error` message if out of coverage / no auth / no data.
- **Dependencies:** `earthaccess`, `h5py` (see `requirements.txt`).

## Flow (detect-trees)

1. Fetch map tiles (ESRI World Imagery) for the bbox and stitch into one RGB image.
2. Run DeepForest `predict_image()` on the image (RetinaNet-based detection).
3. For each detected crown, crop the image and run **species estimation** (`species_estimator.py`): color/texture features classify conifer vs deciduous and assign species.
4. Convert pixel bounding boxes to WGS84 lat/lng and return detections with a `species` field to the frontend for biomass and species breakdown.
