# Deploy the app (one link for your partner)

Deploy the app so your partner can open **one URL** and use everything—no install, no terminals.

The repo includes a **Dockerfile** that builds the frontend and runs the backend in one container. Deploy that container to a host; the host gives you a URL like `https://your-app.up.railway.app`. Share that link.

---

## Option A: Railway (Docker) — one URL

1. **Sign up:** [railway.app](https://railway.app) (GitHub login is fine).

2. **New project from repo:**
   - **New Project** → **Deploy from GitHub repo**.
   - Select this repository.
   - Railway will detect the Dockerfile and build the image, then run it.

3. **Generate a domain:**
   - In the project, open your service → **Settings** → **Networking** → **Generate Domain**.
   - You’ll get a URL like `https://biomass-carbon-estimator-production.up.railway.app`.

4. **Share that URL** — Your partner opens it in a browser and can search, draw, and run **Analyze area** as usual.

**Optional (NASA GEDI on Railway):** In the service → **Variables**, add:
- `EARTHDATA_USERNAME` = your NASA Earthdata username  
- `EARTHDATA_PASSWORD` = your NASA Earthdata password  

Then redeploy so GEDI data can be used when the area is in range.

**Note:** The first request after a cold start can take 30–60 seconds (DeepForest loads). After that, analysis is faster.

---

## Option B: Render (Docker) — one URL

1. **Sign up:** [render.com](https://render.com) (GitHub login is fine).

2. **New Web Service:**
   - **Dashboard** → **New** → **Web Service**.
   - Connect this GitHub repository.

3. **Settings:**
   - **Environment:** Docker.
   - **Build Command:** (leave empty; Render uses the Dockerfile).
   - **Start Command:** (leave empty; Dockerfile defines the command).
   - **Instance type:** Free is fine for demos; for heavier use, pick a paid instance (DeepForest benefits from more RAM).

4. **Create Web Service.** Render will build the image and deploy. It will assign a URL like `https://biomass-carbon-estimator.onrender.com`.

5. **Share that URL** with your partner.

**Optional (NASA GEDI on Render):** In the service → **Environment** → **Add Environment Variable**:
- `EARTHDATA_USERNAME` = your NASA Earthdata username  
- `EARTHDATA_PASSWORD` = your NASA Earthdata password  

Save; Render will redeploy.

**Note:** On the free tier, the service may spin down after inactivity. The first request after that can take a minute or two.

---

## Option C: Frontend + backend on two hosts

If you prefer not to use Docker:

1. **Backend (e.g. Render):**
   - New **Web Service**, connect this repo.
   - **Root Directory:** `backend`.
   - **Build:** `pip install -r requirements.txt`
   - **Start:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Note the backend URL (e.g. `https://your-backend.onrender.com`).

2. **Frontend (e.g. Vercel):**
   - New project from this repo (Vercel).
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Environment variable:** `VITE_API_URL` = your backend URL (e.g. `https://your-backend.onrender.com`)
   - Deploy. Note the frontend URL (e.g. `https://your-app.vercel.app`).

3. **Backend CORS:** In the backend host’s environment, set:
   - `ALLOWED_ORIGINS` = your frontend URL (e.g. `https://your-app.vercel.app`)

4. **Share the frontend URL** — Your partner uses that one link; the app will call the backend automatically.

---

## Summary

| Goal                         | Use                          | Link to share        |
|-----------------------------|-------------------------------|----------------------|
| One URL, minimal setup      | Railway or Render (Docker)    | The service URL      |
| Frontend and backend split | Render (backend) + Vercel (frontend) | The **frontend** URL |

After deploy, your partner only needs to open the link in a browser and use the app like the README describes.
