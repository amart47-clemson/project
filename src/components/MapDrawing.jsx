import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'

/**
 * Serialize a Geoman/Leaflet layer for area computation.
 * @param {L.Layer} layer
 * @returns {{ type: 'circle'|'polygon', geoJson: object, radius?: number } | null}
 */
function layerToShape(layer) {
  if (!layer?.toGeoJSON) return null
  const geoJson = layer.toGeoJSON()
  const radius = typeof layer.getRadius === 'function' ? layer.getRadius() : undefined
  return {
    type: radius != null ? 'circle' : 'polygon',
    geoJson,
    ...(radius != null && { radius }),
  }
}

/**
 * Sync current drawn layers to parent and return count for re-render.
 */
function syncDrawnShapes(map, onDrawnChange) {
  if (!map?.pm?.getGeomanDrawLayers) return
  const layers = map.pm.getGeomanDrawLayers(false) || []
  const shapes = layers.map(layerToShape).filter(Boolean)
  onDrawnChange(shapes)
}

export default function MapDrawing({ onDrawnChange, mapRef }) {
  const map = useMap()
  const onDrawnChangeRef = useRef(onDrawnChange)
  onDrawnChangeRef.current = onDrawnChange
  if (mapRef) mapRef.current = map

  useEffect(() => {
    if (!map?.pm) return

    map.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawText: false,
      drawCircle: true,
      drawRectangle: true,
      drawPolygon: true,
      editMode: true,
      dragMode: true,
      cutPolygon: false,
      removalMode: true,
      rotateMode: false,
    })

    map.pm.setPathOptions({
      color: 'var(--accent)',
      fillColor: 'var(--accent)',
      fillOpacity: 0.2,
      weight: 2,
    })

    const sync = () => syncDrawnShapes(map, (s) => onDrawnChangeRef.current(s))

    map.on('pm:create', sync)
    map.on('pm:remove', sync)
    map.on('pm:edit', sync)

    return () => {
      map.off('pm:create', sync)
      map.off('pm:remove', sync)
      map.off('pm:edit', sync)
      map.pm.removeControls()
    }
  }, [map])

  return null
}

/**
 * Clear all drawn layers from the map. Call from parent with map ref.
 */
export function clearDrawnLayers(map) {
  if (!map?.pm?.getGeomanDrawLayers) return
  const layers = map.pm.getGeomanDrawLayers(false) || []
  layers.forEach((layer) => map.removeLayer(layer))
}
