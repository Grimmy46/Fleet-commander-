// ═══════════════════════════════════════════════════════════════
//  GEO — Strait of Hormuz geography & projection
//  All coordinates are real lat/lon, projected to nautical miles.
// ═══════════════════════════════════════════════════════════════

// ── SWAPPABLE REGION ──────────────────────────────────────────
// Each mission loads its own operating area.
let GEO_ORIGIN = { lat: 25.95, lon: 55.60 };
let GEO_SPAN_LAT = 1.45;
const NM_PER_DEG_LAT = 60.0;
let NM_PER_DEG_LON = 60.0 * Math.cos(GEO_ORIGIN.lat * Math.PI / 180);

// lat/lon -> nautical mile grid (x east, y south)
function ll2nm(lat, lon) {
  return {
    x: (lon - GEO_ORIGIN.lon) * NM_PER_DEG_LON,
    y: (GEO_ORIGIN.lat + GEO_SPAN_LAT - lat) * NM_PER_DEG_LAT
  };
}
function nm2ll(x, y) {
  return {
    lon: GEO_ORIGIN.lon + x / NM_PER_DEG_LON,
    lat: GEO_ORIGIN.lat + GEO_SPAN_LAT - y / NM_PER_DEG_LAT
  };
}

// Operating area bounds in nm
let MAP_W = (56.95 - 55.60) * NM_PER_DEG_LON;
let MAP_H = 1.45 * NM_PER_DEG_LAT;

// ── LANDMASSES ────────────────────────────────────────────────
// Traced from real coastline shapes. [lat, lon] pairs.

const LANDMASSES = [
  {
    name: 'MUSANDAM PENINSULA',
    country: 'OMAN',
    peaks: [[26.28,56.34],[26.20,56.20],[26.36,56.45]],
    coords: [
      [26.49,56.52],[26.47,56.58],[26.43,56.60],[26.39,56.56],
      [26.35,56.58],[26.30,56.54],[26.24,56.56],[26.18,56.51],
      [26.14,56.52],[26.10,56.47],[26.05,56.48],[25.99,56.43],
      [25.95,56.45],[25.95,55.95],[26.02,56.02],[26.06,56.00],
      [26.09,56.05],[26.13,56.03],[26.15,56.09],[26.19,56.11],
      [26.17,56.17],[26.21,56.19],[26.20,56.24],[26.24,56.26],
      [26.23,56.31],[26.27,56.30],[26.29,56.36],[26.33,56.35],
      [26.34,56.41],[26.37,56.43],[26.36,56.47]
    ]
  },
  {
    name: 'IRANIAN COAST',
    country: 'IRAN',
    peaks: [[27.28,56.10],[27.32,56.55]],
    coords: [
      [27.40,55.60],[27.40,56.95],[27.24,56.92],[27.20,56.86],
      [27.14,56.88],[27.10,56.82],[27.13,56.74],[27.09,56.68],
      [27.12,56.60],[27.16,56.55],[27.14,56.47],[27.18,56.40],
      [27.16,56.33],[27.20,56.28],[27.17,56.20],[27.21,56.13],
      [27.18,56.05],[27.22,55.97],[27.19,55.88],[27.24,55.80],
      [27.21,55.71],[27.26,55.64]
    ]
  },
  {
    name: 'QESHM ISLAND',
    country: 'IRAN',
    peaks: [[26.82,55.85]],
    coords: [
      [26.98,56.28],[26.94,56.26],[26.90,56.20],[26.88,56.12],
      [26.84,56.05],[26.80,55.96],[26.76,55.88],[26.72,55.80],
      [26.68,55.72],[26.66,55.64],[26.70,55.60],[26.78,55.62],
      [26.84,55.68],[26.88,55.74],[26.92,55.82],[26.96,55.90],
      [27.00,55.98],[27.03,56.06],[27.05,56.14],[27.04,56.22],
      [27.01,56.27]
    ]
  },
  {
    name: 'HORMUZ ISLAND',
    country: 'IRAN',
    coords: [
      [27.09,56.44],[27.07,56.49],[27.03,56.50],[27.00,56.47],
      [27.00,56.42],[27.03,56.39],[27.07,56.40]
    ]
  },
  {
    name: 'LARAK ISLAND',
    country: 'IRAN',
    coords: [
      [26.89,56.36],[26.87,56.40],[26.83,56.40],[26.81,56.36],
      [26.83,56.32],[26.87,56.32]
    ]
  },
  {
    name: 'HENGAM ISLAND',
    country: 'IRAN',
    coords: [
      [26.68,55.90],[26.66,55.94],[26.62,55.93],[26.61,55.88],
      [26.64,55.85],[26.67,55.86]
    ]
  },
  {
    name: 'GREAT TUNB',
    country: 'DISPUTED',
    coords: [
      [26.27,55.31],[26.25,55.33],[26.23,55.31],[26.25,55.29]
    ]
  }
];

