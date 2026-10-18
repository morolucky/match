// OpenStreetMap (Overpass) + Open-Meteo DEM import for the Algiers city mode.
// Units: 1 world unit = 1 metre. x = east, z = south (north is -z).
const EARTH_R = 6378137;
export const GRANDE_POSTE = { lat: 36.7765, lon: 3.0589 };
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const HW = 'motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|road|pedestrian';
const WIDTH_EST = { motorway: 15, motorway_link: 8, trunk: 12, trunk_link: 7, primary: 10, primary_link: 7, secondary: 8.5, secondary_link: 6.5, tertiary: 7, tertiary_link: 6, unclassified: 6, residential: 6, living_street: 4.5, service: 4.5, road: 6, pedestrian: 5 };

export const toWorld = (lat, lon, o) => {
  const p0 = o.lat * Math.PI / 180;
  return { x: EARTH_R * (lon - o.lon) * Math.PI / 180 * Math.cos(p0), z: EARTH_R * (o.lat - lat) * Math.PI / 180 };
};
export const toGeo = (x, z, o) => {
  const p0 = o.lat * Math.PI / 180;
  return { lat: o.lat - z / EARTH_R * 180 / Math.PI, lon: o.lon + x / (EARTH_R * Math.cos(p0)) * 180 / Math.PI };
};

function roadWidth(tags) {
  const raw = tags['width:carriageway'] || tags.width || '';
  const m = String(raw).trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(m)?$/i);
  if (m) { const v = +m[1]; if (v >= 1 && v <= 50) return v; }
  return WIDTH_EST[tags.highway] || 6;
}

const hash = (n) => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function levelsOf(tags, area, id) {
  const l = parseFloat(tags['building:levels']);
  if (Number.isFinite(l) && l > 0 && l < 40) return Math.round(l);
  const hm = parseFloat(tags.height); if (Number.isFinite(hm) && hm > 2) return Math.max(1, Math.round(hm / 3.1));
  if (/^(garage|shed|hut|kiosk)$/.test(tags.building || '')) return 1;
  // colonial centre heuristic: larger footprints carry more floors
  return area > 500 ? 5 + Math.floor(hash(id) * 2) : area > 150 ? 4 + Math.floor(hash(id) * 2) : 2 + Math.floor(hash(id) * 2);
}

const polyArea = (p) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + (a.x * b.z - b.x * a.z); }, 0) / 2);
const ensureCCW = (p) => (p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + (a.x * b.z - b.x * a.z); }, 0) > 0 ? p : p.slice().reverse());

export async function fetchOverpass(query, onStatus = () => {}) {
  let lastErr = null;
  for (const ep of ENDPOINTS) {
    try {
      onStatus('جارٍ طلب OpenStreetMap…');
      const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: 'data=' + encodeURIComponent(query) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (!j.elements) throw new Error('استجابة Overpass غير متوقعة');
      return j;
    } catch (e) { lastErr = e; }
  }
  throw new Error('فشل الاتصال بخوادم OSM: ' + (lastErr && lastErr.message || lastErr));
}

export function bboxQuery(south, west, north, east) {
  const bb = `(${south},${west},${north},${east})`;
  return `[out:json][timeout:50];(way["highway"~"^(${HW})$"]${bb};way["building"]${bb};relation["building"]${bb};);out body geom;`;
}

