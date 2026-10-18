import * as THREE from 'three';
import { sweep, strip } from '../algiers/geom/sweep.js';
import { lamp } from '../algiers/parts/street.js';

// Street cross-section reused from the Algiers designer (sweep/curb/lamp), driven by an OSM
// road centreline instead of a building façade: raised curb both sides, asphalt between, with
// candelabra lamps along the sidewalk — same parts/materials as street(ctx) in the single-
// building studio, just symmetric on both sides of the carriageway.

const SIDEWALK = 2.4, CURB = 0.16;

function drape(g, demAt) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + demAt(p.getX(i), p.getZ(i)));
  return g;
}

/** samples in the shape path.samples() produces, built directly from a road centreline */
function roadSamples(pts) {
  const S = []; let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], p = pts[i];
    let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (i > 0) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    S.push({ s, x: p.x, z: p.z, mx: -dz, mz: dx, nx: -dz, nz: dx });
  }
  return S;
}

export function addCityRoad(ctx, pts, width, demAt = () => 0) {
  if (pts.length < 2) return;
  const S = roadSamples(pts), half = Math.max(1.4, width / 2);
  for (const side of [1, -1]) {
    const o0 = side * half, o1 = side * (half + CURB), o2 = side * (half + CURB + SIDEWALK);
    ctx.add(drape(sweep(S, side > 0 ? [[o0, 0], [o1, 0], [o1, 0.16], [o0, 0.16]] : [[o1, 0.16], [o0, 0.16], [o0, 0], [o1, 0]]), demAt), 'a_curb');
    ctx.add(drape(sweep(S, side > 0 ? [[o1, 0], [o2, 0], [o2, 0.15], [o1, 0.15]] : [[o2, 0.15], [o1, 0.15], [o1, 0], [o2, 0]]), demAt), 'a_pave');
  }
  ctx.add(drape(strip(S, -half, half, 0.012), demAt), 'a_asph');
  const len = S[S.length - 1].s;
  const n = Math.max(0, Math.round(len / 18));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, idx = Math.min(S.length - 1, Math.floor(t * (S.length - 1))), p = S[idx];
    const out = half + CURB + 0.45, x = p.x + p.nx * out, z = p.z + p.nz * out;
    const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(-p.nz, 0, p.nx), new THREE.Vector3(0, 1, 0), new THREE.Vector3(p.nx, 0, p.nz)).setPosition(x, demAt(x, z), z);
    lamp(ctx, M);
  }
}
