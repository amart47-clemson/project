import area from '@turf/area'
import center from '@turf/center'
import bbox from '@turf/bbox'
import length from '@turf/length'

/**
 * Compute area in hectares from a drawn shape descriptor.
 * @param {{ type: 'circle'|'polygon', geoJson: object, radius?: number }} shape
 * @returns {number} area in hectares
 */
export function shapeAreaHa(shape) {
  if (shape.type === 'circle' && shape.radius != null) {
    return (Math.PI * shape.radius * shape.radius) / 10000
  }
  const a = area(shape.geoJson)
  return a / 10000
}

/**
 * Total area in hectares for multiple shapes.
 */
export function totalAreaHa(shapes) {
  return shapes.reduce((sum, s) => sum + shapeAreaHa(s), 0)
}

/**
 * Get [lat, lng] center for a shape (for synthetic inventory).
 */
export function shapeCenter(shape) {
  if (shape.type === 'circle' && shape.geoJson?.geometry?.coordinates) {
    const [lng, lat] = shape.geoJson.geometry.coordinates
    return [lat, lng]
  }
  const c = center(shape.geoJson)
  const [lng, lat] = c.geometry.coordinates
  return [lat, lng]
}

/**
 * Combined center (centroid of first shape) for inventory.
 */
export function combinedCenter(shapes) {
  if (shapes.length === 0) return null
  return shapeCenter(shapes[0])
}

/**
 * Bounding box [west, south, east, north] for drawn shapes (FeatureCollection).
 */
export function bboxFromDrawnShapes(shapes) {
  if (shapes.length === 0) return null
  const features = shapes.map((s) => ({
    type: 'Feature',
    geometry: s.geoJson.geometry,
    properties: {},
  }))
  const fc = { type: 'FeatureCollection', features }
  const [west, south, east, north] = bbox(fc)
  return [west, south, east, north]
}

/**
 * Bounding box [west, south, east, north] for a circle (center [lat, lng], radius in m).
 */
export function bboxFromCircle(centerLat, centerLon, radiusM) {
  const lat = centerLat
  const degPerM = 1 / 111320
  const deltaLat = radiusM * degPerM
  const deltaLng = radiusM * degPerM / Math.max(0.01, Math.cos((lat * Math.PI) / 180))
  return [
    centerLon - deltaLng,
    centerLat - deltaLat,
    centerLon + deltaLng,
    centerLat + deltaLat,
  ]
}

/**
 * Path distance in yards for a list of [lat, lng] points (line through points).
 */
export function pathLengthYards(points) {
  if (points.length < 2) return 0
  const line = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: points.map(([lat, lng]) => [lng, lat]),
    },
  }
  const meters = length(line, { units: 'meters' })
  return meters * 1.09361 // meters to yards
}

/**
 * Create closed polygon from trace points and return area (ha), center, bbox, and perimeter (yards).
 */
export function tracedPolygonToArea(tracePoints) {
  if (tracePoints.length < 3) return null
  const ring = [...tracePoints, tracePoints[0]]
  const polygon = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [ring.map(([lat, lng]) => [lng, lat])],
    },
  }
  const areaHa = area(polygon) / 10000
  const [west, south, east, north] = bbox(polygon)
  const c = center(polygon)
  const [lng, lat] = c.geometry.coordinates
  const perimeterYards = pathLengthYards(ring)
  return {
    areaHa,
    center: [lat, lng],
    bbox: [west, south, east, north],
    positions: ring,
    perimeterYards,
  }
}
