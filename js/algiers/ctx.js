import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fin } from '../studio/kit.js';
import { MT } from '../studio/materials.js';
import { WORLD_UV } from './materials.js';
import { at } from './geom/path.js';

// Build context: parts push geometry per material key; finish() merges them into one mesh per
// material (a handful of draw calls regardless of detail level).

function worldUV(g, k) {
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i));
    if (ax > ay && ax > az) U.setXY(i, P.getZ(i) * k, P.getY(i) * k); else if (ay > az) U.setXY(i, P.getX(i) * k, P.getZ(i) * k); else U.setXY(i, P.getX(i) * k, P.getY(i) * k);
  }
}

export function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Ctx {
  constructor(st, lay) { this.st = st; this.lay = lay; this.path = lay.path; this.acc = {}; this.rng = mulberry(st.seed * 9973 + 17); this.tris = 0; }
  /** geometry in local coords → (optional) frame matrix → accumulator; r = per-object random (lit windows) */
  add(geo, mat, M, r) {
    let g = fin(geo.index ? geo.toNonIndexed() : geo, r);
    if (M) g.applyMatrix4(M);
    if (WORLD_UV[mat]) worldUV(g, WORLD_UV[mat]);
    (this.acc[mat] = this.acc[mat] || []).push(g);
  }
  box(mat, M, w, h, d, x, y, z, r) { if (w <= 0 || h <= 0 || d <= 0) return; const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); this.add(g, mat, M, r); }
  /** box from local min corner (x0,y0,z0) to max (x1,y1,z1) */
  bbox(mat, M, x0, y0, z0, x1, y1, z1, r) { this.box(mat, M, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, r); }
  /** façade frame at arc length s: local x along façade, y up (world height), z outward */
  frame(s, out = 0, face, path = this.path) {
    const p = at(path, s, face);
    return new THREE.Matrix4().makeBasis(new THREE.Vector3(p.tx, 0, p.tz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(p.nx, 0, p.nz)).setPosition(p.x + p.nx * out, 0, p.z + p.nz * out);
  }
  /** frame aligned with the chord between s0 and s1 (arched faces), origin at the chord middle */
  chord(s0, s1, face, path = this.path) {
    const a = at(path, s0, face), b = at(path, s1, face);
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, tx = dx / l, tz = dz / l;
    const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(tx, 0, tz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-tz, 0, tx)).setPosition((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    M.len = l; return M;
  }
  /** car paint material per colour (cached in MT) */
  paintMat(hex) { const k = 'p_paint_' + hex.slice(1); if (!MT[k]) MT[k] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.3, metalness: 0.55 }); return k; }
  finish() {
    const group = new THREE.Group(); group.name = 'algiers';
    for (const m in this.acc) {
      const list = this.acc[m]; if (!list.length || !MT[m]) continue;
      const geo = mergeGeometries(list, false); list.forEach((g) => g.dispose()); if (!geo) continue;
      this.tris += geo.attributes.position.count / 3;
      const me = new THREE.Mesh(geo, MT[m]); me.castShadow = !/^a_(pave|asph|mark|ceil)$/.test(m); me.receiveShadow = true; me.name = m; group.add(me);
    }
    this.acc = {}; return group;
  }
}
