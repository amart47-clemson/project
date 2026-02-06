/**
 * Satellite-derived metrics for the selected area.
 * Replace the simulated response with a real API (e.g. Sentinel Hub Process API,
 * Google Earth Engine, or Copernicus Data Space) for production.
 */

/**
 * Fetch satellite-derived vegetation/NDVI metrics for a circular area.
 * @param {[number, number]} center - [lat, lng]
 * @param {number} radiusM - radius in meters
 * @returns {Promise<{ meanNdvi: number, vegetationCover: string, source: string }>}
 */
export async function fetchSatelliteMetrics(center, radiusM) {
  // Simulated response based on location/area for demo.
  // For production: call Sentinel Hub Process API (evalscript NDVI), Earth Engine,
  // or Copernicus Data Space Ecosystem API with your credentials.
  await delay(400)

  const [lat, lng] = center
  const areaHa = (Math.PI * radiusM * radiusM) / 10000
  const seed = lat * 1e5 + lng * 1e3 + areaHa
  const rng = seededRandom(seed)

  const meanNdvi = 0.35 + rng() * 0.5 // 0.35–0.85
  const cover = meanNdvi < 0.4 ? 'Low' : meanNdvi < 0.6 ? 'Medium' : 'High'

  return {
    meanNdvi: Math.round(meanNdvi * 100) / 100,
    vegetationCover: cover,
    source: 'Simulated (connect Sentinel Hub or Earth Engine for live data)',
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function seededRandom(seed) {
  let s = Math.abs(seed) % 2147483647
  return function () {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}
