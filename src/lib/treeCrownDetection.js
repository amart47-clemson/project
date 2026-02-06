/**
 * Tree crown detection via DeepForest (RetinaNet) backend.
 * Call detectTrees(bbox) with [west, south, east, north]; returns { count, trees } or null on error.
 */

const DEFAULT_API_BASE = '/api'
const DETECT_ENDPOINT = `${DEFAULT_API_BASE}/detect-trees`

/**
 * Detect tree crowns in a bounding box using the DeepForest backend.
 * @param {[number, number, number, number]} bbox - [west, south, east, north] WGS84
 * @param {string} [apiBase] - Base URL for API (e.g. http://localhost:8000 when backend runs separately)
 * @returns {Promise<{ count: number, trees: Array<{ lat, lng, score, xmin, ymin, xmax, ymax }>, image_bounds?: number[] } | null>}
 */
export async function detectTrees(bbox, apiBase = '') {
  const url = (apiBase || '').replace(/\/$/, '') + DETECT_ENDPOINT
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bbox }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      count: data.count ?? 0,
      trees: data.trees ?? [],
      image_bounds: data.image_bounds,
    }
  } catch {
    return null
  }
}

/**
 * Convert DeepForest detections to tree records for biomass analysis.
 * Uses backend species when provided (from image-based species estimation), else 'mixed'.
 * DBH/height estimated from crown confidence.
 * @param {Array<{ lat, lng, score, species? }>} detections
 * @returns {Array<{ id, speciesKey, dbhCm, heightM, lat, lng }>}
 */
export function detectionsToTrees(detections) {
  const validSpecies = new Set(['oak', 'pine', 'maple', 'birch', 'spruce', 'fir', 'cedar', 'poplar', 'walnut', 'mixed'])
  return (detections || []).map((d, i) => {
    const dbhCm = 12 + (d.score || 0.5) * 25
    const heightM = 5 + (d.score || 0.5) * 15
    const speciesKey = d.species && validSpecies.has(d.species) ? d.species : 'mixed'
    return {
      id: `crown-${i}`,
      speciesKey,
      dbhCm: Math.round(dbhCm * 10) / 10,
      heightM: Math.round(heightM * 10) / 10,
      lat: d.lat,
      lng: d.lng,
    }
  })
}
