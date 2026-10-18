// City mode: terrain + OSM roads and buildings around the Grande Poste, split into
// numbered sectors so any sector can be hidden, re-fetched and rebuilt on its own.
import * as THREE from 'three';
import { $, err } from '../core/dom.js';
import { cam, ll, oc } from '../scene/scene.js';
import { S } from '../core/state.js';
import { bboxQuery, fetchOverpass, parseOSM, toGeo } from './osm.js';

export const CITY = {
  data: null,            // { origin, radius, roads, buildings }
  dem: null,             // elevation sampler or null (flat)
  cell: 120,             // sector size (m)
  cols: 0, rows: 0,
  sectors: new Map(),    // id -> { id, cx, cz, buildings, roads, group, proxy, label, hidden }
  flags: { gi: false, dlssAuto: false, lod: false, labels: true },
  onSectors: () => {},   // panel hook
};

const demAt = (x, z) => (CITY.dem ? CITY.dem.at(x, z) : 0);
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/* ---------- shared materials ---------- */
let MATS = null;
function facadeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#ece5d8'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${150 + Math.random() * 40 | 0},${140 + Math.random() * 40 | 0},${125 + Math.random() * 40 | 0},0.06)`; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); }
  g.fillStyle = '#d9d0bf'; g.fillRect(0, 0, 256, 10);          // cornice band (top of each floor)
  g.fillStyle = 'rgba(90,80,65,.25)'; g.fillRect(0, 10, 256, 3);
  // window reveal + frame
  g.fillStyle = 'rgba(70,62,50,.28)'; g.fillRect(66, 52, 124, 174);
  g.fillStyle = '#e3dccb'; g.fillRect(72, 58, 112, 164);
  g.fillStyle = '#28313b'; g.fillRect(80, 66, 96, 148);
  g.strokeStyle = 'rgba(210,225,240,.35)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(86, 200); g.lineTo(130, 80); g.stroke();
  g.fillStyle = '#e3dccb'; g.fillRect(124, 66, 8, 148); g.fillRect(80, 134, 96, 8);
  // shutters
  g.fillStyle = '#9fb3bd'; g.fillRect(52, 62, 16, 152); g.fillRect(188, 62, 16, 152);
  g.strokeStyle = 'rgba(40,50,60,.4)'; g.lineWidth = 1;
  for (let y = 68; y < 210; y += 7) { g.beginPath(); g.moveTo(53, y); g.lineTo(67, y); g.moveTo(189, y); g.lineTo(203, y); g.stroke(); }
  // wrought-iron balcony rail
  g.strokeStyle = '#1d1f22'; g.lineWidth = 3; g.strokeRect(58, 196, 140, 56);
  g.lineWidth = 2; for (let x = 66; x < 196; x += 11) { g.beginPath(); g.moveTo(x, 198); g.lineTo(x, 250); g.stroke(); }
  g.beginPath(); g.moveTo(58, 224); g.lineTo(198, 224); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function mats() {
  if (MATS) return MATS;
  MATS = {
    wall: new THREE.MeshStandardMaterial({ map: facadeTexture(), vertexColors: true, roughness: 0.82, metalness: 0 }),
    roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
    asphalt: new THREE.MeshStandardMaterial({ color: 0x33343a, roughness: 0.96, metalness: 0 }),
    pave: new THREE.MeshStandardMaterial({ color: 0x9b9489, roughness: 0.92, metalness: 0 }),
    terrain: new THREE.MeshStandardMaterial({ color: 0x8d8577, roughness: 0.97, metalness: 0 }),
    proxy: new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.9, metalness: 0 }),
  };
  return MATS;
}

/* ---------- geometry accumulators ---------- */
function mesh(pos, uv, col, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (col) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material); m.castShadow = m.receiveShadow = true;
  return m;
}

