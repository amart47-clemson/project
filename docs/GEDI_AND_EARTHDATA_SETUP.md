# Connecting GEDI Laser and NASA Earthdata to Your Biomass Calculator

This guide walks you through setting up **GEDI (ISS lidar)** and **NASA Earthdata** so that every time you draw boundaries and run an analysis, the app uses real GEDI laser data for the most accurate biomass and height estimates.

---

## What You’re Connecting

- **GEDI** — A lidar instrument on the International Space Station that shoots laser pulses at the Earth. It measures forest height and aboveground biomass density (AGBD) in ~25 m footprints. Your app uses **GEDI L4A** data.
- **NASA Earthdata** — NASA’s system for distributing Earth science data. GEDI data is stored there; you must log in (free account) so the app can download it.

**Important:** GEDI only has data between **51.6°N and 51.6°S** (roughly from southern Canada to southern Chile). Areas outside that band will show a “outside GEDI coverage” message; the rest of your analysis (DeepForest, biomass, etc.) still runs.

---

## Overview: What You’ll Do

1. Create a free NASA Earthdata account.
2. Tell your computer how to log in (either a `.netrc` file or environment variables).
3. Make sure the backend is installed and running when you analyze.
4. Draw areas **within 51.6°N–51.6°S** and run “Analyze area” — GEDI and Earthdata will be used automatically.

---

## Step 1 — Create a NASA Earthdata Account

