/**
 * Time-series optical (Sentinel-2 L2A): October & May NDVI, EVI, SAVI.
 * POST /api/sentinel2-timeseries with bbox for phenology (leaf-on/leaf-off).
 */

const SENTINEL2_TIMESERIES_ENDPOINT = '/api/sentinel2-timeseries'

/**
 * Fetch Sentinel-2 October & May indices for a bounding box.
 * @param {[number, number, number, number]} bbox - [west, south, east, north]
 * @param {string} [apiBase] - Base URL for API
 * @returns {Promise<{ october?: { ndvi, evi, savi }, may?: { ndvi, evi, savi }, source?: string, error?: string } | null>}
 */
export async function fetchSentinel2Timeseries(bbox, apiBase = '') {
  if (!bbox || bbox.length !== 4) return null
  const url = (apiBase || '').replace(/\/$/, '') + SENTINEL2_TIMESERIES_ENDPOINT
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bbox }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
