....
# Biomass & Carbon Estimator

A web app for estimating tree biomass and carbon for potential properties. You can input locations, draw a circle around an area of trees, and run an analysis that reports biomass, carbon, species breakdown, heights, and materials (volume).

## Features

- **Satellite imagery** — Map defaults to **Satellite** base layer (ESRI World Imagery); switch to Streets (dark) via the layer control (top right).
- **Draw or highlight areas** — Use the **drawing toolbar** (top-left) to draw **Polygon**, **Circle**, or **Rectangle** over forest areas. You can draw multiple shapes; they are combined for one analysis. Optional: use the **quick circle** (click map for center + radius) instead.
- **Location search** — Search by city, address, or place name to center the map.
- **Tree crown detection (DeepForest)** — With the Python backend running, analysis uses **DeepForest (RetinaNet)** to detect individual tree crowns from satellite imagery in the selected area. Detected crowns drive the tree count and biomass analysis; if the backend is unavailable, the app falls back to a synthetic inventory.
- **GEDI (NASA ISS lidar)** — When the backend is running and the area is within 51.6°N–51.6°S, the app fetches **GEDI L4A** data: laser pulse measurements of canopy height (RH98) and aboveground biomass density (AGBD, Mg/ha). These are among the most accurate remote biomass estimates available. Requires [NASA Earthdata login](https://urs.earthdata.nasa.gov) (set `~/.netrc` or env vars).
- **Analyze area** — Run tree crown detection (when backend is up), GEDI lookup (when in coverage), biomass/carbon estimation, and satellite-derived metrics for the drawn area(s) or the quick circle.
- **Results** — Tree crown count (DeepForest), **GEDI L4A** (mean AGBD, footprint count, mean height), satellite-derived (NDVI, vegetation cover), summary (tree count, biomass, carbon, CO₂ equivalent, volume), species breakdown, and tree-level table.

## Walkthrough: Starting both ends

Use two terminals: one for the **backend**, one for the **frontend**.

### Prerequisites

- **Node.js** (v18+)
- **Python** (3.9+)
- **pip**

---

### Terminal 1 — Backend (tree crown detection)

1. Go into the backend folder and create a virtual environment:

   ```bash
   cd backend
   python3 -m venv venv
   ```

   (Use `python3` if `python` is not found on your system.)

2. Activate the virtual environment:

   - **macOS/Linux:** `source venv/bin/activate`
   - **Windows (Cmd):** `venv\Scripts\activate.bat`
   - **Windows (PowerShell):** `venv\Scripts\Activate.ps1`

   You should see `(venv)` in your prompt.

3. Install dependencies (first time can take a few minutes; DeepForest pulls PyTorch and will download the model on first run):

   ```bash
   pip install -r requirements.txt
   ```

4. Start the API server:

   ```bash
   uvicorn main:app --reload --port 8000
   ```

   When it’s ready you’ll see something like: `Uvicorn running on http://127.0.0.1:8000`

5. Leave this terminal running. Optional check: open [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) — you should get `{"status":"ok","model":"DeepForest (RetinaNet)"}`.

---

### Terminal 2 — Frontend

1. From the **project root** (not inside `backend`), install and start the dev server:

   ```bash
   npm install
   npm run dev
   ```

2. When Vite is ready, open in your browser:

   **http://localhost:5173**

3. The frontend proxies `/api` to the backend, so tree crown detection will work as long as the backend is running on port 8000.

---

### Quick check

- **Frontend only:** App runs; “Analyze area” uses a synthetic tree list (no DeepForest).
- **Backend + frontend:** “Analyze area” calls the backend; you should see **“Tree crown detection: DeepForest (RetinaNet) — N crowns”** in the results when the backend returns detections.

## Build

```bash
npm run build
npm run preview
```

## How the analysis works

- **Allometric model**: Above-ground biomass is estimated with \( W = a \times (D^2 H)^b \), where \( D \) is DBH (cm), \( H \) is height (m), and \( a \), \( b \) are species-specific parameters.
- **Carbon**: Carbon (kg) = biomass × 0.47; CO₂ equivalent = carbon × 3.67.
- **Species**: Oak, pine, maple, birch, spruce, fir, cedar, poplar, walnut, and mixed hardwood with different wood densities and equation coefficients.
- **Materials**: Stem volume is approximated from DBH and height; mass from volume and wood density.

**Satellite-derived metrics** (`src/lib/satellite.js`): The app shows mean NDVI and vegetation cover for the selected area. The current implementation is simulated. For live satellite data, integrate:

- **Sentinel Hub Process API** — NDVI/evalscripts with Sentinel-2 (requires [Sentinel Hub](https://www.sentinel-hub.com/) account).
- **Google Earth Engine** — Tree cover, NDVI, and custom analysis (requires GEE account and backend or Earth Engine API).
- **Copernicus Data Space Ecosystem** — [Sentinel Hub APIs](https://dataspace.copernicus.eu/analyse/apis/sentinel-hub) for Sentinel-2.

When the **backend is not running**, the app uses a synthetic tree inventory for the selected area. When the backend is running, **DeepForest** detects tree crowns from stitched satellite tiles and those detections are converted to tree records (with estimated DBH/height from confidence) for biomass analysis.

## Tech stack

- **Frontend:** React 18, Vite, Leaflet + react-leaflet, Geoman (drawing), Turf (area/bbox)
- **Backend:** FastAPI, DeepForest (RetinaNet), Pillow, mercantile, requests
- **Map/imagery:** ESRI World Imagery (tiles), Nominatim (geocoding)


