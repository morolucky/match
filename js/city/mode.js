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

/* ---------- materials: the studio's shared MT set, fed by the PBR generator ---------- */
// wall/ground/trim/terr/pave/asph etc. are the exact materials applyPBR() writes its maps to,
// so the city automatically shares the designer's generated خامات.
let terrainMat = null;
function mats() {
  ensureMaterials(); applyLook(design.state); // same خامات + ألوان as the designer
  if (!terrainMat) terrainMat = new THREE.MeshStandardMaterial({ color: 0x8d8577, roughness: 0.97, metalness: 0 });
  return { terrain: terrainMat, proxy: MT.a_wall };
}

/* ---------- geometry accumulators ---------- */
function mesh(pos, uv, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv && uv.length ? uv : worldUVFor(pos), 2));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material); m.castShadow = m.receiveShadow = true;
  return m;
}
// triplanar world-space UVs (metres) — same convention as the designer's worldUV()
function worldUVFor(pos) {
  const uv = new Float32Array(pos.length / 3 * 2);
  for (let t = 0; t < pos.length; t += 9) {
    const ax = [pos[t], pos[t + 1], pos[t + 2]], bx = [pos[t + 3], pos[t + 4], pos[t + 5]], cx = [pos[t + 6], pos[t + 7], pos[t + 8]];
    const ux = bx[0] - ax[0], uy = bx[1] - ax[1], uz = bx[2] - ax[2], vx = cx[0] - ax[0], vy = cx[1] - ax[1], vz = cx[2] - ax[2];
    const nx = Math.abs(uy * vz - uz * vy), ny = Math.abs(uz * vx - ux * vz), nz = Math.abs(ux * vy - uy * vx);
    for (let k = 0; k < 3; k++) {
      const p = [pos[t + k * 3], pos[t + k * 3 + 1], pos[t + k * 3 + 2]], o = (t / 3 + k) * 2;
      if (nx > ny && nx > nz) { uv[o] = p[2]; uv[o + 1] = p[1]; } else if (ny > nz) { uv[o] = p[0]; uv[o + 1] = p[2]; } else { uv[o] = p[0]; uv[o + 1] = p[1]; }
    }
  }
  return uv;
}

/* ---------- facade builder (windows, shutters, iron balconies, shops, cornices) ---------- */
const FLOOR_H = 3.1, GF_H = 4.3;
class Acc {
  constructor() { this.m = {}; }
  get(mat) { return this.m[mat] || (this.m[mat] = { pos: [], uv: [] }); }
  /** axis-aligned facade quad: origin o, facade dir a (unit), up height h, width w; facing n */
  quad(mat, o, a, w, h, uvs) {
    const A = this.get(mat), [x, y, z] = o;
    const p2 = [x + a[0] * w, y, z + a[1] * w];
    A.pos.push(x, y, z, p2[0], y, p2[2], p2[0], y + h, p2[2], x, y, z, p2[0], y + h, p2[2], x, y + h, z);
    const [u, v] = uvs || [w, h]; // default: world metres (PBR repeat handles tiling)
    A.uv.push(0, 0, u, 0, u, v, 0, 0, u, v, 0, v);
  }
  /** horizontal quad strip (slab top) at height y: from o along a (w wide) and n (d deep) */
  slab(mat, o, a, n, w, d, y) {
    const A = this.get(mat), [x, , z] = o;
    const p = (i, j) => [x + a[0] * w * i + n[0] * d * j, y, z + a[1] * w * i + n[1] * d * j];
    const [q0, q1, q2, q3] = [p(0, 0), p(1, 0), p(1, 1), p(0, 1)];
    A.pos.push(...q0, ...q1, ...q2, ...q0, ...q2, ...q3);
    A.uv.push(0, 0, w, 0, w, d, 0, 0, w, d, 0, d);
  }
}