function buildingGeo(b, wallA, roofA) {
  const base = Math.min(...b.poly.map((p) => demAt(p.x, p.z))) - 0.6, top = base + 0.6 + b.h;
  const tint = 0.9 + hash(b.id) * 0.13, t2 = tint * (0.97 + hash(b.id + 7) * 0.05);
  for (let i = 0; i < b.poly.length; i++) {
    const p1 = b.poly[i], p2 = b.poly[(i + 1) % b.poly.length];
    const len = Math.hypot(p2.x - p1.x, p2.z - p1.z); if (len < 0.3) continue;
    const u1 = 0, u2 = Math.max(1, Math.round(len / 3)), v2 = b.levels;
    const quad = [p1.x, base, p1.z, p2.x, base, p2.z, p2.x, top, p2.z, p1.x, base, p1.z, p2.x, top, p2.z, p1.x, top, p1.z];
    wallA.pos.push(...quad);
    wallA.uv.push(u1, 0, u2, 0, u2, v2, u1, 0, u2, v2, u1, v2);
    for (let k = 0; k < 6; k++) wallA.col.push(tint, tint, t2);
  }
  const tris = THREE.ShapeUtils.triangulateShape(b.poly.map((p) => new THREE.Vector2(p.x, p.z)), []);
  const rc = hash(b.id + 3) < 0.45 ? [0.55, 0.33, 0.24] : [0.62, 0.6, 0.56]; // tiled vs flat concrete
  for (const [a, bb, c] of tris) {
    for (const idx of [a, c, bb]) { const p = b.poly[idx]; roofA.pos.push(p.x, top, p.z); roofA.col.push(...rc); }
  }
}

function roadGeo(r, asA, pvA) {
  const strip = (half, lift, out) => {
    const row = [];
    for (let i = 0; i < r.pts.length; i++) {
      const a = r.pts[Math.max(0, i - 1)], b = r.pts[Math.min(r.pts.length - 1, i + 1)], p = r.pts[i];
      let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const nx = dz, nz = -dx, y = demAt(p.x, p.z) + lift;
      row.push([p.x + nx * half, y, p.z + nz * half, p.x - nx * half, y, p.z - nz * half]);
    }
    for (let i = 0; i < row.length - 1; i++) {
      const [ax, ay, az, bx, by, bz] = row[i], [cx2, cy, cz2, dx2, dy2, dz2] = row[i + 1];
      out.pos.push(ax, ay, az, bx, by, bz, dx2, dy2, dz2, ax, ay, az, dx2, dy2, dz2, cx2, cy, cz2);
    }
  };
  strip(r.width / 2 + 2.2, 0.07, pvA);   // sidewalk/curb apron
  strip(r.width / 2, 0.14, asA);         // carriageway
}

function labelSprite(num, x, y, z) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fillStyle = 'rgba(11,61,145,.88)'; g.fill();
  g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 56px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.position.set(x, y, z); s.scale.set(18, 18, 1); s.renderOrder = 10;
  return s;
}

/* ---------- sectors ---------- */
const sectorOf = (x, z) => {
  const R = CITY.data.radius, c = CITY.cell;
  const sx = Math.min(CITY.cols - 1, Math.max(0, Math.floor((x + R) / c)));
  const sz = Math.min(CITY.rows - 1, Math.max(0, Math.floor((z + R) / c)));
  return sz * CITY.cols + sx + 1;
};

function assignSectors() {
  const R = CITY.data.radius;
  CITY.cols = CITY.rows = Math.max(1, Math.ceil(2 * R / CITY.cell));
  CITY.sectors.clear();
  const get = (id) => {
    if (!CITY.sectors.has(id)) {
      const col = (id - 1) % CITY.cols, row = ((id - 1) / CITY.cols) | 0;
      CITY.sectors.set(id, { id, cx: -R + (col + 0.5) * CITY.cell, cz: -R + (row + 0.5) * CITY.cell, buildings: [], roads: [], group: null, proxy: null, hidden: false });
    }
    return CITY.sectors.get(id);
  };
  for (const b of CITY.data.buildings) get(sectorOf(b.cx, b.cz)).buildings.push(b);
  for (const r of CITY.data.roads) get(sectorOf(r.cx, r.cz)).roads.push(r);
}

function buildSectorGroup(sec) {
  const g = new THREE.Group(); g.name = 'sector-' + sec.id;
  const wallA = { pos: [], uv: [], col: [] }, roofA = { pos: [], col: [] }, asA = { pos: [] }, pvA = { pos: [] };
  for (const b of sec.buildings) buildingGeo(b, wallA, roofA);
  for (const r of sec.roads) roadGeo(r, asA, pvA);
  const M = mats();
  if (wallA.pos.length) g.add(mesh(wallA.pos, wallA.uv, wallA.col, M.wall));
  if (roofA.pos.length) g.add(mesh(roofA.pos, null, roofA.col, M.roof));
  if (pvA.pos.length) g.add(mesh(pvA.pos, null, null, M.pave));
  if (asA.pos.length) g.add(mesh(asA.pos, null, null, M.asphalt));
  const peak = sec.buildings.reduce((m, b) => Math.max(m, demAt(b.cx, b.cz) + b.h), demAt(sec.cx, sec.cz) + 6);
  sec.label = labelSprite(sec.id, sec.cx, peak + 16, sec.cz);
  sec.label.visible = CITY.flags.labels;
  g.add(sec.label);
  g.visible = !sec.hidden;
  return g;
}

