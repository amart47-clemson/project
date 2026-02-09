function formatNum(n, decimals = 1) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'k'
  return Number(n).toFixed(decimals)
}

export default function ResultsPanel({ analysisResult, areaHa, satelliteMetrics, treeCrownDetection, gediData, sentinel2Timeseries, analysisLoading }) {
  if (!analysisResult && !analysisLoading) {
    return (
      <aside className="results-panel">
        <h2>Analysis results</h2>
        <p className="muted">Use the map with <strong>Satellite</strong> view, draw an area, and click &quot;Analyze area&quot;. With the backend running, tree crowns are detected via <strong>DeepForest (RetinaNet)</strong>.</p>
      </aside>
    )
  }

  if (analysisLoading) {
    return (
      <aside className="results-panel">
        <h2>Analysis results</h2>
        <p className="muted">Analyzing area… Tree crowns (DeepForest), GEDI (ISS lidar), Sentinel-2 time-series, satellite metrics, and biomass.</p>
      </aside>
    )
  }

  const { summary, trees } = analysisResult
  const { totalBiomassKg, totalCarbonKg, totalCo2EqKg, totalVolumeM3, treeCount, bySpecies, dataSources } = summary

  return (
    <aside className="results-panel">
      <h2>Analysis results</h2>
      {areaHa != null && (
        <p className="area-info">Area: <strong>{areaHa.toFixed(2)} ha</strong></p>
      )}
      {treeCrownDetection && (
        <section className="tree-crown-section">
          <h3>Tree crown detection</h3>
          <div className="card">
            <span className="card-label">{treeCrownDetection.source}</span>
            <span className="card-value">{treeCrownDetection.count} crowns</span>
          </div>
        </section>
      )}
      {gediData && (
        <section className="gedi-section">
          <h3>GEDI (ISS lidar)</h3>
          <p className="gedi-desc muted">NASA GEDI L4A: laser pulse measurements of height and biomass density.</p>
          {gediData.error ? (
            <p className="gedi-error muted">{gediData.error}</p>
          ) : (
            <div className="gedi-cards">
              {gediData.mean_agbd_Mg_per_ha != null && (
                <div className="card">
                  <span className="card-label">Mean AGBD</span>
                  <span className="card-value">{gediData.mean_agbd_Mg_per_ha} Mg/ha</span>
                </div>
              )}
              {gediData.footprint_count != null && gediData.footprint_count > 0 && (
                <div className="card">
                  <span className="card-label">Footprints</span>
                  <span className="card-value">{gediData.footprint_count}</span>
                </div>
              )}
              {gediData.mean_rh98_m != null && (
                <div className="card">
                  <span className="card-label">Mean RH98 (height)</span>
                  <span className="card-value">{gediData.mean_rh98_m} m</span>
                </div>
              )}
            </div>
          )}
        </section>
      )}
      {sentinel2Timeseries && (sentinel2Timeseries.october || sentinel2Timeseries.may || sentinel2Timeseries.error) && (
        <section className="sentinel2-timeseries-section">
          <h3>Time-Series Optical (Sentinel-2)</h3>
          <p className="sentinel2-desc muted">October &amp; May imagery: NDVI, EVI, SAVI for phenology (leaf-on/leaf-off).</p>
          {sentinel2Timeseries.error ? (
            <p className="sentinel2-error muted">{sentinel2Timeseries.error}</p>
          ) : (
            <div className="sentinel2-cards">
              {sentinel2Timeseries.october && (
                <div className="card sentinel2-month">
                  <span className="card-label">October</span>
                  <div className="indices">
                    <span>NDVI {sentinel2Timeseries.october.ndvi}</span>
                    <span>EVI {sentinel2Timeseries.october.evi}</span>
                    <span>SAVI {sentinel2Timeseries.october.savi}</span>
                  </div>
                </div>
              )}
              {sentinel2Timeseries.may && (
                <div className="card sentinel2-month">
                  <span className="card-label">May</span>
                  <div className="indices">
                    <span>NDVI {sentinel2Timeseries.may.ndvi}</span>
                    <span>EVI {sentinel2Timeseries.may.evi}</span>
                    <span>SAVI {sentinel2Timeseries.may.savi}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {sentinel2Timeseries.source && !sentinel2Timeseries.error && (
            <p className="satellite-source muted">{sentinel2Timeseries.source}</p>
          )}
        </section>
      )}
      {satelliteMetrics && (
        <section className="satellite-section">
          <h3>Satellite-derived</h3>
          <div className="satellite-cards">
            <div className="card">
              <span className="card-label">Mean NDVI</span>
              <span className="card-value">{satelliteMetrics.meanNdvi}</span>
            </div>
            <div className="card">
              <span className="card-label">Vegetation cover</span>
              <span className="card-value">{satelliteMetrics.vegetationCover}</span>
            </div>
          </div>
          <p className="satellite-source muted">{satelliteMetrics.source}</p>
        </section>
      )}
      <div className="summary-cards">
        <div className="card">
          <span className="card-label">Trees</span>
          <span className="card-value">{treeCount}</span>
        </div>
        <div className="card">
          <span className="card-label">Biomass</span>
          <span className="card-value">{formatNum(totalBiomassKg)} kg</span>
        </div>
        <div className="card">
          <span className="card-label">Carbon</span>
          <span className="card-value">{formatNum(totalCarbonKg)} kg</span>
        </div>
        <div className="card">
          <span className="card-label">CO₂ equivalent</span>
          <span className="card-value">{formatNum(totalCo2EqKg)} kg</span>
        </div>
        <div className="card">
          <span className="card-label">Volume (stem)</span>
          <span className="card-value">{totalVolumeM3.toFixed(2)} m³</span>
        </div>
      </div>
      {dataSources && dataSources.length > 0 && (
        <p className="blended-source muted">Totals blended with {dataSources.join(' + ')}.</p>
      )}
      <section className="species-breakdown">
        <h3>Species breakdown</h3>
        <ul>
          {Object.entries(bySpecies)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => (
              <li key={name}>
                <span className="species-name">{name}</span>
                <span className="species-count">{count} trees</span>
              </li>
            ))}
        </ul>
      </section>
      <section className="tree-table-section">
        <h3>Tree-level metrics</h3>
        <div className="table-wrap">
          <table className="tree-table">
            <thead>
              <tr>
                <th>Species</th>
                <th>DBH (cm)</th>
                <th>Height (m)</th>
                <th>Biomass (kg)</th>
                <th>Carbon (kg)</th>
                <th>Volume (m³)</th>
              </tr>
            </thead>
            <tbody>
              {trees.slice(0, 50).map((t, i) => (
                <tr key={t.speciesName + i}>
                  <td>{t.speciesName}</td>
                  <td>{t.dbhCm.toFixed(1)}</td>
                  <td>{t.heightM.toFixed(1)}</td>
                  <td>{t.biomassKg.toFixed(1)}</td>
                  <td>{t.carbonKg.toFixed(1)}</td>
                  <td>{t.volumeM3.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {trees.length > 50 && (
            <p className="muted">Showing first 50 of {trees.length} trees.</p>
          )}
        </div>
      </section>
    </aside>
  )
}