function buildingGeo(b, acc) {
  const base = Math.min(...b.poly.map((p) => demAt(p.x, p.z))) - 0.6;
  const floors = Math.max(1, b.levels), top = base + 0.6 + GF_H + (floors - 1) * FLOOR_H, parapet = top + 0.85;
  const gfTop = base + 0.6 + GF_H;
  for (let i = 0; i < b.poly.length; i++) {
    const p1 = b.poly[i], p2 = b.poly[(i + 1) % b.poly.length];
    const len = Math.hypot(p2.x - p1.x, p2.z - p1.z); if (len < 0.3) continue;
    const a = [(p2.x - p1.x) / len, (p2.z - p1.z) / len], n = [-a[1], a[0]]; // outward
    const W = acc.get('a_wall'), G = acc.get('a_ground');
    const wallQuad = (A, y0, y1) => {
      A.pos.push(p1.x, y0, p1.z, p2.x, y0, p2.z, p2.x, y1, p2.z, p1.x, y0, p1.z, p2.x, y1, p2.z, p1.x, y1, p1.z);
      A.uv.push(0, y0, len, y0, len, y1, 0, y0, len, y1, 0, y1);
    };
    wallQuad(G, base, gfTop);                 // stone ground floor
    wallQuad(W, gfTop, parapet);              // plaster upper floors + parapet
    if (len < 2.6) continue;                  // too narrow for openings
    const cols = Math.max(1, Math.floor(len / 3.4)), pitch = len / cols;
    const off = (k, d) => [p1.x + a[0] * d + n[0] * k, 0, p1.z + a[1] * d + n[1] * k];
    // cornice strip per floor line + parapet cap
    for (let f = 1; f <= floors; f++) {
      const y = gfTop + (f - 1) * FLOOR_H - 0.22;
      const o = off(0.07, 0); o[1] = y;
      acc.quad('a_trim', o, a, len, 0.26);
    }
    const oc = off(0.09, 0); oc[1] = top + 0.62; acc.quad('a_trim', oc, a, len, 0.24);
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * pitch, rW = hash(b.id * 13 + c);
      // ground floor: shop roller or arched doorway band
      if (len > 4 && floors >= 2) {
        const sw = Math.min(2.6, pitch - 0.9), so = off(0.04, cx - sw / 2); so[1] = base + 0.75;
        acc.quad(rW < 0.72 ? 'a_roller' : 'a_dark', so, a, sw, 2.7, [1, 1]);
        const fo = off(0.06, cx - sw / 2 - 0.12); fo[1] = base + 0.68;
        acc.quad('a_trim', fo, a, 0.14, 2.9); const fo2 = off(0.06, cx + sw / 2 - 0.02); fo2[1] = base + 0.68; acc.quad('a_trim', fo2, a, 0.14, 2.9);
      }
      // upper floors: window + frame + shutters/rail
      for (let f = 1; f < floors; f++) {
        const wy = gfTop + (f - 1) * FLOOR_H + 0.95, r = hash(b.id * 7 + c * 31 + f);
        const ww = 1.1, wh = 1.55, wx = cx - ww / 2;
        const frame = off(0.03, wx - 0.1); frame[1] = wy - 0.08; acc.quad('a_frame', frame, a, ww + 0.2, wh + 0.2);
        const glass = off(0.05, wx); glass[1] = wy;
        acc.quad(r < 0.3 ? 'a_shut' : 'a_dark', glass, a, ww, wh, [1, 1]); // some closed shutters
        if (r >= 0.3 && r < 0.62) { // open shutters beside the window
          const s1 = off(0.07, wx - 0.5); s1[1] = wy; acc.quad('a_shut', s1, a, 0.45, wh, [0.5, 1]);
          const s2 = off(0.07, wx + ww + 0.05); s2[1] = wy; acc.quad('a_shut', s2, a, 0.45, wh, [0.5, 1]);
        }
        // wrought-iron rail + slab (continuous look on some floors)
        const bal = hash(b.id * 3 + f) < 0.55 ? [cx - ww / 2 - 0.25, ww + 0.5] : [0.25, len - 0.5];
        if (c === 0 || bal[1] < len - 0.4) {
          const rail = off(0.3, bal[0]); rail[1] = wy - 0.12;
          acc.quad('a_rail', rail, a, bal[1], 0.92, [bal[1] / 1.2, 1]);
          const slab = off(0, bal[0]); acc.slab('a_trim', slab, a, n, bal[1], 0.34, wy - 0.14);
        }
      }
    }
  }
  // roof: terrasse slab + inner face of the parapet
  const tris = THREE.ShapeUtils.triangulateShape(b.poly.map((p) => new THREE.Vector2(p.x, p.z)), []);
  const R = acc.get(hash(b.id + 3) < 0.25 ? 'a_zinc' : 'a_terr');
  for (const [i1, i2, i3] of tris) for (const idx of [i1, i3, i2]) {
    const p = b.poly[idx]; R.pos.push(p.x, top, p.z); R.uv.push(p.x, p.z);
  }
}

function roadGeo(r, acc) {
  const strip = (half, lift, mat) => {
    const row = [], A = acc.get(mat);
    for (let i = 0; i < r.pts.length; i++) {
      const a = r.pts[Math.max(0, i - 1)], b = r.pts[Math.min(r.pts.length - 1, i + 1)], p = r.pts[i];
      let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const nx = dz, nz = -dx, y = demAt(p.x, p.z) + lift;
      row.push([p.x + nx * half, y, p.z + nz * half, p.x - nx * half, y, p.z - nz * half]);
    }
    for (let i = 0; i < row.length - 1; i++) {
      const [ax, ay, az, bx, by, bz] = row[i], [cx2, cy, cz2, dx2, dy2, dz2] = row[i + 1];
      A.pos.push(ax, ay, az, bx, by, bz, dx2, dy2, dz2, ax, ay, az, dx2, dy2, dz2, cx2, cy, cz2);
      A.uv.push(ax, az, bx, bz, dx2, dz2, ax, az, dx2, dz2, cx2, cz2);
    }
  };
  strip(r.width / 2 + 2.2, 0.07, 'a_pave');   // sidewalk/curb apron
  strip(r.width / 2, 0.14, 'a_asph');         // carriageway
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
  const acc = new Acc();
  for (const b of sec.buildings) buildingGeo(b, acc);
  for (const r of sec.roads) roadGeo(r, acc);
  for (const [key, A] of Object.entries(acc.m)) if (A.pos.length && MT[key]) g.add(mesh(A.pos, A.uv, MT[key]));
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