1. Open: **[https://urs.earthdata.nasa.gov](https://urs.earthdata.nasa.gov)**  
2. Click **“Register”** (or “Create Account”).
3. Fill in:
   - Email
   - Password (meet their requirements)
   - First / Last name
   - Country
   - Accept the terms and complete registration.
4. Check your email and **confirm the account** (required).
5. Log in at [urs.earthdata.nasa.gov](https://urs.earthdata.nasa.gov) to confirm you can sign in.

You’ll use this **username** and **password** in the next step. Never share them or commit them to git.

---

## Step 2 — Give the Backend Your Earthdata Credentials

The **backend** (Python server) is what talks to NASA. You can use either **Option A** (recommended) or **Option B**.

### Option A — Use a `.netrc` file (recommended)

A `.netrc` file stores machine names and login credentials. Many NASA tools (including `earthaccess`, which your backend uses) read it automatically.

1. **Create or edit the file** in your **home directory**:
   - **macOS / Linux:**  
     The file is `~/.netrc` (full path: `/Users/YourUsername/.netrc` on Mac).
   - **Windows:**  
     The file is `%USERPROFILE%\.netrc` (e.g. `C:\Users\YourUsername\.netrc`).

2. **Open the file in a text editor.** If it doesn’t exist, create a new file with that exact name (including the leading dot).

3. **Add these lines** (replace `YOUR_EARTHDATA_USERNAME` and `YOUR_EARTHDATA_PASSWORD` with your real Earthdata login):

   ```
   machine urs.earthdata.nasa.gov
   login YOUR_EARTHDATA_USERNAME
   password YOUR_EARTHDATA_PASSWORD
   ```

   Example (fake credentials):

   ```
   machine urs.earthdata.nasa.gov
   login jane_doe
   password mySecretPass123
   ```

4. **Save the file.**

5. **Restrict permissions** (so only you can read it):
   - **macOS / Linux:** In Terminal:
     ```bash
     chmod 600 ~/.netrc
     ```
   - **Windows:** Right‑click the file → Properties → Security → restrict so only your user can read it.

After this, any time you start the backend (Step 4), it will use this file to log in to Earthdata and fetch GEDI data when you run an analysis.

---

### Option B — Use environment variables

If you prefer not to use a `.netrc` file, you can pass credentials with environment variables. **Important:** Set these in the **same terminal** where you start the backend (or in your shell profile if you want them always set).

1. **macOS / Linux (Terminal)**  
   Before starting the backend, run (use your real Earthdata username and password):

   ```bash
   export EARTHDATA_USERNAME="YOUR_EARTHDATA_USERNAME"
   export EARTHDATA_PASSWORD="YOUR_EARTHDATA_PASSWORD"
   ```

   Example:
   ```bash
   export EARTHDATA_USERNAME="jane_doe"
   export EARTHDATA_PASSWORD="mySecretPass123"
   ```

2. **Windows (Cmd)**  
   ```cmd
   set EARTHDATA_USERNAME=YOUR_EARTHDATA_USERNAME
   set EARTHDATA_PASSWORD=YOUR_EARTHDATA_PASSWORD
   ```

3. **Windows (PowerShell)**  
   ```powershell
   $env:EARTHDATA_USERNAME = "YOUR_EARTHDATA_USERNAME"
   $env:EARTHDATA_PASSWORD = "YOUR_EARTHDATA_PASSWORD"
   ```

Then start the backend in **that same terminal** (see Step 4). The backend checks these variables if `.netrc` login isn’t used.

---

## Step 3 — Install Backend Dependencies (GEDI support)

The backend needs `earthaccess` and `h5py` to search and read GEDI data. They’re already listed in `backend/requirements.txt`.

1. Open a terminal and go to the backend folder:
   ```bash
   cd backend
   ```
   (Use the full path to your project if needed, e.g. `cd /Users/alexhundemer/Documents/GitHub/project/backend`.)

2. Create and activate the virtual environment (if you haven’t already):
   ```bash
   python3 -m venv venv
   source venv/bin/activate   # macOS/Linux
   ```
   On Windows (PowerShell): `venv\Scripts\Activate.ps1`  
   On Windows (Cmd): `venv\Scripts\activate.bat`

3. Install dependencies (this includes `earthaccess` and `h5py`):
   ```bash
   pip install -r requirements.txt
   ```

If that completes without errors, GEDI support is installed.

---

## Step 4 — Start the Backend (so GEDI is used)

GEDI is only used when the **backend** is running. The frontend sends the drawn area to the backend, which then calls NASA Earthdata and returns GEDI results.

1. In a terminal, go to the backend and activate the venv:
   ```bash
   cd backend
   source venv/bin/activate   # or Windows: venv\Scripts\Activate.ps1
   ```

2. If you use **Option B** (environment variables), set them in this same terminal:
   ```bash
   export EARTHDATA_USERNAME="your_username"
   export EARTHDATA_PASSWORD="your_password"
   ```

3. Start the API server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

4. When you see something like:
   ```text
   Uvicorn running on http://127.0.0.1:8000
   ```
   leave this terminal open. The backend is now running and will use Earthdata/GEDI when you analyze.

5. In another terminal (or your browser), start the frontend from the **project root**:
   ```bash
   npm run dev
   ```
   Then open **http://localhost:5173**.

---

## Step 5 — Run an Analysis So GEDI and Earthdata Are Used

1. In the app, **search or pan** to a location **between 51.6°N and 51.6°S** (e.g. most of the US, Mexico, Brazil, Europe, India, Indonesia, southern Japan).
2. Use the **drawing tools** to draw a **polygon**, **circle**, or **rectangle** around the forest area you care about.
3. Click **“Analyze area”**.

The app will:

- Send the drawn boundary to the backend.
- Backend will log in to NASA Earthdata (using `.netrc` or env vars).
- Backend will search and download GEDI L4A data for that area and compute mean AGBD, footprint count, and mean height (RH98).
- Results will show in the **“GEDI (ISS lidar)”** section: **Mean AGBD**, **Footprints**, **Mean RH98 (height)**.

If you see **numbers** in that section (not “NASA Earthdata login required” or “Area outside GEDI coverage”), then **GEDI and NASA Earthdata were used** for that analysis.

---

## How to Confirm GEDI and Earthdata Are Being Used

- **GEDI section shows:**
  - **Mean AGBD** (e.g. 45.2 Mg/ha)
  - **Footprints** (e.g. 120)
  - **Mean RH98 (height)** (e.g. 18.5 m)  
  → GEDI laser and NASA Earthdata were used.

- **GEDI section shows:**
  - “NASA Earthdata login required. Set .netrc or EARTHDATA_USERNAME/EARTHDATA_PASSWORD.”  
  → Credentials are missing or wrong. Re-check Step 2 and that you restarted the backend after changing `.netrc` or env vars.

- **GEDI section shows:**
  - “Area outside GEDI coverage (51.6°N to 51.6°S).”  
  → Your drawn area is outside the ISS orbit band. Move the map to a location within that latitude range and draw again.

- **GEDI section doesn’t appear at all**  
  → Backend might not be running or the request failed. Ensure the backend is running on port 8000 and try “Analyze area” again.

---

## Quick Reference Checklist

- [ ] NASA Earthdata account created and email verified.
- [ ] Credentials set: either `~/.netrc` (Option A) or `EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD` (Option B).
- [ ] Backend dependencies installed: `pip install -r requirements.txt` in `backend` with venv active.
- [ ] Backend running: `uvicorn main:app --reload --port 8000` in the same environment where credentials are available.
- [ ] Frontend running: `npm run dev` and open http://localhost:5173.
- [ ] Analyzed area is **within 51.6°N–51.6°S**.
- [ ] “Analyze area” shows GEDI metrics (Mean AGBD, Footprints, Mean RH98) — then GEDI and NASA Earthdata are connected and utilized.

---

## Troubleshooting

**“NASA Earthdata login required”**

- Confirm `.netrc` has exactly: `machine urs.earthdata.nasa.gov`, `login`, `password` (no typos).
- If using env vars, set them in the **same** terminal where you run `uvicorn` and restart the backend.
- Try logging in at [urs.earthdata.nasa.gov](https://urs.earthdata.nasa.gov) in a browser to confirm the password works.

**“Area outside GEDI coverage”**

- GEDI only covers 51.6°N–51.6°S. Use the map to choose a location in that band (e.g. continental US, Central America, South America, Africa, southern Europe, Asia, Australia) and redraw your boundary.

**“No GEDI L4A granules found for this area and time range”**

- The backend searches 2020–2023 by default. Some areas may have few overpasses. Try a slightly larger or different area, or a known forested region.

**GEDI section missing entirely**

- Backend must be running on port 8000. Check [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health); you should get `{"status":"ok", ...}`.
- Make sure the frontend is proxying `/api` to the backend (default in this project).

**First GEDI run is slow**

- The first time you run an analysis in an area, the backend downloads GEDI granules from NASA; this can take 30 seconds or more. Later runs in the same area may be faster if you repeat soon.

---

Once the checklist is done and you see GEDI numbers in the results, every analysis you run for boundaries inside 51.6°N–51.6°S will use the GEDI laser and NASA Earthdata for that part of the analysis, giving you the most accurate remote biomass and height data the app can provide.
