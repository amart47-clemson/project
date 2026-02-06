import { useState, useRef } from 'react'
import { MapContainer, TileLayer, Circle, Polygon, Polyline, CircleMarker, useMap, useMapEvents, LayersControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import MapDrawing, { clearDrawnLayers } from './MapDrawing'
import { totalAreaHa, combinedCenter, bboxFromDrawnShapes, bboxFromCircle, pathLengthYards, tracedPolygonToArea } from '../lib/drawnArea'
import { circleAreaHa } from '../lib/analysis'

const { BaseLayer } = LayersControl

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
// ESRI World Imagery: satellite/aerial base (Leaflet passes z, x, y → ESRI uses z, y, x)
const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

function MapClickHandler({ setCenter, drawingActive, traceMode, onAddTracePoint }) {
  useMapEvents({
    click(e) {
      if (traceMode && onAddTracePoint) {
        onAddTracePoint([e.latlng.lat, e.latlng.lng])
        return
      }
      if (!drawingActive) setCenter([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

function FlyToCenter({ center, zoomTo }) {
  const map = useMap()
  if (center) {
    map.setView(center, zoomTo != null ? zoomTo : map.getZoom())
  }
  return null
}

function sameLatLng(a, b) {
  return a && b && a[0] === b[0] && a[1] === b[1]
}

export default function MapView({
  center,
  setCenter,
  radiusM,
  setRadiusM,
  onAnalyze,
  analysisResult,
  analysisLoading,
}) {
  const [searchInput, setSearchInput] = useState('')
  const [searchError, setSearchError] = useState('')
  const [lastSearchedCenter, setLastSearchedCenter] = useState(null)
  const [drawnShapes, setDrawnShapes] = useState([])
  const [traceMode, setTraceMode] = useState(false)
  const [tracePoints, setTracePoints] = useState([])
  const [tracedBoundary, setTracedBoundary] = useState(null)
  const mapRef = useRef(null)

  const addTracePoint = (point) => {
    setTracePoints((prev) => [...prev, point])
  }
  const clearTrace = () => {
    setTracePoints([])
    setTracedBoundary(null)
    setTraceMode(false)
  }
  const closeTraceAndUse = () => {
    const result = tracedPolygonToArea(tracePoints)
    if (result) setTracedBoundary(result)
  }

  const handleSearch = async () => {
    if (!searchInput.trim()) return
    setSearchError('')
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchInput.trim())}&limit=1`
      )
      const data = await res.json()
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat)
        const lon = parseFloat(data[0].lon)
        const newCenter = [lat, lon]
        setCenter(newCenter)
        setLastSearchedCenter(newCenter)
      } else {
        setSearchError('Location not found.')
      }
    } catch (e) {
      setSearchError('Search failed. Try again.')
    }
  }

  const hasDrawnAreas = drawnShapes.length > 0
  const drawnAreaHa = hasDrawnAreas ? totalAreaHa(drawnShapes) : 0
  const hasCircle = center && radiusM > 0
  const hasTracedBoundary = tracedBoundary != null
  const canAnalyze = hasDrawnAreas || hasCircle || hasTracedBoundary
  const pathYards = pathLengthYards(tracePoints)

  const handleAnalyzeClick = () => {
    if (hasTracedBoundary) {
      onAnalyze({ areaHa: tracedBoundary.areaHa, center: tracedBoundary.center, bbox: tracedBoundary.bbox })
      return
    }
    if (hasDrawnAreas) {
      const bbox = bboxFromDrawnShapes(drawnShapes)
      onAnalyze({ areaHa: drawnAreaHa, center: combinedCenter(drawnShapes), bbox })
    } else {
      const [lat, lng] = center
      const bbox = bboxFromCircle(lat, lng, radiusM)
      onAnalyze({ areaHa: circleAreaHa(radiusM), center: [lat, lng], bbox })
    }
  }

  const handleClearDrawn = () => {
    if (mapRef.current) clearDrawnLayers(mapRef.current)
    setDrawnShapes([])
  }

  return (
    <div className="map-wrap">
      <div className="map-controls">
        <div className="search-row">
          <input
            type="text"
            className="search-input"
            placeholder="Search location (e.g. city, address)"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button type="button" className="btn btn-primary" onClick={handleSearch}>
            Go
          </button>
        </div>
        {searchError && <p className="search-error">{searchError}</p>}
        <div className="radius-row">
          <label>
            <span>Quick circle radius (m):</span>
            <input
              type="number"
              min={50}
              max={5000}
              step={50}
              value={radiusM}
              onChange={e => setRadiusM(Number(e.target.value) || 200)}
            />
          </label>
        </div>
        <div className="trace-boundary-row">
          <button
            type="button"
            className={`btn ${traceMode ? 'btn-accent' : ''}`}
            onClick={() => setTraceMode((t) => !t)}
          >
            {traceMode ? 'Trace boundary (clicking…)' : 'Trace boundary'}
          </button>
          {tracePoints.length > 0 && (
            <>
              <span className="path-yards">
                Path: <strong>{pathYards.toFixed(0)} yd</strong>
                {tracePoints.length >= 3 && (
                  <button type="button" className="btn btn-accent" onClick={closeTraceAndUse}>
                    Close boundary & use area
                  </button>
                )}
              </span>
              <button type="button" className="btn-clear" onClick={clearTrace}>
                Clear trace
              </button>
            </>
          )}
        </div>
        {hasTracedBoundary && (
          <p className="drawn-summary">
            Boundary: <strong>{tracedBoundary.areaHa.toFixed(2)} ha</strong> · Perimeter: <strong>{tracedBoundary.perimeterYards.toFixed(0)} yd</strong>
          </p>
        )}
        <p className="hint">
          <strong>Draw areas:</strong> toolbar (top-left) for Polygon/Circle/Rectangle, or <strong>Trace boundary</strong> to click points along a river/path; path distance is shown in yards. Quick circle: click map for center, set radius.
        </p>
        {hasDrawnAreas && (
          <p className="drawn-summary">
            {drawnShapes.length} area(s) drawn · {drawnAreaHa.toFixed(2)} ha
            <button type="button" className="btn-clear" onClick={handleClearDrawn}>
              Clear drawn areas
            </button>
          </p>
        )}
        {canAnalyze && (
          <>
            <button
              type="button"
              className="btn btn-accent"
              onClick={handleAnalyzeClick}
              disabled={analysisLoading}
            >
              {analysisLoading ? 'Analyzing…' : 'Analyze area'}
            </button>
          </>
        )}
      </div>
      <MapContainer
        center={center || [39.8283, -98.5795]}
        zoom={center ? 12 : 4}
        className="map"
        zoomControl={true}
      >
        <LayersControl position="topright">
          <BaseLayer name="Satellite" checked>
            <TileLayer
              url={SATELLITE_TILES}
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            />
          </BaseLayer>
          <BaseLayer name="Streets (dark)">
            <TileLayer
              url={DARK_TILES}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO'
            />
          </BaseLayer>
        </LayersControl>
        {center && <FlyToCenter center={center} zoomTo={sameLatLng(center, lastSearchedCenter) ? 12 : undefined} />}
        {center && !hasDrawnAreas && !hasTracedBoundary && (
          <Circle
            center={center}
            radius={radiusM}
            pathOptions={{
              color: 'var(--accent)',
              fillColor: 'var(--accent)',
              fillOpacity: 0.15,
              weight: 2,
            }}
          />
        )}
        <MapDrawing onDrawnChange={setDrawnShapes} mapRef={mapRef} />
        {tracePoints.length >= 2 && !tracedBoundary && (
          <Polyline
            positions={tracePoints}
            pathOptions={{ color: 'var(--accent)', weight: 3 }}
          />
        )}
        {tracePoints.map((pos, i) => (
          <CircleMarker
            key={i}
            center={pos}
            radius={5}
            pathOptions={{ color: 'var(--accent)', fillColor: 'var(--accent)', fillOpacity: 1, weight: 1 }}
          />
        ))}
        {tracedBoundary && (
          <Polygon
            positions={tracedBoundary.positions}
            pathOptions={{
              color: 'var(--accent)',
              fillColor: 'var(--accent)',
              fillOpacity: 0.2,
              weight: 2,
            }}
          />
        )}
        <MapClickHandler
          setCenter={setCenter}
          drawingActive={hasDrawnAreas}
          traceMode={traceMode}
          onAddTracePoint={addTracePoint}
        />
      </MapContainer>
    </div>
  )
}
