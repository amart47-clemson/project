/**
 * Biomass & carbon estimation using allometric equations.
 * Models: W = a * (D^2 * H)^b (diameter-height); carbon ≈ 0.47–0.50 × biomass.
 */

// Species-specific allometric parameters (a, b) for AGB = a * (D^2 * H)^b
// D = DBH (cm), H = height (m) -> biomass in kg. Sources: literature defaults.
export const SPECIES_PARAMS = {
  oak:        { name: 'Oak',         a: 0.032, b: 0.97, woodDensity: 0.72 },
  pine:       { name: 'Pine',        a: 0.028, b: 0.95, woodDensity: 0.52 },
  maple:      { name: 'Maple',       a: 0.031, b: 0.96, woodDensity: 0.63 },
  birch:      { name: 'Birch',       a: 0.029, b: 0.96, woodDensity: 0.65 },
  spruce:     { name: 'Spruce',      a: 0.027, b: 0.94, woodDensity: 0.45 },
  fir:        { name: 'Fir',         a: 0.026, b: 0.93, woodDensity: 0.42 },
  cedar:      { name: 'Cedar',       a: 0.025, b: 0.94, woodDensity: 0.38 },
  poplar:     { name: 'Poplar',      a: 0.035, b: 0.98, woodDensity: 0.42 },
  walnut:     { name: 'Walnut',      a: 0.033, b: 0.97, woodDensity: 0.61 },
  mixed:      { name: 'Mixed hardwood', a: 0.030, b: 0.96, woodDensity: 0.55 },
}

const CARBON_FRACTION = 0.47 // IPCC default: ~47% of dry biomass is carbon

/**
 * Above-ground biomass (kg) from DBH (cm) and height (m).
 * Uses W = a * (D^2 * H)^b with species params.
 */
export function biomassKg(speciesKey, dbhCm, heightM) {
  const sp = SPECIES_PARAMS[speciesKey] || SPECIES_PARAMS.mixed
  const D = Math.max(0.1, dbhCm)
  const H = Math.max(0.1, heightM)
  return sp.a * Math.pow(D * D * H, sp.b)
}

/**
 * Carbon (kg) from biomass (kg).
 */
export function carbonKg(biomassKg) {
  return biomassKg * CARBON_FRACTION
}

/**
 * CO2 equivalent (kg) from carbon (kg). 1 kg C ≈ 3.67 kg CO2.
 */
export function co2EqKg(carbonKg) {
  return carbonKg * 3.67
}

/**
 * Estimate tree height (m) from DBH (cm) using a simple form factor if height unknown.
 * H ≈ 2.5 + 0.3 * DBH (rough temperate forest relationship).
 */
export function estimateHeightFromDbh(dbhCm) {
  return 2.5 + 0.3 * dbhCm
}

/**
 * Analyze a single tree: biomass, carbon, CO2eq, materials (volume).
 */
export function analyzeTree({ speciesKey = 'mixed', dbhCm, heightM }) {
  const h = heightM != null ? heightM : estimateHeightFromDbh(dbhCm)
  const biomass = biomassKg(speciesKey, dbhCm, h)
  const carbon = carbonKg(biomass)
  const co2eq = co2EqKg(carbon)
  const sp = SPECIES_PARAMS[speciesKey] || SPECIES_PARAMS.mixed
  // Rough stem volume m³: (pi/4)*D^2*H * form_factor (0.5)
  const volumeM3 = (Math.PI / 4) * (dbhCm / 100) ** 2 * h * 0.5
  const woodDensity = sp.woodDensity
  const massKg = volumeM3 * woodDensity * 1000

  return {
    speciesKey,
    speciesName: sp.name,
    dbhCm,
    heightM: h,
    biomassKg: biomass,
    carbonKg: carbon,
    co2EqKg: co2eq,
    volumeM3,
    woodDensity,
    massKg,
  }
}

/**
 * Generate a synthetic inventory for a circular area (for demo/placeholder).
 * Real implementation would call satellite/forest inventory API.
 * areaHa = area in hectares; returns array of tree-like objects.
 */
