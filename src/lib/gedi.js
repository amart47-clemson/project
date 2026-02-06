/**
 * NASA GEDI L4A (ISS lidar) biomass and height data.
 * POST /api/gedi with bbox [west, south, east, north].
 */

const GEDI_ENDPOINT = '/api/gedi'

/**
 * Fetch GEDI L4A stats for a bounding box.
 * @param {[number, number, number, number]} bbox - [west, south, east, north]
 * @param {string} [apiBase] - Base URL for API
 * @returns {Promise<{ mean_agbd_Mg_per_ha?: number, footprint_count?: number, mean_rh98_m?: number, source?: string, error?: string } | null>}
 */
export async function fetchGediForBbox(bbox, apiBase = '') {
  if (!bbox || bbox.length !== 4) return null
  const url = (apiBase || '').replace(/\/$/, '') + GEDI_ENDPOINT
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