function buildProxy(sec) {
  const pos = [], boxed = (b) => {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of b.poly) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    const y0 = demAt(b.cx, b.cz) - 0.5, y1 = y0 + b.h + 0.5;
    const q = (a, b2, c, d) => pos.push(...a, ...b2, ...c, ...a, ...c, ...d);
    const v = (x, y, z) => [x, y, z];
    q(v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0)); q(v(x1, y0, z1), v(x0, y0, z1), v(x0, y1, z1), v(x1, y1, z1));
    q(v(x1, y0, z0), v(x1, y0, z1), v(x1, y1, z1), v(x1, y1, z0)); q(v(x0, y0, z1), v(x0, y0, z0), v(x0, y1, z0), v(x0, y1, z1));
    q(v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1));
  };
  for (const b of sec.buildings) boxed(b);
  const g = new THREE.Group();
  if (pos.length) g.add(mesh(pos, null, null, mats().proxy));
  g.visible = false;
  return g;
}

function terrainMesh() {
  const R = CITY.data.radius, n = CITY.dem ? CITY.dem.n : 2;
  const geo = new THREE.PlaneGeometry(2 * R + 60, 2 * R + 60, n * 2, n * 2);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, demAt(p.getX(i), p.getZ(i)) - 0.05);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mats().terrain); m.receiveShadow = true;
  return m;
}

/* ---------- lighting (Lumina/DLSS off by default; manual toggles) ---------- */
export function cityRelight() {
  if (!CITY.data) return;
  const R = CITY.data.radius + 40;
  let maxH = 20; for (const b of CITY.data.buildings) maxH = Math.max(maxH, demAt(b.cx, b.cz) + b.h);
  ll.setBounds(new THREE.Box3(new THREE.Vector3(-R, -2, -R), new THREE.Vector3(R, maxH + 12, R)));
  ll.params.lumina = !!CITY.flags.gi;
  if ($('gi')) $('gi').checked = !!CITY.flags.gi;
  if (CITY.flags.gi) {
    const bigs = CITY.data.buildings.slice().sort((a, b) => b.area - a.area).slice(0, 120).map((b) => {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const p of b.poly) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
      return { cx: b.cx, cz: b.cz, w: x1 - x0, d: z1 - z0, angle: 0, style: 'haussmann', tint: [1, 1, 1] };
    });
    const sq = [[-R, -R], [R, -R], [R, R], [-R, R]];
    ll.lumina.setCity({ blocks: [{ curb: sq, lot: sq, lawn: false }], buildings: bigs });
  }
  ll.patch(ll.level); ll.setFocus(oc.target);
  try { ll.rebuild(); } catch (e) {
    ll.params.lumina = false; ll.lumina.ready = false; CITY.flags.gi = false;
    if ($('gi')) $('gi').checked = false;
    err('⚠ تعذّر تشغيل Lumina GI على مشهد المدينة: ' + (e && e.message || e));
  }
  ll.taa.reset(); ll.resetExposure();
}

let framedCity = false;
export function buildCityScene() {
  clearCity();
  if (!CITY.data) { $('st').textContent = 'وضع المدينة: استورد البيانات من تبويب «المدينة» (OSM + تضاريس).'; return; }
  const t0 = performance.now();
  S.CG = new THREE.Group(); S.CG.name = 'city';
  S.CG.add(terrainMesh());
  let tris = 0;
  for (const sec of [...CITY.sectors.values()].sort((a, b) => a.id - b.id)) {
    sec.group = buildSectorGroup(sec);
    sec.proxy = null; // rebuilt lazily when LOD is switched on
    S.CG.add(sec.group);
    sec.group.traverse((o) => { if (o.isMesh) tris += o.geometry.attributes.position.count / 3; });
  }
  ll.level.add(S.CG);
  cityRelight();
  if (!framedCity) {
    framedCity = true;
    const R = CITY.data.radius;
    oc.target.set(0, demAt(0, 0) + 10, 0);
    cam.position.set(R * 0.75, R * 0.7 + 60, R * 0.8);
    oc.update(); ll.taa.reset();
  }
  $('st').textContent = `مدينة الجزائر · ${CITY.data.buildings.length} مبنى · ${CITY.data.roads.length} طريق · ${CITY.sectors.size} قطاع مرقّم · ${Math.round(tris / 1000)}k مثلث · بناء ${Math.round(performance.now() - t0)} ms`;
  CITY.onSectors();
}

