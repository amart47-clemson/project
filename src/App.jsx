import { useState, useCallback } from 'react'
import MapView from './components/MapView'
import ResultsPanel from './components/ResultsPanel'
import {
  syntheticInventoryForArea,
  runAnalysisWithRemoteData,
  circleAreaHa,
} from './lib/analysis'
import { fetchSatelliteMetrics } from './lib/satellite'
import { detectTrees, detectionsToTrees } from './lib/treeCrownDetection'
import { fetchGediForBbox } from './lib/gedi'
import { fetchSentinel2Timeseries } from './lib/sentinel2Timeseries'
import './App.css'

const DEFAULT_CENTER = [39.8283, -98.5795]
const DEFAULT_RADIUS = 500

export default function App() {
  const [center, setCenter] = useState(null)
  const [radiusM, setRadiusM] = useState(DEFAULT_RADIUS)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [areaHa, setAreaHa] = useState(null)
  const [satelliteMetrics, setSatelliteMetrics] = useState(null)
  const [treeCrownDetection, setTreeCrownDetection] = useState(null)
  const [gediData, setGediData] = useState(null)
  const [sentinel2Timeseries, setSentinel2Timeseries] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  const handleAnalyze = useCallback(async (params) => {
    const { areaHa: areaHaParam, center: cen, bbox: requestBbox, dominantSpecies } = params || {}
    const lat = cen?.[0] ?? center?.[0] ?? DEFAULT_CENTER[0]
    const lng = cen?.[1] ?? center?.[1] ?? DEFAULT_CENTER[1]
    const ha = areaHaParam ?? circleAreaHa(radiusM)
    const radiusForSatellite = Math.sqrt(ha * 10000 / Math.PI)
    setAreaHa(ha)
    setAnalysisLoading(true)
    setSatelliteMetrics(null)
    setTreeCrownDetection(null)
    setGediData(null)
    setSentinel2Timeseries(null)
    const apiBase = import.meta.env.VITE_API_URL || ''
    try {
      let trees
      let detectionResult = null
      let gediResult = null
      let sentinel2Result = null
      if (requestBbox && requestBbox.length === 4) {
        const [gediResult_, sentinel2Result_] = await Promise.all([
          fetchGediForBbox(requestBbox, apiBase),
          fetchSentinel2Timeseries(requestBbox, apiBase),
        ])
        gediResult = gediResult_
        sentinel2Result = sentinel2Result_
        if (gediResult) setGediData(gediResult)
        if (sentinel2Result) setSentinel2Timeseries(sentinel2Result)
        const phenology = sentinel2Result && (sentinel2Result.october || sentinel2Result.may)
          ? {
              october_ndvi: sentinel2Result.october?.ndvi,
              may_ndvi: sentinel2Result.may?.ndvi,
            }
          : undefined
        detectionResult = await detectTrees(requestBbox, apiBase, {
          phenology,
          dominant_species: dominantSpecies,
        })
        if (detectionResult?.count > 0 && detectionResult.trees?.length) {
          trees = detectionsToTrees(detectionResult.trees)
          setTreeCrownDetection({
            count: detectionResult.count,
            source: 'DeepForest (RetinaNet)',
          })
        }
      }
      if (!trees?.length) {
        trees = syntheticInventoryForArea(ha, lat, lng)
      }
      const satelliteResult = await fetchSatelliteMetrics([lat, lng], radiusForSatellite)
      setSatelliteMetrics(satelliteResult)
      const result = runAnalysisWithRemoteData(trees, ha, gediResult, sentinel2Result)
      setAnalysisResult(result)
    } finally {
      setAnalysisLoading(false)
    }
  }, [center, radiusM])

  return (
    <div className="app">
      <header className="header">
        <h1>Biomass & Carbon Estimator</h1>
        <p className="tagline">Analyze trees and carbon potential for any property</p>
      </header>
      <div className="main">
        <MapView
          center={center}
          setCenter={setCenter}
          radiusM={radiusM}
          setRadiusM={setRadiusM}
          onAnalyze={handleAnalyze}
          analysisResult={analysisResult}
          analysisLoading={analysisLoading}
        />
        <ResultsPanel
          analysisResult={analysisResult}
          areaHa={areaHa}
          satelliteMetrics={satelliteMetrics}
          treeCrownDetection={treeCrownDetection}
          gediData={gediData}
          sentinel2Timeseries={sentinel2Timeseries}
          analysisLoading={analysisLoading}
        />
      </div>
    </div>
  )
}