/** parse an Overpass payload into local-metre roads + building footprints */
export function parseOSM(data, origin) {
  const roads = [], buildings = [];
  const addBuilding = (geometry, tags, id) => {
    let pts = geometry.map((g) => toWorld(g.lat, g.lon, origin));
    if (pts.length > 1 && Math.hypot(pts[0].x - pts.at(-1).x, pts[0].z - pts.at(-1).z) < 0.5) pts = pts.slice(0, -1);
    if (pts.length < 3) return;
    const area = polyArea(pts); if (area < 12) return;
    const levels = levelsOf(tags || {}, area, id);
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
    buildings.push({ id, poly: ensureCCW(pts), levels, h: levels * 3.1 + 1.2, cx, cz, area, name: (tags && (tags['name:ar'] || tags.name)) || '', kind: (tags && tags.building) || 'yes' });
  };
  for (const e of data.elements) {
    if (e.type === 'way' && e.geometry && e.tags) {
      if (e.tags.highway) {
        const pts = e.geometry.map((g) => toWorld(g.lat, g.lon, origin));
        if (pts.length < 2) continue;
        let mx = 0, mz = 0; for (const p of pts) { mx += p.x; mz += p.z; }
        roads.push({ id: e.id, pts, width: roadWidth(e.tags), kind: e.tags.highway, name: e.tags['name:ar'] || e.tags.name || '', cx: mx / pts.length, cz: mz / pts.length });
      } else if (e.tags.building) addBuilding(e.geometry, e.tags, e.id);
    } else if (e.type === 'relation' && e.members && e.tags && e.tags.building) {
      for (const m of e.members) {
        if (m.role !== 'outer' || !m.geometry || m.geometry.length < 4) continue;
        const f = m.geometry[0], l = m.geometry.at(-1);
        if (Math.abs(f.lat - l.lat) < 1e-7 && Math.abs(f.lon - l.lon) < 1e-7) addBuilding(m.geometry, e.tags, e.id * 31 + (m.ref || 0));
      }
    }
  }
  return { roads, buildings };
}

export async function importCity(lat, lon, radius, onStatus = () => {}) {
  const origin = { lat, lon };
  const dy = radius / 111320, dx = radius / (111320 * Math.cos(lat * Math.PI / 180));
  const data = await fetchOverpass(bboxQuery((lat - dy).toFixed(6), (lon - dx).toFixed(6), (lat + dy).toFixed(6), (lon + dx).toFixed(6)), onStatus);
  const parsed = parseOSM(data, origin);
  if (!parsed.roads.length && !parsed.buildings.length) throw new Error('لا توجد بيانات في هذه المنطقة. جرّب نصف قطر أكبر.');
  return { origin, radius, ...parsed };
}

/** Copernicus GLO-90 elevation via Open-Meteo, sampled on a regular grid. Returns a bilinear sampler. */
export async function fetchElevation(origin, radius, onStatus = () => {}) {
  const n = Math.max(17, Math.min(41, Math.round(radius / 15) | 1));
  const step = 2 * radius / (n - 1), lats = [], lons = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const g = toGeo(-radius + j * step, -radius + i * step, origin);
    lats.push(g.lat.toFixed(5)); lons.push(g.lon.toFixed(5));
  }
  const h = new Float32Array(n * n);
  for (let k = 0; k < lats.length; k += 100) {
    onStatus(`جلب الارتفاعات… ${Math.round(k / lats.length * 100)}%`);
    const url = 'https://api.open-meteo.com/v1/elevation?latitude=' + lats.slice(k, k + 100).join(',') + '&longitude=' + lons.slice(k, k + 100).join(',');
    const r = await fetch(url); if (!r.ok) throw new Error('Elevation HTTP ' + r.status);
    const j = await r.json(); if (!Array.isArray(j.elevation)) throw new Error('بيانات ارتفاع ناقصة');
    j.elevation.forEach((v, q) => { h[k + q] = Number.isFinite(v) ? v : 0; });
  }
  let min = Infinity; for (const v of h) min = Math.min(min, v);
  for (let i = 0; i < h.length; i++) h[i] -= min; // ground the lowest point at y=0
  const at = (x, z) => {
    const fx = Math.min(n - 1.001, Math.max(0, (x + radius) / step)), fz = Math.min(n - 1.001, Math.max(0, (z + radius) / step));
    const j = fx | 0, i = fz | 0, u = fx - j, v = fz - i;
    return h[i * n + j] * (1 - u) * (1 - v) + h[i * n + j + 1] * u * (1 - v) + h[(i + 1) * n + j] * (1 - u) * v + h[(i + 1) * n + j + 1] * u * v;
  };
  return { n, step, h, at, min };
}