export function clearCity() {
  if (!S.CG) return;
  ll.level.remove(S.CG);
  S.CG.traverse((o) => { if (o.isMesh) o.geometry.dispose(); if (o.isSprite) { o.material.map.dispose(); o.material.dispose(); } });
  S.CG = null;
  for (const sec of CITY.sectors.values()) { sec.group = null; sec.proxy = null; sec.label = null; }
}

/* ---------- per-sector operations (numbered correction workflow) ---------- */
export function rebuildSector(id) {
  const sec = CITY.sectors.get(id); if (!sec || !S.CG) return;
  if (sec.group) { S.CG.remove(sec.group); sec.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); }
  if (sec.proxy) { S.CG.remove(sec.proxy); sec.proxy.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); sec.proxy = null; }
  sec.group = buildSectorGroup(sec);
  S.CG.add(sec.group);
  ll.taa.reset();
}

export function setSectorHidden(id, hidden) {
  const sec = CITY.sectors.get(id); if (!sec) return;
  sec.hidden = hidden;
  if (sec.group) sec.group.visible = !hidden;
  if (sec.proxy) sec.proxy.visible = false;
  ll.taa.reset();
}

export function flyToSector(id) {
  const sec = CITY.sectors.get(id); if (!sec) return;
  const y = demAt(sec.cx, sec.cz);
  oc.target.set(sec.cx, y + 12, sec.cz);
  cam.position.set(sec.cx + 110, y + 95, sec.cz + 110);
  oc.update(); ll.taa.reset();
}

/** re-download this sector's cell from OSM and rebuild only it */
export async function refetchSector(id, onStatus = () => {}) {
  const sec = CITY.sectors.get(id); if (!sec || !CITY.data) return;
  const { origin } = CITY.data, half = CITY.cell / 2 + 25;
  const a = toGeo(sec.cx - half, sec.cz + half, origin), b = toGeo(sec.cx + half, sec.cz - half, origin);
  onStatus(`قطاع ${id}: جلب تصحيح من OSM…`);
  const data = await fetchOverpass(bboxQuery(a.lat.toFixed(6), a.lon.toFixed(6), b.lat.toFixed(6), b.lon.toFixed(6)));
  const parsed = parseOSM(data, origin);
  const mine = (o) => sectorOf(o.cx, o.cz) === id;
  CITY.data.buildings = CITY.data.buildings.filter((o) => !mine(o)).concat(parsed.buildings.filter(mine));
  CITY.data.roads = CITY.data.roads.filter((o) => !mine(o)).concat(parsed.roads.filter(mine));
  sec.buildings = parsed.buildings.filter(mine);
  sec.roads = parsed.roads.filter(mine);
  rebuildSector(id);
  onStatus(`قطاع ${id}: تم التصحيح (${sec.buildings.length} مبنى / ${sec.roads.length} طريق).`);
}

export function setLabelsVisible(on) {
  CITY.flags.labels = on;
  for (const sec of CITY.sectors.values()) if (sec.label) sec.label.visible = on;
}

/* ---------- manual LOD (off by default) ---------- */
const LOD_DIST = 320;
let lodTimer = 0;
export function setLOD(on) {
  CITY.flags.lod = on;
  clearInterval(lodTimer); lodTimer = 0;
  if (!on) {
    for (const sec of CITY.sectors.values()) { if (sec.group) sec.group.visible = !sec.hidden; if (sec.proxy) sec.proxy.visible = false; }
    return;
  }
  lodTimer = setInterval(() => {
    if (S.mode !== 'city' || !S.CG) return;
    for (const sec of CITY.sectors.values()) {
      if (!sec.group || sec.hidden) continue;
      if (!sec.proxy) { sec.proxy = buildProxy(sec); S.CG.add(sec.proxy); }
      const far = Math.hypot(cam.position.x - sec.cx, cam.position.z - sec.cz) > LOD_DIST;
      if (sec.group.visible === far) { sec.group.visible = !far; sec.proxy.visible = far; ll.taa.reset(); }
    }
  }, 350);
}

export function applyCityData(data, dem) {
  CITY.data = data; CITY.dem = dem; framedCity = false;
  assignSectors();
}