// Pre-project all landmasses to nm coordinates
let LAND_NM = LANDMASSES.map(L => ({
  name: L.name,
  country: L.country,
  pts: L.coords.map(([la, lo]) => ll2nm(la, lo)),
  peaks: (L.peaks || []).map(([la, lo]) => ll2nm(la, lo)),
  label: ll2nm(
    L.coords.reduce((s, c) => s + c[0], 0) / L.coords.length,
    L.coords.reduce((s, c) => s + c[1], 0) / L.coords.length
  )
}));

// ── TRAFFIC SEPARATION SCHEME ─────────────────────────────────
// The real TSS through Hormuz: inbound and outbound lanes with
// a 2nm separation zone between them.
const TSS = {
  inbound:  [[26.55,56.75],[26.62,56.58],[26.70,56.42],[26.62,56.22],[26.55,56.05]],
  outbound: [[26.44,56.72],[26.51,56.56],[26.58,56.38],[26.50,56.18],[26.43,56.01]],
  laneWidth: 2.0 // nm
};
let TSS_NM = {
  inbound:  TSS.inbound.map(([la,lo]) => ll2nm(la,lo)),
  outbound: TSS.outbound.map(([la,lo]) => ll2nm(la,lo)),
  laneWidth: TSS.laneWidth
};

// ── REGION LOADER ─────────────────────────────────────────────
// Swaps the whole operating area. Called when a mission starts.
function loadRegion(R) {
  GEO_ORIGIN = { lat: R.originLat, lon: R.originLon };
  GEO_SPAN_LAT = R.spanLat;
  NM_PER_DEG_LON = 60.0 * Math.cos(GEO_ORIGIN.lat * Math.PI / 180);
  MAP_W = R.spanLon * NM_PER_DEG_LON;
  MAP_H = R.spanLat * NM_PER_DEG_LAT;

  LAND_NM = (R.land || []).map(L => ({
    name: L.name,
    country: L.country,
    pts: L.coords.map(([la, lo]) => ll2nm(la, lo)),
    peaks: (L.peaks || []).map(([la, lo]) => ll2nm(la, lo)),
    label: ll2nm(
      L.coords.reduce((s, c) => s + c[0], 0) / L.coords.length,
      L.coords.reduce((s, c) => s + c[1], 0) / L.coords.length
    )
  }));

  if (R.tss) {
    TSS_NM = {
      inbound:  R.tss.inbound.map(([la,lo]) => ll2nm(la,lo)),
      outbound: R.tss.outbound.map(([la,lo]) => ll2nm(la,lo)),
      laneWidth: R.tss.laneWidth || 2.0
    };
  } else {
    TSS_NM = { inbound: [], outbound: [], laneWidth: 0 };
  }

  // Force the cached bathymetry to rebuild for the new region
  if (typeof bathyCanvas !== 'undefined') bathyCanvas = null;
  return R;
}

// ── BATHYMETRY ────────────────────────────────────────────────
// Simplified depth model. Real strait is 60-80m in the channel,
// shallow (<20m) near coasts.
let DEPTH_MAX = 80;
function depthAt(x, y) {
  if (!LAND_NM.length) {
    // Open ocean — gentle variation so it is not a flat plate
    return DEPTH_MAX * (0.72 + 0.28 * Math.sin(x * 0.06) * Math.cos(y * 0.05));
  }
  let minDist = 1e9;
  for (const L of LAND_NM) {
    for (const p of L.pts) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist) minDist = d;
    }
  }
  return Math.min(DEPTH_MAX, minDist * 7.5);
}

function isLand(x, y) {
  for (const L of LAND_NM) {
    if (pointInPoly(x, y, L.pts)) return true;
  }
  return false;
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// Format lat/lon for display
function fmtLatLon(x, y) {
  const { lat, lon } = nm2ll(x, y);
  const latD = Math.floor(Math.abs(lat));
  const latM = ((Math.abs(lat) - latD) * 60).toFixed(1);
  const lonD = Math.floor(Math.abs(lon));
  const lonM = ((Math.abs(lon) - lonD) * 60).toFixed(1);
  return `${latD}°${latM}'${lat >= 0 ? 'N' : 'S'}  ${lonD}°${lonM}'${lon >= 0 ? 'E' : 'W'}`;
}

// Headless test export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ll2nm, nm2ll, get MAP_W(){return MAP_W}, get MAP_H(){return MAP_H},
                     get LAND_NM(){return LAND_NM}, get TSS_NM(){return TSS_NM},
                     depthAt, isLand, fmtLatLon, get GEO_ORIGIN(){return GEO_ORIGIN},
                     loadRegion, LANDMASSES, TSS };
}
