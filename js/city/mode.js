// City mode: terrain + OSM roads and buildings around the Grande Poste, split into
// numbered sectors so any sector can be hidden, re-fetched and rebuilt on its own.
import * as THREE from 'three';
import { $, err } from '../core/dom.js';
import { cam, ll, oc } from '../scene/scene.js';
import { S } from '../core/state.js';
import { L } from '../lighting/layers.js';
import { bboxQuery, fetchOverpass, parseOSM, toGeo } from './osm.js';
import { MT } from '../studio/materials.js';
import { ensureMaterials, applyLook } from '../algiers/materials.js';
import { design } from '../algiers/design.js';
import { Ctx } from '../algiers/ctx.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addCityBuilding } from './building.js';
import { addCityRoad } from './road.js';

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

/* ---------- materials: the studio's shared MT set, fed by the PBR generator ---------- */
// wall/ground/trim/terr/pave/asph etc. are the exact materials applyPBR() writes its maps to,
// so the city automatically shares the designer's generated خامات.
let terrainMat = null;
function mats() {
  ensureMaterials(); applyLook(design.state); // same خامات + ألوان as the designer
  if (!terrainMat) terrainMat = new THREE.MeshStandardMaterial({ color: 0x8d8577, roughness: 0.97, metalness: 0 });
  return { terrain: terrainMat, proxy: MT.a_wall };
}

/** the Algiers Designer's current look, adapted for city-scale buildings: flat terrace roof
 *  (no mansard/dome, which assume a rectangular W×D footprint), no per-building fake street
 *  (OSM road geometry already covers that), and cheap roof trim — a balustrade places a lathed
 *  baluster every 0.27 m and a modillion cornice a console every 0.62 m along *every* main face;
 *  fine for one building, but summed over hundreds of long OSM perimeters it is the difference
 *  between a few thousand and several hundred thousand tiny geometries. */
function cityStyle() {
  const st = design.state;
  return { ...st, roof: 'terrace', dome: 'none', cornice: 'simple', parapet: 'iron', quoins: false, pilasters: false, zellige: false, life: { ...st.life, street: false, barriers: false } };
}

function mesh(pos, uv, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material); m.castShadow = m.receiveShadow = true;
  return m;
}

/* ---------- building/road generation: the real Algiers builder, fed by OSM footprints ---------- */
// Each building/road gets its own Ctx (fresh façade layout + seed), then its baked meshes are
// merged into one mesh per material for the whole sector — same draw-call budget as before.
function mergeInto(bucket, grp) {
  grp.updateMatrixWorld(true);
  for (const me of grp.children) { me.geometry.applyMatrix4(me.matrixWorld); (bucket[me.name] || (bucket[me.name] = [])).push(me.geometry); }
}

function buildSectorGeometry(sec, baseSt) {
  const bucket = {}; let tris = 0;
  for (const b of sec.buildings) {
    const base = Math.min(...b.poly.map((p) => demAt(p.x, p.z))) - 0.6;
    const ctx = new Ctx(baseSt, { path: { faces: [], L: 0 } });
    try { addCityBuilding(ctx, b.poly, b.levels, b.id, baseSt); } catch (e) { console.warn('city building', b.id, e); continue; }
    const grp = ctx.finish(); tris += ctx.tris;
    grp.position.y = base;
    mergeInto(bucket, grp);
  }
  for (const r of sec.roads) {
    const ctx = new Ctx(baseSt, { path: { faces: [], L: 0 } });
    try { addCityRoad(ctx, r.pts, r.width, demAt); } catch (e) { console.warn('city road', e); continue; }
    const grp = ctx.finish(); tris += ctx.tris;
    mergeInto(bucket, grp);
  }
  return { bucket, tris };
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
  mats();
  const baseSt = cityStyle();
  const { bucket, tris } = buildSectorGeometry(sec, baseSt);
  for (const [key, list] of Object.entries(bucket)) {
    if (!list.length || !MT[key]) continue;
    const geo = mergeGeometries(list, false);
    list.forEach((x) => x.dispose());
    if (!geo) continue;
    const me = new THREE.Mesh(geo, MT[key]);
    me.castShadow = !/^a_(pave|asph|mark|ceil)$/.test(key); me.receiveShadow = true; me.name = key;
    g.add(me);
  }
  g.userData.tris = tris;
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
  if (pos.length) g.add(mesh(pos, null, mats().proxy));
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
      return { cx: b.cx, cz: b.cz, w: x1 - x0, d: z1 - z0, angle: 0, style: 'haussmann', wall: L.WALL, roofLayer: L.ROOF, tint: [1, 1, 1] };
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
