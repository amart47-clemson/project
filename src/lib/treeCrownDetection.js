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
 * @param {{ phenology?: { october_ndvi?: number, may_ndvi?: number }, dominant_species?: string }} [options] - optional phenology (Sentinel-2) and dominant species for better species ID
 * @returns {Promise<{ count: number, trees: Array<{ lat, lng, score, species?, ... }>, image_bounds?: number[] } | null>}
 */
export async function detectTrees(bbox, apiBase = '', options = {}) {
  const url = (apiBase || '').replace(/\/$/, '') + DETECT_ENDPOINT
  const body = { bbox }
  if (options.phenology && (options.phenology.october_ndvi != null || options.phenology.may_ndvi != null)) {
    body.phenology = {
      october_ndvi: options.phenology.october_ndvi,
      may_ndvi: options.phenology.may_ndvi,
    }
  }
  if (options.dominant_species && options.dominant_species.trim()) {
    body.dominant_species = options.dominant_species.trim()
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
