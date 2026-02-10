import { useState } from 'react'

function formatNum(n, decimals = 1) {
  if (!isFinite(n)) return '0'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + 'k'
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
  const {
    totalBiomassKg,
    totalCarbonKg,
    totalCo2EqKg,
    totalVolumeM3,
    treeCount,
    bySpecies,
    dataSources,
    relativeUncertainty,
  } = summary

  // Unit conversions
  const KG_PER_SHORT_TON = 907.18474
  const CM_PER_INCH = 2.54
  const M_PER_FOOT = 0.3048

  const totalBiomassTons = totalBiomassKg / KG_PER_SHORT_TON
  const totalCarbonTons = totalCarbonKg / KG_PER_SHORT_TON
  const totalCo2Tons = totalCo2EqKg / KG_PER_SHORT_TON

  const [pricePerTon, setPricePerTon] = useState(25) // USD per ton CO2e (editable)
  const standValue = totalCo2Tons * pricePerTon

  const relUnc = typeof relativeUncertainty === 'number' ? relativeUncertainty : 0.3
  const biomassLow = totalBiomassTons * (1 - relUnc)
  const biomassHigh = totalBiomassTons * (1 + relUnc)
  const carbonLow = totalCarbonTons * (1 - relUnc)
  const carbonHigh = totalCarbonTons * (1 + relUnc)
  const co2Low = totalCo2Tons * (1 - relUnc)
  const co2High = totalCo2Tons * (1 + relUnc)

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
          {gediData.error && gediData.error !== 'No GEDI L4A granules found for this area and time range.' ? (
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
          <span className="card-value">{formatNum(totalBiomassTons)} tons</span>
        </div>
        <div className="card">
          <span className="card-label">Carbon</span>
          <span className="card-value">{formatNum(totalCarbonTons)} tons</span>
        </div>
        <div className="card">
          <span className="card-label">CO₂ equivalent</span>
          <span className="card-value">{formatNum(totalCo2Tons)} tons</span>
        </div>
        <div className="card">
          <span className="card-label">Volume (stem)</span>
          <span className="card-value">{totalVolumeM3.toFixed(2)} m³</span>
        </div>
      </div>
      {dataSources && dataSources.length > 0 && (
        <p className="blended-source muted">Totals blended with {dataSources.join(' + ')}.</p>
      )}
      <section className="uncertainty-section">
        <h3>Uncertainty (approx. 95% confidence)</h3>
        <p className="uncertainty-desc muted">
          Range reflects data sources used (DeepForest crowns, GEDI, Sentinel‑2). Narrower ranges mean higher confidence.
        </p>
        <ul className="uncertainty-list">
          <li>
            Biomass: <strong>{biomassLow.toFixed(0)}–{biomassHigh.toFixed(0)} tons</strong>
          </li>
          <li>
            Carbon: <strong>{carbonLow.toFixed(0)}–{carbonHigh.toFixed(0)} tons</strong>
          </li>
          <li>
            CO₂eq: <strong>{co2Low.toFixed(0)}–{co2High.toFixed(0)} tons CO₂e</strong>
          </li>
        </ul>
      </section>
      <section className="valuation-section">
        <h3>Carbon credit valuation</h3>
        <p className="valuation-desc muted">
          Uses total CO₂ equivalent and an assumed price per ton. Adjust the price to match local carbon credit markets.
        </p>
        <div className="valuation-cards">
          <div className="card">
            <span className="card-label">Total CO₂eq</span>
            <span className="card-value">{totalCo2Tons.toFixed(1)} tons CO₂e</span>
          </div>
          <div className="card valuation-input-card">
            <span className="card-label">Price per ton CO₂e (USD)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={pricePerTon}
              onChange={e => setPricePerTon(Number(e.target.value) || 0)}
              className="valuation-input"
            />
          </div>
          <div className="card">
            <span className="card-label">Estimated stand value</span>
            <span className="card-value">${formatNum(standValue, 0)}</span>
          </div>
        </div>
      </section>
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
                <th>DBH (in)</th>
                <th>Height (ft)</th>
                <th>Biomass (tons)</th>
                <th>Carbon (tons)</th>
                <th>Volume (m³)</th>
              </tr>
            </thead>
            <tbody>
              {trees.slice(0, 50).map((t, i) => (
                <tr key={t.speciesName + i}>
                  <td>{t.speciesName}</td>
                  <td>{(t.dbhCm / CM_PER_INCH).toFixed(1)}</td>
                  <td>{(t.heightM / M_PER_FOOT).toFixed(1)}</td>
                  <td>{(t.biomassKg / KG_PER_SHORT_TON).toFixed(3)}</td>
                  <td>{(t.carbonKg / KG_PER_SHORT_TON).toFixed(3)}</td>
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
