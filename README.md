# Biomass & Carbon Estimator

A web app that estimates tree biomass and carbon for a selected area using satellite imagery. You draw or trace a region on the map, run an analysis, and get tree counts, species breakdown, biomass, carbon, and CO₂ equivalent—with optional NASA GEDI lidar and Sentinel-2 time-series data to improve accuracy.

This README explains how to **run the software on your own machine** and how to **deploy it as a single website** so someone can use it from one link (no install).

---

## One link for your partner (deployed website)

If you deploy the app to the cloud, your partner can open **one URL** in a browser and use the full app (map, draw, analyze)—no terminals or installs.

**Ways to get a single link:**

1. **Docker (recommended)** — One service that serves both the app and the API. Deploy to **Railway**, **Render**, or **Fly.io** using the included `Dockerfile`. After deploy, you get a URL like `https://your-app.up.railway.app`; share that link. See **[DEPLOY.md](DEPLOY.md)** for step-by-step (Railway and Render).
2. **Frontend + backend separately** — Deploy the frontend (e.g. Vercel) and the backend (e.g. Render), then set the frontend’s API URL to the backend. Your partner uses the **frontend** link only; the app calls the backend in the background.

Details (Railway, Render, env vars, GEDI): **[DEPLOY.md](DEPLOY.md)**.

---

## What you need first (to run locally)

- **Node.js** (v18 or newer) — [nodejs.org](https://nodejs.org/)
- **Python** (3.10–3.13) — [python.org](https://www.python.org/)
- A terminal (Terminal.app on Mac, Command Prompt or PowerShell on Windows, or the terminal in your editor)

---

## How to run the app (two terminals)

The app has a **backend** (Python) and a **frontend** (Node). You run each in its own terminal and leave both running while you use the app.

### Terminal 1 — Backend

1. Open a terminal and go to the project folder (the one that contains the `backend` folder).

2. Go into the backend and create a Python virtual environment (only needed once):

   ```bash
   cd backend
   python3 -m venv venv
   ```

   On Windows, if `python3` doesn’t work, try `py -3 -m venv venv` or `python -m venv venv`.

3. Activate the virtual environment:

   - **Mac/Linux:** `source venv/bin/activate`
   - **Windows (Cmd):** `venv\Scripts\activate.bat`
   - **Windows (PowerShell):** `venv\Scripts\Activate.ps1`

   Your prompt should start with `(venv)`.

4. Install Python dependencies (first time only; can take several minutes):

   ```bash
   pip install -r requirements.txt
   ```

5. Start the backend server:

   ```bash
   uvicorn main:app --reload --port 8000
   ```
   

   When it’s ready you’ll see something like: **Uvicorn running on http://127.0.0.1:8000**

6. **Leave this terminal open.** Don’t close it while you’re using the app.

---

### Terminal 2 — Frontend

1. Open a **second** terminal and go to the **project root** (the folder that contains `backend` and `package.json`). Do **not** go into `backend`.

2. Install Node dependencies (first time only):

   ```bash
   npm install
   ```

3. Start the frontend:

   ```bash
   npm run dev
   ```

   You should see a line like: **Open in browser: http://127.0.0.1:3000**

4. Open your browser and go to:

   **http://127.0.0.1:3000**

   (The app may open automatically.)

5. **Leave this terminal open** as well.

---

## Using the app

1. **Search** — Use the search box to type a place name (e.g. city or address) and click **Go** to center the map.
2. **Choose an area** — Either:
   - Use the **drawing toolbar** (top-left) to draw a polygon, circle, or rectangle, or  
   - Use **Trace boundary** to click points along a boundary (e.g. a river or property line), then **Close boundary & use area**, or  
   - Click the map once to set a center, set **Quick circle radius (m)**, and use that circle.
3. **Optional:** Use **Dominant species** to tell the app the main tree type (e.g. Pine) for better species results.
4. Click **Analyze area** and wait. Results appear in the panel on the right: tree crown count, GEDI (when available), Sentinel-2 time-series (October & May NDVI/EVI/SAVI), biomass, carbon, species breakdown, and tree-level table.

---

## Optional: NASA GEDI data

For **GEDI (ISS lidar)** biomass and height in the results, you need a free NASA Earthdata account and stored credentials:

1. Sign up at [urs.earthdata.nasa.gov](https://urs.earthdata.nasa.gov/users/new).
2. Create a file named `.netrc` in your home directory with:

   ```
   machine urs.earthdata.nasa.gov
       login YOUR_USERNAME
       password YOUR_PASSWORD
   ```

   (Use your real Earthdata username and password.)

3. On Mac/Linux, run: `chmod 600 ~/.netrc`

4. Restart the backend (Terminal 1). GEDI data will then be used when the analyzed area is between 51.6°N and 51.6°S.

If you skip this, the app still runs; you’ll just see a message in the GEDI section instead of numbers when no credentials are set or no granules are found.

---

## Quick checks

- **Backend only:** In the browser, open [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health). You should see something like `{"status":"ok","model":"DeepForest (RetinaNet)"}`.
- **Frontend only (no backend):** The app loads and you can draw and click **Analyze area**, but tree detection and GEDI/Sentinel-2 will be limited or simulated.
- **Both running:** Draw an area, click **Analyze area**, and you should see **Tree crown detection: DeepForest (RetinaNet) — N crowns** and other live data in the results.

---

## Build for production (optional)

From the project root:

```bash
npm run build
npm run preview
```

Then open the URL shown (e.g. http://127.0.0.1:4173). The backend must still be running separately for full analysis.

---

## What the app does (for presenting)

- **Map:** Satellite imagery (ESRI) with drawing and trace tools to define an area.
- **Tree crown detection:** DeepForest (RetinaNet) finds individual tree crowns in the selected region.
- **Species:** Estimated from crown imagery and optional Sentinel-2 phenology (Oct vs May); you can set a **Dominant species** to improve the mix.
- **Biomass & carbon:** Allometric equations from tree size and species; totals can be blended with **NASA GEDI** (when available) and **Sentinel-2** NDVI for better accuracy.
- **Time-series optical:** Sentinel-2 October and May NDVI, EVI, and SAVI for phenology (leaf-on/leaf-off).

---

## Tech stack

- **Frontend:** React, Vite, Leaflet, Geoman (drawing), Turf (area/length)
- **Backend:** FastAPI, DeepForest, Sentinel-2 (Planetary Computer), NASA GEDI (Earthdata)
- **Map:** ESRI World Imagery, Nominatim search