export function syntheticInventoryForArea(areaHa, centerLat, centerLon) {
  const treesPerHa = 200 + Math.floor(areaHa * 2) // density scales slightly with area
  const count = Math.max(5, Math.floor(areaHa * treesPerHa))
  const speciesKeys = Object.keys(SPECIES_PARAMS).filter(k => k !== 'mixed')
  const trees = []
  const rng = seededRandom(centerLat * 1e5 + centerLon)

  for (let i = 0; i < count; i++) {
    const speciesKey = speciesKeys[Math.floor(rng() * speciesKeys.length)]
    const dbhCm = 8 + rng() * 60
    const heightM = 6 + rng() * 25
    trees.push({
      id: `tree-${i}`,
      speciesKey,
      dbhCm: Math.round(dbhCm * 10) / 10,
      heightM: Math.round(heightM * 10) / 10,
      lat: centerLat + (rng() - 0.5) * 0.01,
      lng: centerLon + (rng() - 0.5) * 0.01,
    })
  }

  return trees
}

function seededRandom(seed) {
  let s = seed
  return function () {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

/**
 * Run full analysis on a list of trees; returns summary + per-tree results.
 */
export function runAnalysis(trees) {
  const results = trees.map(t => analyzeTree(t))
  const totalBiomass = results.reduce((s, r) => s + r.biomassKg, 0)
  const totalCarbon = results.reduce((s, r) => s + r.carbonKg, 0)
  const totalCo2Eq = results.reduce((s, r) => s + r.co2EqKg, 0)
  const totalVolume = results.reduce((s, r) => s + r.volumeM3, 0)
  const bySpecies = {}
  results.forEach(r => {
    bySpecies[r.speciesName] = (bySpecies[r.speciesName] || 0) + 1
  })

  return {
    trees: results,
    summary: {
      treeCount: results.length,
      totalBiomassKg: totalBiomass,
      totalCarbonKg: totalCarbon,
      totalCo2EqKg: totalCo2Eq,
      totalVolumeM3: totalVolume,
      bySpecies,
    },
  }
}

const CARBON_FRACTION_FOR_REMOTE = 0.47
const CO2_EQ_FACTOR = 3.67

/**
 * Run analysis and blend with NASA GEDI and Sentinel-2 when available.
 * - GEDI: when mean_agbd_Mg_per_ha is present, use it for area biomass (Mg/ha → kg) and blend with tree-based.
 * - Sentinel-2: use mean NDVI (Oct/May) to scale biomass (phenology / vegetation density).
 */
export function runAnalysisWithRemoteData(trees, areaHa, gediData, sentinel2Timeseries) {
  const base = runAnalysis(trees)
  let totalBiomassKg = base.summary.totalBiomassKg
  const dataSources = []

  // NASA GEDI: area-based biomass (Mg/ha) → total kg
  if (gediData && !gediData.error && gediData.mean_agbd_Mg_per_ha != null && gediData.footprint_count > 0 && areaHa > 0) {
    const gediBiomassKg = areaHa * gediData.mean_agbd_Mg_per_ha * 1000 // Mg/ha → kg
    totalBiomassKg = 0.5 * totalBiomassKg + 0.5 * gediBiomassKg
    dataSources.push('GEDI (NASA ISS lidar)')
  }

  // Sentinel-2: mean NDVI from Oct/May to scale biomass (vegetation density / phenology)
  if (sentinel2Timeseries && !sentinel2Timeseries.error) {
    const oct = sentinel2Timeseries.october?.ndvi
    const may = sentinel2Timeseries.may?.ndvi
    const meanNdvi = (oct != null && may != null) ? (oct + may) / 2 : (oct ?? may)
    if (meanNdvi != null && meanNdvi >= 0) {
      const factor = Math.max(0.85, Math.min(1.15, 0.85 + 0.3 * meanNdvi))
      totalBiomassKg *= factor
      dataSources.push('Sentinel-2 (NDVI/EVI/SAVI)')
    }
  }

  const totalCarbonKg = totalBiomassKg * CARBON_FRACTION_FOR_REMOTE
  const totalCo2EqKg = totalCarbonKg * CO2_EQ_FACTOR

  return {
    trees: base.trees,
    summary: {
      treeCount: base.summary.treeCount,
      totalBiomassKg,
      totalCarbonKg,
      totalCo2EqKg,
      totalVolumeM3: base.summary.totalVolumeM3,
      bySpecies: base.summary.bySpecies,
      dataSources: dataSources.length ? dataSources : undefined,
    },
  }
}

/**
 * Area of circle in hectares (radius in meters).
 */
export function circleAreaHa(radiusM) {
  return (Math.PI * radiusM * radiusM) / 10000
}
